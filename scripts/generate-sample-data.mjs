// Generates a fictitious but realistic access dataset for "Northwind Payments",
// an invented fintech. Deterministic (seeded), so the demo always shows the
// same findings. Run: npm run generate:data
//
// Every risky situation below is planted on purpose and commented, so anyone
// reading this file can check that the analyzer finds exactly what it should.

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "sample");
const AS_OF = "2026-09-30";

// --- seeded random --------------------------------------------------------
let seed = 20260930;
const rand = () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const int = (a, b) => a + Math.floor(rand() * (b - a + 1));
const daysBefore = (n) => {
  const d = new Date(AS_OF + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
};

const FIRST = ["Lucía", "Mateo", "Valentina", "Santiago", "Camila", "Tomás", "Emma", "Joaquín", "Sofía", "Benjamín", "Olivia", "Martín", "Isabella", "Nicolás", "Mía", "Agustín", "Julia", "Felipe", "Victoria", "Lucas", "Emily", "James", "Grace", "Daniel", "Chloe", "Ethan", "Ava", "Noah", "Paula", "Diego", "Renata", "Gabriel", "Elena", "Bruno", "Clara", "Iván", "Luna", "Hugo", "Zoe", "Leo"];
const LAST = ["García", "Fernández", "López", "Martínez", "Romero", "Sosa", "Álvarez", "Torres", "Ruiz", "Díaz", "Benítez", "Acosta", "Medina", "Herrera", "Suárez", "Castro", "Ortiz", "Silva", "Morales", "Rojas", "Smith", "Johnson", "Brown", "Miller", "Davis", "Wilson", "Moore", "Taylor", "Clark", "Walker"];

const usedNames = new Set();
const newName = () => {
  for (;;) {
    const n = `${pick(FIRST)} ${pick(LAST)}`;
    if (!usedNames.has(n)) return usedNames.add(n), n;
  }
};
const slug = (name) =>
  name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z ]/g, "").replace(" ", ".");

// --- people ----------------------------------------------------------------
const DEPTS = [
  { name: "Finance", size: 16, head: "Head of Finance", titles: ["AP Clerk", "AP Clerk", "AP Clerk", "AP Manager", "Accountant", "Accountant", "Accountant", "Controller", "Financial Analyst"] },
  { name: "Engineering", size: 32, head: "VP Engineering", titles: ["Software Engineer", "Software Engineer", "Senior Software Engineer", "Staff Engineer", "Engineering Manager", "QA Engineer"] },
  { name: "Sales", size: 20, head: "VP Sales", titles: ["Account Executive", "Account Executive", "Sales Development Rep", "Sales Operations Manager"] },
  { name: "Customer Support", size: 18, head: "Head of Support", titles: ["Support Agent", "Support Agent", "Support Agent", "Support Team Lead"] },
  { name: "Operations", size: 12, head: "COO", titles: ["Operations Analyst", "Payments Operations Specialist"] },
  { name: "HR", size: 7, head: "Head of People", titles: ["HR Generalist", "Recruiter", "HR Business Partner"] },
  { name: "IT", size: 9, head: "IT Manager", titles: ["IT Support Specialist", "Systems Administrator", "IAM Analyst"] },
  { name: "Security", size: 6, head: "CISO", titles: ["Security Analyst", "Security Engineer"] },
];

const employees = [];
let nextId = 1001;
const mk = (fields) => {
  const name = fields.name ?? newName();
  const e = {
    employee_id: `E${nextId++}`,
    name,
    email: `${slug(name)}@northwind.example`,
    department: fields.department,
    title: fields.title,
    manager_id: fields.manager_id ?? "",
    status: "Active",
    hire_date: daysBefore(int(60, 2400)),
    termination_date: "",
  };
  employees.push(e);
  return e;
};

