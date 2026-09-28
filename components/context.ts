import { SEVERITY_WEIGHT } from "@/lib/policy";
import type { Account, AnalysisResult, Decision, Employee, Finding, ReviewDecision, RuleId, Severity } from "@/lib/types";

export interface FindingFilter {
  severity?: Severity;
  ruleId?: RuleId;
  system?: string;
}

export interface Ctx {
  result: AnalysisResult;
  employees: Employee[];
  accounts: Account[];
  byEmp: Map<string, Employee>;
  decisions: Record<string, ReviewDecision>;
  decide: (findingId: string, d: Decision | undefined) => void;
  comment: (findingId: string, text: string) => void;
  openIdentity: (employeeId: string) => void;
  showFindings: (filter: FindingFilter) => void;
  datasetLabel: string;
}

export function reviewerLabel(ctx: Ctx, reviewerId: string): string {
  if (!reviewerId) return "System owner (IT)";
  const r = ctx.byEmp.get(reviewerId);
  return r ? `${r.name} · ${r.title}` : reviewerId;
}

export function riskByEmployee(findings: Finding[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const f of findings) if (f.employeeId) m.set(f.employeeId, (m.get(f.employeeId) ?? 0) + SEVERITY_WEIGHT[f.severity]);
  return m;
}

export const SEV_RANK: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
export const sortFindings = (a: Finding, b: Finding) =>
  SEV_RANK[a.severity] - SEV_RANK[b.severity] || a.ruleId.localeCompare(b.ruleId) || a.subject.localeCompare(b.subject);
