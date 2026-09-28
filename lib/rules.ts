import {
  PRIVILEGED_DEPARTMENTS,
  PRIVILEGED_ENTITLEMENTS,
  RULES,
  SOD_RULES,
} from "./policy";
import type {
  Account,
  AnalysisResult,
  AnalysisSettings,
  Employee,
  Finding,
  RuleId,
  Severity,
} from "./types";

// The rule engine is deliberately deterministic (no AI, no randomness): the
// same files and settings always produce the same findings. That is what an
// auditor needs — every finding must be reproducible and traceable to a row.

export const DEFAULT_SETTINGS: AnalysisSettings = {
  asOf: "2026-09-30",
  dormancyDays: 90,
  peerThreshold: 0.15,
  minPeerGroup: 6,
};

const PRIVILEGED = new Set(PRIVILEGED_ENTITLEMENTS);

export const entKey = (system: string, entitlement: string) =>
  `${system}:${entitlement}`;

export function daysBetween(fromIso: string, toIso: string): number {
  const a = Date.parse(fromIso + "T00:00:00Z");
  const b = Date.parse(toIso + "T00:00:00Z");
  return Math.round((b - a) / 86_400_000);
}

export function privilegedEntitlements(acc: Account): string[] {
  return acc.entitlements.filter((e) => PRIVILEGED.has(entKey(acc.system, e)));
}

const bump = (s: Severity): Severity =>
  s === "low" ? "medium" : s === "medium" ? "high" : "critical";

