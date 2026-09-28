import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseAccounts, parseEmployees } from "@/lib/csv";
import { analyze, DEFAULT_SETTINGS } from "@/lib/rules";
import type { Account, Employee } from "@/lib/types";

const emp = (over: Partial<Employee>): Employee => ({
  employeeId: "E1",
  name: "Ana Test",
  email: "ana@x.example",
  department: "Finance",
  title: "Accountant",
  managerId: "E0",
  status: "Active",
  hireDate: "2020-01-01",
  terminationDate: "",
  ...over,
});

const acct = (over: Partial<Account>): Account => ({
  accountId: "A1",
  system: "ERP",
  username: "ana",
  employeeId: "E1",
  ownerId: "",
  accountType: "human",
  enabled: true,
  lastLogin: "2026-09-25",
  mfaEnrolled: true,
  entitlements: [],
  ...over,
});

const rulesOf = (e: Employee[], a: Account[]) => analyze(e, a).findings.map((f) => f.ruleId);

describe("TERM-01 leavers", () => {
  it("flags an enabled account of a terminated employee", () => {
    const r = analyze([emp({ status: "Terminated", terminationDate: "2026-09-01" })], [acct({ lastLogin: "2026-08-30" })]);
    expect(r.findings).toHaveLength(1);
    expect(r.findings[0]).toMatchObject({ ruleId: "TERM-01", severity: "high" });
  });
  it("is critical when the account was used after the termination date", () => {
    const r = analyze([emp({ status: "Terminated", terminationDate: "2026-09-01" })], [acct({ lastLogin: "2026-09-10" })]);
    expect(r.findings[0].severity).toBe("critical");
  });
  it("ignores disabled accounts — the leaver process worked", () => {
    expect(rulesOf([emp({ status: "Terminated", terminationDate: "2026-09-01" })], [acct({ enabled: false })])).toEqual([]);
  });
  it("does not double-report the same account as dormant", () => {
    const r = rulesOf([emp({ status: "Terminated", terminationDate: "2026-01-01" })], [acct({ lastLogin: "2025-12-01" })]);
    expect(r).toEqual(["TERM-01"]);
  });
});

describe("ORPH-01 and OWNR-01", () => {
  it("flags a human account with an unknown employee ID", () => {
    expect(rulesOf([emp({})], [acct({ employeeId: "E999" })])).toEqual(["ORPH-01"]);
  });
  it("flags a service account without owner, but not one with a current owner", () => {
    const e = [emp({})];
    expect(rulesOf(e, [acct({ accountType: "service", employeeId: "", ownerId: "" })])).toEqual(["OWNR-01"]);
    expect(rulesOf(e, [acct({ accountType: "service", employeeId: "", ownerId: "E1" })])).toEqual([]);
  });
  it("flags a service account whose owner has left", () => {
    const e = [emp({ status: "Terminated", terminationDate: "2026-08-01" })];
    expect(rulesOf(e, [acct({ accountType: "service", employeeId: "", ownerId: "E1" })])).toEqual(["OWNR-01"]);
  });
});

describe("DORM-01 dormant accounts", () => {
  it("respects the dormancy threshold", () => {
    const e = [emp({})];
    expect(rulesOf(e, [acct({ lastLogin: "2026-07-10" })])).toEqual([]); // 82 days
    expect(rulesOf(e, [acct({ lastLogin: "2026-06-01" })])).toEqual(["DORM-01"]); // 121 days
  });
  it("gives new joiners a grace period before 'never used' counts", () => {
    expect(rulesOf([emp({ hireDate: "2026-09-20" })], [acct({ lastLogin: "" })])).toEqual([]);
    expect(rulesOf([emp({ hireDate: "2025-01-01" })], [acct({ lastLogin: "" })])).toEqual(["DORM-01"]);
  });
});

describe("SOD-01 segregation of duties", () => {
  it("detects a toxic pair split across two systems", () => {
    const r = analyze(
      [emp({ department: "Engineering" })],
      [
        acct({ accountId: "A1", system: "GitHub", entitlements: ["org-owner"] }),
        acct({ accountId: "A2", system: "AWS", entitlements: ["AdministratorAccess"] }),
      ],
    );
    const sod = r.findings.find((f) => f.ruleId === "SOD-01")!;
    expect(sod.system).toBe("Multiple");
    expect(sod.accountIds).toEqual(["A1", "A2"]);
  });
  it("does not fire with only one side of the pair", () => {
    expect(rulesOf([emp({})], [acct({ entitlements: ["AP.CreateVendor"] })])).toEqual([]);
  });
});

describe("PRIV rules", () => {
  it("PRIV-01: privileged entitlement without MFA is critical", () => {
    const r = analyze([emp({ department: "IT" })], [acct({ system: "Okta", entitlements: ["Super Admin"], mfaEnrolled: false })]);
    expect(r.findings.map((f) => [f.ruleId, f.severity])).toEqual([["PRIV-01", "critical"]]);
  });
  it("PRIV-02: admin rights are expected in IT, questioned elsewhere", () => {
    const a = [acct({ system: "Entra ID", entitlements: ["Global Administrator"] })];
    expect(rulesOf([emp({ department: "IT" })], a)).toEqual([]);
    expect(rulesOf([emp({ department: "Sales" })], a)).toEqual(["PRIV-02"]);
  });
});

describe("PEER-01 outliers", () => {
  it("flags an entitlement almost nobody in the department has", () => {
    const people = Array.from({ length: 8 }, (_, i) => emp({ employeeId: `E${i}`, name: `P${i}` }));
    const accounts = people.map((p, i) =>
      acct({ accountId: `A${i}`, employeeId: p.employeeId, entitlements: i === 0 ? ["AR.ViewReports", "AP.EnterInvoice"] : ["AR.ViewReports"] }),
    );
    const r = analyze(people, accounts);
    expect(r.findings.map((f) => [f.ruleId, f.employeeId])).toEqual([["PEER-01", "E0"]]);
  });
});

describe("CSV import", () => {
  it("rejects a file with missing columns instead of half-reading it", () => {
    const r = parseEmployees("employee_id,name\nE1,Ana");
    expect(r.rows).toEqual([]);
    expect(r.errors[0]).toMatch(/missing column/);
  });
  it("requires a termination date for terminated employees", () => {
    const head = "employee_id,name,email,department,title,manager_id,status,hire_date,termination_date";
    const r = parseEmployees(`${head}\nE1,Ana,a@x,Finance,AP,E0,Terminated,2020-01-01,`);
    expect(r.errors[0]).toMatch(/termination_date/);
  });
});

describe("sample dataset (integration)", () => {
  const e = parseEmployees(readFileSync("public/sample/hr.csv", "utf8"));
  const a = parseAccounts(readFileSync("public/sample/accounts.csv", "utf8"));
  const r = analyze(e.rows, a.rows, DEFAULT_SETTINGS);

  it("parses cleanly", () => {
    expect(e.errors).toEqual([]);
    expect(a.errors).toEqual([]);
  });
  it("finds every planted issue and nothing else", () => {
    expect(r.stats.byRule).toEqual({
      "TERM-01": 6,
      "ORPH-01": 3,
      "OWNR-01": 3,
      "DORM-01": 15,
      "SOD-01": 5,
      "PRIV-01": 2,
      "PRIV-02": 4,
      "PEER-01": 3,
    });
  });
  it("gives every finding a unique, stable id", () => {
    const ids = r.findings.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