const ceo = mk({ department: "Executive", title: "CEO" });
const heads = {};
for (const d of DEPTS) {
  heads[d.name] = mk({ department: d.name, title: d.head, manager_id: ceo.employee_id });
  for (let i = 1; i < d.size; i++)
    mk({ department: d.name, title: d.titles[(i - 1) % d.titles.length], manager_id: heads[d.name].employee_id });
}

const inDept = (dept, title) =>
  employees.filter((e) => e.department === dept && (!title || e.title === title) && e !== heads[dept]);

// --- accounts ----------------------------------------------------------------
const accounts = [];
let nextAcc = 1;
const acc = (e, system, entitlements, extra = {}) => {
  const a = {
    account_id: `A${String(nextAcc++).padStart(4, "0")}`,
    system,
    username: extra.username ?? (system === "AWS" || system === "GitHub" ? slug(e.name).replace(".", "-") : e ? e.email : ""),
    employee_id: e ? e.employee_id : "",
    owner_id: "",
    account_type: "human",
    enabled: "true",
    last_login: daysBefore(int(0, 20)),
    mfa_enrolled: rand() < 0.97 ? "true" : "false",
    entitlements: entitlements.join(";"),
    ...extra,
  };
  accounts.push(a);
  return a;
};

const ERP_BY_TITLE = {
  "AP Clerk": ["AP.EnterInvoice", "AP.CreateVendor"],
  "AP Manager": ["AP.ApprovePayment", "AR.ViewReports"],
  Accountant: ["GL.PostJournal", "AR.ViewReports"],
  Controller: ["GL.ApproveJournal", "AR.ViewReports"],
  "Financial Analyst": ["AR.ViewReports"],
  "Head of Finance": ["AR.ViewReports", "GL.ApproveJournal"],
};

for (const e of employees) {
  acc(e, "Entra ID", ["All Employees", `Dept-${e.department.replace(" ", "")}`]);
  acc(e, "Okta", ["Everyone"]);
  switch (e.department) {
    case "Finance":
      acc(e, "ERP", ERP_BY_TITLE[e.title] ?? ["AR.ViewReports"]);
      break;
    case "Engineering":
      acc(e, "GitHub", [e.title.includes("Manager") || e.title.includes("Staff") || e.title.startsWith("VP") ? "maintainer" : "member"]);
      acc(e, "AWS", [e.title.includes("Senior") || e.title.includes("Staff") ? "PowerUserAccess" : "ReadOnlyAccess"]);
      break;
    case "Sales":
      acc(e, "Salesforce", ["Sales User"]);
      break;
    case "Customer Support":
      acc(e, "Salesforce", ["Support Agent"]);
      break;
    case "Operations":
      acc(e, "ERP", ["AR.ViewReports"]);
      break;
    case "HR":
      accounts.find((a) => a.employee_id === e.employee_id && a.system === "Entra ID").entitlements += ";HR Data Access";
      break;
    case "IT":
      break; // admin rights assigned below, deliberately and individually
    case "Security":
      acc(e, "AWS", ["SecurityAudit"]);
      break;
  }
}

// IT and Security admins — legitimate privileged access (should NOT be flagged
// by PRIV-02, because administering systems is their job).
const it = inDept("IT");
const [itMgr, sysAdmin1, sysAdmin2] = [heads.IT, ...inDept("IT", "Systems Administrator")];
const setEnts = (e, system, ents) => {
  const a = accounts.find((x) => x.employee_id === e.employee_id && x.system === system);
  if (a) a.entitlements = [...new Set([...a.entitlements.split(";"), ...ents])].join(";");
  else acc(e, system, ents);
};
setEnts(itMgr, "Entra ID", ["Global Administrator"]);
setEnts(itMgr, "Okta", ["Super Admin"]);
setEnts(sysAdmin1, "AWS", ["AdministratorAccess"]);
setEnts(sysAdmin1, "Entra ID", ["User Administrator"]);
setEnts(sysAdmin2, "Okta", ["App Admin"]);
for (const e of it) setEnts(e, "Okta", ["Helpdesk Admin"]);
setEnts(heads.Security, "Okta", ["Super Admin"]);
setEnts(heads.Security, "Entra ID", ["Privileged Role Administrator"]);
for (const e of employees) {
  if (["IT", "Security"].includes(e.department))
    accounts.filter((a) => a.employee_id === e.employee_id).forEach((a) => (a.mfa_enrolled = "true"));
}

