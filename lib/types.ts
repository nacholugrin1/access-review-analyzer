// Core data model. Two inputs, mirroring what an IAM analyst actually gets
// during a user access review: the HR roster (the "source of truth" for who
// works here) and an export of accounts + entitlements from each system.

export type EmploymentStatus = "Active" | "Terminated" | "Leave";

export interface Employee {
  employeeId: string;
  name: string;
  email: string;
  department: string;
  title: string;
  managerId: string; // "" for the CEO
  status: EmploymentStatus;
  hireDate: string; // ISO yyyy-mm-dd
  terminationDate: string; // ISO or ""
}

export type AccountType = "human" | "service" | "shared";

export interface Account {
  accountId: string;
  system: string;
  username: string;
  employeeId: string; // "" when the account is not linked to a person
  ownerId: string; // accountable employee for service/shared accounts
  accountType: AccountType;
  enabled: boolean;
  lastLogin: string; // ISO or "" when never used
  mfaEnrolled: boolean;
  entitlements: string[];
}

export type Severity = "critical" | "high" | "medium" | "low";

export type RuleId =
  | "TERM-01"
  | "ORPH-01"
  | "OWNR-01"
  | "DORM-01"
  | "SOD-01"
  | "PRIV-01"
  | "PRIV-02"
  | "PEER-01";

export interface Finding {
  id: string; // stable id, so reviewer decisions survive re-running the analysis
  ruleId: RuleId;
  severity: Severity;
  title: string;
  employeeId: string; // "" when the finding is about an unlinked account
  subject: string; // human-readable: person name or account username
  system: string; // system name, or "Multiple" for cross-system findings
  accountIds: string[];
  evidence: string; // one sentence an auditor can verify against the source files
  recommendation: string;
  reviewerId: string; // who should decide: the manager, or the account owner
}

export interface AnalysisSettings {
  asOf: string; // review date (ISO). Fixed, so results are reproducible.
  dormancyDays: number;
  peerThreshold: number; // 0..1 — share of department peers holding an entitlement
  minPeerGroup: number;
}

export interface AnalysisResult {
  findings: Finding[];
  settings: AnalysisSettings;
  stats: {
    employees: number;
    accounts: number;
    enabledAccounts: number;
    systems: string[];
    bySeverity: Record<Severity, number>;
    byRule: Record<RuleId, number>;
  };
}

export type Decision = "keep" | "revoke" | "escalate";

export interface ReviewDecision {
  decision: Decision;
  comment: string;
  decidedAt: string; // ISO timestamp
}
