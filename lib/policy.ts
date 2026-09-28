import type { RuleId, Severity } from "./types";

// The access policy is data, not code: an auditor can read exactly what the
// tool considers "privileged" or "toxic" without reading the rule engine.
// Entitlements are written as "System:Entitlement" so the same name in two
// systems never collides.

export const PRIVILEGED_ENTITLEMENTS: string[] = [
  "Entra ID:Global Administrator",
  "Entra ID:Privileged Role Administrator",
  "Entra ID:User Administrator",
  "Okta:Super Admin",
  "Okta:App Admin",
  "AWS:AdministratorAccess",
  "AWS:BillingAdmin",
  "GitHub:org-owner",
  "Salesforce:System Administrator",
  "Salesforce:Modify All Data",
  "ERP:ERP.Admin",
];

// Departments where holding administrative access is part of the job.
export const PRIVILEGED_DEPARTMENTS: string[] = ["IT", "Security"];

export interface SodRule {
  id: string;
  left: string;
  right: string;
  severity: Severity;
  risk: string;
}

// Segregation of duties: pairs of entitlements that must not sit with the same
// person, because together they let one individual complete a sensitive
// process end to end without anyone else noticing.
export const SOD_RULES: SodRule[] = [
  {
    id: "SOD-AP-1",
    left: "ERP:AP.CreateVendor",
    right: "ERP:AP.ApprovePayment",
    severity: "critical",
    risk: "Can create a fictitious vendor and approve payments to it.",
  },
  {
    id: "SOD-AP-2",
    left: "ERP:AP.EnterInvoice",
    right: "ERP:AP.ApprovePayment",
    severity: "high",
    risk: "Can enter an invoice and approve its own payment.",
  },
  {
    id: "SOD-GL-1",
    left: "ERP:GL.PostJournal",
    right: "ERP:GL.ApproveJournal",
    severity: "high",
    risk: "Can post and approve the same journal entry, bypassing review of financial records.",
  },
  {
    id: "SOD-CHG-1",
    left: "GitHub:org-owner",
    right: "AWS:AdministratorAccess",
    severity: "high",
    risk: "Can change code and deploy it to production without an independent reviewer.",
  },
];

export interface RuleMeta {
  id: RuleId;
  name: string;
  control: string; // the review control this rule supports, in plain words
  description: string;
}

export const RULES: RuleMeta[] = [
  {
    id: "TERM-01",
    name: "Leaver with active access",
    control: "Timely removal of access on termination",
    description: "Enabled account belonging to an employee HR marks as Terminated.",
  },
  {
    id: "ORPH-01",
    name: "Orphan account",
    control: "Every account maps to a known identity",
    description: "Human account whose employee ID does not exist in the HR roster.",
  },
  {
    id: "OWNR-01",
    name: "Non-human account without a valid owner",
    control: "Accountability for service and shared accounts",
    description: "Service or shared account with no owner, or an owner who has left.",
  },
  {
    id: "DORM-01",
    name: "Dormant account",
    control: "Removal of unused access",
    description: "Enabled account not used within the dormancy window (or never used).",
  },
  {
    id: "SOD-01",
    name: "Segregation of duties conflict",
    control: "Segregation of duties",
    description: "One person holds both sides of a toxic entitlement pair, across any systems.",
  },
  {
    id: "PRIV-01",
    name: "Privileged access without MFA",
    control: "Strong authentication for privileged access",
    description: "Enabled account with a privileged entitlement and no MFA enrolled.",
  },
  {
    id: "PRIV-02",
    name: "Privileged access outside IT/Security",
    control: "Least privilege",
    description: "Privileged entitlement held by someone outside the departments that administer systems.",
  },
  {
    id: "PEER-01",
    name: "Peer-group outlier",
    control: "Least privilege",
    description: "Entitlement held by very few people in the same department — likely left over from a past role.",
  },
];

export const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low"];
export const SEVERITY_WEIGHT: Record<Severity, number> = {
  critical: 10,
  high: 5,
  medium: 2,
  low: 1,
};