export function analyze(
  employees: Employee[],
  accounts: Account[],
  settings: AnalysisSettings = DEFAULT_SETTINGS,
): AnalysisResult {
  const { asOf } = settings;
  const byId = new Map(employees.map((e) => [e.employeeId, e]));
  const findings: Finding[] = [];
  const enabled = accounts.filter((a) => a.enabled);
  // Accounts already flagged as leaver/orphan are not re-reported as dormant:
  // revoking them fixes both, and double counting inflates the risk picture.
  const alreadyRevocable = new Set<string>();

  const managerOf = (emp?: Employee) => emp?.managerId ?? "";
  const lastLoginText = (a: Account) =>
    a.lastLogin ? `last login ${a.lastLogin}` : "never used";

  // TERM-01 — leavers with active access
  for (const a of enabled) {
    const emp = a.employeeId ? byId.get(a.employeeId) : undefined;
    if (!emp || emp.status !== "Terminated") continue;
    const priv = privilegedEntitlements(a);
    const usedAfter =
      !!a.lastLogin && !!emp.terminationDate && a.lastLogin > emp.terminationDate;
    const daysSince = emp.terminationDate ? daysBetween(emp.terminationDate, asOf) : 0;
    const severity: Severity = priv.length || usedAfter ? "critical" : "high";
    alreadyRevocable.add(a.accountId);
    findings.push({
      id: `TERM-01|${a.accountId}`,
      ruleId: "TERM-01",
      severity,
      title: usedAfter ? "Leaver's account used after termination" : "Leaver with active access",
      employeeId: emp.employeeId,
      subject: emp.name,
      system: a.system,
      accountIds: [a.accountId],
      evidence:
        `HR shows ${emp.name} terminated on ${emp.terminationDate} (${daysSince} days before the review). ` +
        `${a.system} account "${a.username}" is still enabled, ${lastLoginText(a)}` +
        (usedAfter ? " — after the termination date." : ".") +
        (priv.length ? ` Holds privileged access: ${priv.join(", ")}.` : ""),
      recommendation: usedAfter
        ? "Disable immediately and open a security incident to review activity after the termination date."
        : "Disable the account and remove all entitlements; check why the leaver process missed it.",
      reviewerId: managerOf(emp),
    });
  }

  // ORPH-01 — human accounts that map to nobody in HR
  for (const a of enabled) {
    if (a.accountType !== "human") continue;
    if (a.employeeId && byId.has(a.employeeId)) continue;
    const priv = privilegedEntitlements(a);
    alreadyRevocable.add(a.accountId);
    findings.push({
      id: `ORPH-01|${a.accountId}`,
      ruleId: "ORPH-01",
      severity: priv.length ? "critical" : "high",
      title: "Orphan account",
      employeeId: "",
      subject: a.username,
      system: a.system,
      accountIds: [a.accountId],
      evidence:
        `${a.system} account "${a.username}" ` +
        (a.employeeId
          ? `references employee ID ${a.employeeId}, which does not exist in the HR roster`
          : "has no employee ID") +
        `; ${lastLoginText(a)}.` +
        (priv.length ? ` Holds privileged access: ${priv.join(", ")}.` : ""),
      recommendation:
        "Identify the person behind the account. If nobody claims it, disable it; if it is a real person, fix the HR link.",
      reviewerId: "",
    });
  }

  // OWNR-01 — service/shared accounts without an accountable, current owner
  for (const a of enabled) {
    if (a.accountType === "human") continue;
    const owner = a.ownerId ? byId.get(a.ownerId) : undefined;
    let problem = "";
    if (!a.ownerId) problem = "has no owner assigned";
    else if (!owner) problem = `lists owner ${a.ownerId}, who does not exist in HR`;
    else if (owner.status === "Terminated")
      problem = `is owned by ${owner.name}, who left on ${owner.terminationDate}`;
    if (!problem) continue;
    const priv = privilegedEntitlements(a);
    findings.push({
      id: `OWNR-01|${a.accountId}`,
      ruleId: "OWNR-01",
      severity: priv.length ? "critical" : "high",
      title: `${a.accountType === "shared" ? "Shared" : "Service"} account without a valid owner`,
      employeeId: "",
      subject: a.username,
      system: a.system,
      accountIds: [a.accountId],
      evidence:
        `${a.system} ${a.accountType} account "${a.username}" ${problem}; ${lastLoginText(a)}.` +
        (priv.length ? ` Holds privileged access: ${priv.join(", ")}.` : ""),
      recommendation:
        a.accountType === "shared"
          ? "Assign an accountable owner or replace the shared login with named accounts; rotate the password."
          : "Assign a current owner; rotate its credentials and confirm it is still needed.",
      // A departed owner's manager inherits the decision; with no owner at all
      // it falls to the system owner (shown as such in the UI).
      reviewerId: managerOf(owner),
    });
  }

  // DORM-01 — enabled but unused
  for (const a of enabled) {
    if (alreadyRevocable.has(a.accountId)) continue;
    const emp = a.employeeId ? byId.get(a.employeeId) : undefined;
    // New joiners get a grace period before "never used" counts against them.
    if (!a.lastLogin && emp && daysBetween(emp.hireDate, asOf) < 30) continue;
    const idle = a.lastLogin ? daysBetween(a.lastLogin, asOf) : Infinity;
    if (idle <= settings.dormancyDays) continue;
    const priv = privilegedEntitlements(a);
    const base: Severity = a.accountType === "human" ? "medium" : "high";
    findings.push({
      id: `DORM-01|${a.accountId}`,
      ruleId: "DORM-01",
      severity: priv.length ? bump(base) : base,
      title: "Dormant account",
      employeeId: emp?.employeeId ?? "",
      subject: emp?.name ?? a.username,
      system: a.system,
      accountIds: [a.accountId],
      evidence:
        `${a.system} account "${a.username}" is enabled but ` +
        (a.lastLogin
          ? `was last used on ${a.lastLogin} (${idle} days before the review; threshold ${settings.dormancyDays}).`
          : "has never been used.") +
        (emp?.status === "Leave" ? " HR shows the employee on leave." : "") +
        (priv.length ? ` Holds privileged access: ${priv.join(", ")}.` : ""),
      recommendation:
        emp?.status === "Leave"
          ? "Suspend the account for the duration of the leave."
          : "Disable the account; re-grant through a request if it is needed again.",
      reviewerId: emp ? emp.managerId : a.ownerId ? managerOf(byId.get(a.ownerId)) : "",
    });
  }

  // Everything below is about people who still work here.
  const active = employees.filter((e) => e.status !== "Terminated");
  const accountsByEmp = new Map<string, Account[]>();
  for (const a of enabled) {
    if (!a.employeeId) continue;
    const list = accountsByEmp.get(a.employeeId) ?? [];
    list.push(a);
    accountsByEmp.set(a.employeeId, list);
  }
  const entitlementsOf = (empId: string) => {
    const map = new Map<string, Account>();
    for (const a of accountsByEmp.get(empId) ?? [])
      for (const e of a.entitlements) map.set(entKey(a.system, e), a);
    return map;
  };

  // SOD-01 — toxic combinations, evaluated across systems per person
  for (const emp of active) {
    const ents = entitlementsOf(emp.employeeId);
    for (const r of SOD_RULES) {
      const l = ents.get(r.left);
      const rr = ents.get(r.right);
      if (!l || !rr) continue;
      findings.push({
        id: `SOD-01|${emp.employeeId}|${r.id}`,
        ruleId: "SOD-01",
        severity: r.severity,
        title: "Segregation of duties conflict",
        employeeId: emp.employeeId,
        subject: emp.name,
        system: l.system === rr.system ? l.system : "Multiple",
        accountIds: [...new Set([l.accountId, rr.accountId])],
        evidence: `${emp.name} (${emp.department}) holds both ${r.left} and ${r.right} (rule ${r.id}). ${r.risk}`,
        recommendation:
          "Remove one side of the pair. If the business cannot, document a compensating control (e.g. independent review of every transaction).",
        reviewerId: emp.managerId,
      });
    }
  }

  // PRIV-01 — admin rights without MFA
  for (const a of enabled) {
    if (a.mfaEnrolled || a.accountType !== "human") continue;
    const emp = a.employeeId ? byId.get(a.employeeId) : undefined;
    if (!emp || emp.status === "Terminated") continue; // already critical in TERM-01
    const priv = privilegedEntitlements(a);
    if (!priv.length) continue;
    findings.push({
      id: `PRIV-01|${a.accountId}`,
      ruleId: "PRIV-01",
      severity: "critical",
      title: "Privileged access without MFA",
      employeeId: emp.employeeId,
      subject: emp.name,
      system: a.system,
      accountIds: [a.accountId],
      evidence: `${a.system} account "${a.username}" holds ${priv.join(", ")} and has no MFA method enrolled.`,
      recommendation: "Enforce MFA for this account before the next sign-in (e.g. a Conditional Access policy for admin roles).",
      reviewerId: emp.managerId,
    });
  }

  // PRIV-02 — admin rights outside the departments that administer systems
  for (const emp of active) {
    if (PRIVILEGED_DEPARTMENTS.includes(emp.department)) continue;
    const accs = accountsByEmp.get(emp.employeeId) ?? [];
    const priv = accs.flatMap((a) => privilegedEntitlements(a).map((e) => ({ a, e })));
    if (!priv.length) continue;
    findings.push({
      id: `PRIV-02|${emp.employeeId}`,
      ruleId: "PRIV-02",
      severity: "medium",
      title: "Privileged access outside IT/Security",
      employeeId: emp.employeeId,
      subject: emp.name,
      system: new Set(priv.map((p) => p.a.system)).size === 1 ? priv[0].a.system : "Multiple",
      accountIds: [...new Set(priv.map((p) => p.a.accountId))],
      evidence: `${emp.name} works in ${emp.department} (${emp.title}) and holds ${priv
        .map((p) => entKey(p.a.system, p.e))
        .join(", ")}.`,
      recommendation:
        "Confirm there is a documented business need; otherwise downgrade to a non-admin role or make it time-bound (just-in-time access).",
      reviewerId: emp.managerId,
    });
  }

  // PEER-01 — entitlements almost nobody else in the department has
  const byDept = new Map<string, Employee[]>();
  for (const e of active) byDept.set(e.department, [...(byDept.get(e.department) ?? []), e]);
  for (const [dept, members] of byDept) {
    if (members.length < settings.minPeerGroup) continue;
    const holders = new Map<string, number>();
    const entsByMember = new Map<string, Map<string, Account>>();
    for (const m of members) {
      const ents = entitlementsOf(m.employeeId);
      entsByMember.set(m.employeeId, ents);
      for (const k of ents.keys()) holders.set(k, (holders.get(k) ?? 0) + 1);
    }
    for (const m of members) {
      const ents = entsByMember.get(m.employeeId)!;
      const outliers = [...ents.entries()].filter(
        ([k]) => !PRIVILEGED.has(k) && (holders.get(k) ?? 0) / members.length < settings.peerThreshold,
      );
      if (!outliers.length) continue;
      findings.push({
        id: `PEER-01|${m.employeeId}`,
        ruleId: "PEER-01",
        severity: "low",
        title: "Peer-group outlier",
        employeeId: m.employeeId,
        subject: m.name,
        system: new Set(outliers.map(([, a]) => a.system)).size === 1 ? outliers[0][1].system : "Multiple",
        accountIds: [...new Set(outliers.map(([, a]) => a.accountId))],
        evidence: `${m.name} holds ${outliers
          .map(([k]) => `${k} (${holders.get(k)} of ${members.length} in ${dept})`)
          .join(", ")}.`,
        recommendation: "Ask the manager whether this is still needed — it often remains from a previous role or project.",
        reviewerId: m.managerId,
      });
    }
  }

  const bySeverity: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  const byRule = Object.fromEntries(RULES.map((r) => [r.id, 0])) as Record<RuleId, number>;
  for (const f of findings) {
    bySeverity[f.severity]++;
    byRule[f.ruleId]++;
  }

  return {
    findings,
    settings,
    stats: {
      employees: employees.length,
      accounts: accounts.length,
      enabledAccounts: enabled.length,
      systems: [...new Set(accounts.map((a) => a.system))].sort(),
      bySeverity,
      byRule,
    },
  };
}