// Privileged accounts belong to IT/Security above; everyone else gets MFA
// on accounts that will later be made privileged only where planted.

// ============================================================================
// PLANTED FINDINGS
// ============================================================================

// Leavers: 9 people terminated. The leaver process disabled most of their
// accounts, but not all (TERM-01).
const leaverPool = [
  ...inDept("Sales").slice(0, 3),
  ...inDept("Engineering").slice(0, 2),
  ...inDept("Customer Support").slice(0, 2),
  inDept("Finance", "AP Clerk")[0],
  inDept("IT", "IT Support Specialist")[0],
];
const terminate = (e, days) => {
  e.status = "Terminated";
  e.termination_date = daysBefore(days);
  for (const a of accounts.filter((x) => x.employee_id === e.employee_id)) {
    a.enabled = "false";
    a.last_login = daysBefore(days + int(1, 5));
  }
};
leaverPool.forEach((e, i) => terminate(e, [12, 40, 75, 150, 210, 25, 60, 95, 33][i]));
const reenable = (e, system, lastLoginDaysAgo) => {
  const a = accounts.find((x) => x.employee_id === e.employee_id && x.system === system);
  a.enabled = "true";
  if (lastLoginDaysAgo !== undefined) a.last_login = daysBefore(lastLoginDaysAgo);
  return a;
};
reenable(leaverPool[0], "Salesforce"); // sales rep kept CRM access (customer data!)
reenable(leaverPool[1], "Okta");
reenable(leaverPool[3], "GitHub", 30); // engineer left 150 days ago, GitHub used 30 days ago → used AFTER termination
reenable(leaverPool[4], "AWS");
reenable(leaverPool[7], "ERP"); // AP clerk left, still can create vendors
const leaverIt = leaverPool[8];
setEnts(leaverIt, "Entra ID", ["User Administrator"]);
reenable(leaverIt, "Entra ID"); // IT leaver still holds an admin role → critical

// Employees on leave with idle accounts (DORM-01, suggests suspension).
const onLeave = [inDept("Operations")[0], inDept("HR")[0], inDept("Engineering")[5]];
for (const e of onLeave) {
  e.status = "Leave";
  accounts.filter((a) => a.employee_id === e.employee_id).forEach((a) => (a.last_login = daysBefore(int(120, 160))));
}

// Dormant accounts of active employees (DORM-01).
const dormant = [
  [inDept("Sales")[6], "Salesforce", 182],
  [inDept("Engineering")[10], "AWS", 240],
  [inDept("Engineering")[14], "GitHub", 131],
  [inDept("Finance", "Financial Analyst")[0], "ERP", 400],
  [inDept("Customer Support")[8], "Okta", 97],
];
for (const [e, system, d] of dormant) accounts.find((a) => a.employee_id === e.employee_id && a.system === system).last_login = daysBefore(d);
// Never used, and the person joined long ago.
accounts.find((a) => a.employee_id === inDept("Operations")[4].employee_id && a.system === "ERP").last_login = "";

// Orphans: accounts pointing to people HR has never heard of (ORPH-01).
acc(null, "Salesforce", ["System Administrator", "Sales User"], { username: "ext.mrios@partner.example", employee_id: "E9001", last_login: daysBefore(15) });
acc(null, "AWS", ["PowerUserAccess"], { username: "contractor-pgomez", employee_id: "E9002", last_login: daysBefore(44) });
acc(null, "GitHub", ["member"], { username: "test-user-old", employee_id: "", last_login: daysBefore(300) });

// Service and shared accounts (OWNR-01). Two are fine, three are not.
const svc = (system, username, ents, owner, extra = {}) =>
  acc(null, system, ents, { username, account_type: "service", owner_id: owner ? owner.employee_id : "", mfa_enrolled: "false", last_login: daysBefore(1), ...extra });
svc("AWS", "svc-backup", ["BackupOperator"], sysAdmin1); // OK
svc("AWS", "svc-deploy", ["AdministratorAccess"], sysAdmin1); // OK: owned, used daily
svc("ERP", "svc-payroll-sync", ["GL.PostJournal"], inDept("Finance", "Accountant")[1]); // owner will leave ↓
svc("Salesforce", "svc-reporting", ["Read Only"], null); // no owner
svc("ERP", "finance-shared", ["AP.EnterInvoice", "AR.ViewReports"], null, { account_type: "shared", last_login: daysBefore(3) }); // shared, no owner
svc("Okta", "okta-breakglass", ["Super Admin"], heads.Security, { account_type: "shared", last_login: daysBefore(28) }); // OK: owned emergency account, tested monthly
terminate(inDept("Finance", "Accountant")[1], 58); // the payroll-sync owner left

// Segregation of duties (SOD-01).
setEnts(inDept("Finance", "AP Clerk")[1], "ERP", ["AP.ApprovePayment"]); // clerk can create vendor AND pay it → critical
setEnts(inDept("Finance", "Accountant")[0], "ERP", ["GL.ApproveJournal"]); // posts and approves own journals
setEnts(inDept("Finance", "AP Manager")[0], "ERP", ["AP.EnterInvoice"]); // enters and approves invoices
const staff = inDept("Engineering", "Staff Engineer")[0];
setEnts(staff, "GitHub", ["org-owner"]);
setEnts(staff, "AWS", ["AdministratorAccess"]); // code + prod without review (also PRIV-02)

// Privileged access without MFA (PRIV-01).
accounts.find((a) => a.employee_id === sysAdmin2.employee_id && a.system === "Okta").mfa_enrolled = "false";
const salesOps = inDept("Sales", "Sales Operations Manager")[0];
setEnts(salesOps, "Salesforce", ["System Administrator"]); // PRIV-02
accounts.find((a) => a.employee_id === salesOps.employee_id && a.system === "Salesforce").mfa_enrolled = "false"; // and PRIV-01

// Privileged access outside IT/Security (PRIV-02).
setEnts(heads.Finance, "ERP", ["ERP.Admin"]);
setEnts(inDept("Engineering", "Engineering Manager")[0], "Entra ID", ["User Administrator"]);

// Peer outliers (PEER-01): leftovers from previous roles.
acc(inDept("Customer Support")[3], "ERP", ["AP.EnterInvoice"]); // moved from Finance a year ago
acc(inDept("Sales")[9], "GitHub", ["member"]);
setEnts(inDept("Operations")[2], "Salesforce", ["Sales User"]);

// Make sure no accidental MFA gaps create unplanned PRIV-01 noise on privileged accounts.
const PRIV = new Set(["Global Administrator", "Privileged Role Administrator", "User Administrator", "Super Admin", "App Admin", "AdministratorAccess", "BillingAdmin", "org-owner", "System Administrator", "Modify All Data", "ERP.Admin"]);
for (const a of accounts) {
  if (a.account_type !== "human") continue;
  const isPriv = a.entitlements.split(";").some((x) => PRIV.has(x));
  const planted = (a.employee_id === sysAdmin2.employee_id && a.system === "Okta") || (a.employee_id === salesOps.employee_id && a.system === "Salesforce");
  if (isPriv && !planted) a.mfa_enrolled = "true";
}

// --- write ------------------------------------------------------------------
const toCsv = (rows) => {
  const cols = Object.keys(rows[0]);
  const esc = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n") + "\n";
};
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, "hr.csv"), toCsv(employees));
writeFileSync(join(OUT, "accounts.csv"), toCsv(accounts));
console.log(`Wrote ${employees.length} employees and ${accounts.length} accounts to public/sample/ (as of ${AS_OF}).`);
