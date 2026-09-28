import { RULES, SEVERITY_ORDER } from "@/lib/policy";
import { toCsv } from "@/lib/csv";
import type { Ctx } from "./context";
import { reviewerLabel, sortFindings } from "./context";
import { Button, DECISION_LABEL, DecisionBadge, download, SEVERITY_STYLE, SeverityBadge } from "./ui";

export default function ReportView({ ctx }: { ctx: Ctx }) {
  const { result, decisions } = ctx;
  const { stats, settings } = result;
  const findings = [...result.findings].sort(sortFindings);
  const decided = findings.filter((f) => decisions[f.id]);
  const count = (d: string) => decided.filter((f) => decisions[f.id].decision === d).length;
  const generated = new Date().toISOString().slice(0, 16).replace("T", " ");

  const exportCsv = () =>
    download(
      `access-review-${settings.asOf}.csv`,
      toCsv(
        findings.map((f) => ({
          finding_id: f.id,
          rule: f.ruleId,
          severity: f.severity,
          title: f.title,
          subject: f.subject,
          employee_id: f.employeeId,
          system: f.system,
          accounts: f.accountIds.join(" "),
          evidence: f.evidence,
          recommendation: f.recommendation,
          reviewer: reviewerLabel(ctx, f.reviewerId),
          decision: decisions[f.id] ? DECISION_LABEL[decisions[f.id].decision] : "Pending",
          comment: decisions[f.id]?.comment ?? "",
          decided_at: decisions[f.id]?.decidedAt ?? "",
        })),
      ),
    );

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">Print it or save as PDF to attach to the audit evidence. The CSV has one row per finding with its decision.</p>
        <div className="flex gap-2">
          <Button onClick={exportCsv}>Export CSV</Button>
          <Button variant="primary" onClick={() => window.print()}>
            Print / Save PDF
          </Button>
        </div>
      </div>

      <article className="rounded-xl border border-line bg-white p-6 sm:p-10 print:border-0 print:p-0">
        <header className="border-b border-line pb-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand">User access review · report</p>
          <h2 className="mt-1 text-2xl font-semibold">{ctx.datasetLabel}</h2>
          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs text-muted">Review date</dt>
              <dd className="tabular">{settings.asOf}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Generated</dt>
              <dd className="tabular">{generated} UTC</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Systems in scope</dt>
              <dd>{stats.systems.join(", ")}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Population</dt>
              <dd className="tabular">
                {stats.employees} identities · {stats.accounts} accounts
              </dd>
            </div>
          </dl>
        </header>

        <section className="mt-6">
          <h3 className="text-sm font-semibold">1. Summary</h3>
          <p className="mt-2 text-sm leading-relaxed">
            The review found <strong>{findings.length} exceptions</strong> ({stats.bySeverity.critical} critical, {stats.bySeverity.high} high,{" "}
            {stats.bySeverity.medium} medium, {stats.bySeverity.low} low) across {stats.enabledAccounts} enabled accounts. Reviewers have decided{" "}
            {decided.length} of them: {count("revoke")} revoke, {count("keep")} keep with justification, {count("escalate")} escalated.{" "}
            {findings.length - decided.length > 0
              ? `${findings.length - decided.length} remain pending, so this review is not yet complete.`
              : "All exceptions have a decision."}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {SEVERITY_ORDER.map((s) => (
              <div key={s} className={`rounded-lg px-4 py-3 ${SEVERITY_STYLE[s].chip}`}>
                <p className="text-xs font-medium">{SEVERITY_STYLE[s].label}</p>
                <p className="tabular text-xl font-semibold">{stats.bySeverity[s]}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8">
          <h3 className="text-sm font-semibold">2. Method</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            The HR roster was used as the authoritative source of identities and compared with account exports from each system. Eight
            deterministic rules were applied (dormancy threshold {settings.dormancyDays} days, peer threshold{" "}
            {Math.round(settings.peerThreshold * 100)}%). Each finding cites the source rows it is based on, so any result can be
            reproduced from the same files.
          </p>
          <table className="report-table mt-3 w-full text-left text-sm">
            <thead className="text-xs text-muted">
              <tr className="border-b border-line">
                <th className="py-1.5 pr-3 font-medium">Rule</th>
                <th className="py-1.5 pr-3 font-medium">Control</th>
                <th className="py-1.5 text-right font-medium">Exceptions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {RULES.map((r) => (
                <tr key={r.id}>
                  <td className="py-1.5 pr-3">
                    <span className="font-mono text-xs text-muted">{r.id}</span> {r.name}
                  </td>
                  <td className="py-1.5 pr-3 text-muted">{r.control}</td>
                  <td className="tabular py-1.5 text-right">{stats.byRule[r.id]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="mt-8">
          <h3 className="text-sm font-semibold">3. Exceptions and decisions</h3>
          <div className="mt-3 overflow-x-auto">
            <table className="report-table w-full min-w-[40rem] text-left text-xs">
              <thead className="text-muted">
                <tr className="border-b border-line">
                  <th className="py-1.5 pr-2 font-medium">Severity</th>
                  <th className="py-1.5 pr-2 font-medium">Finding</th>
                  <th className="py-1.5 pr-2 font-medium">Evidence</th>
                  <th className="py-1.5 pr-2 font-medium">Reviewer</th>
                  <th className="py-1.5 font-medium">Decision</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line align-top">
                {findings.map((f) => (
                  <tr key={f.id}>
                    <td className="py-2 pr-2">
                      <SeverityBadge severity={f.severity} />
                    </td>
                    <td className="py-2 pr-2">
                      <span className="font-medium">{f.subject}</span>
                      <span className="block text-muted">
                        {f.ruleId} · {f.system}
                      </span>
                    </td>
                    <td className="py-2 pr-2">{f.evidence}</td>
                    <td className="py-2 pr-2 text-muted">{reviewerLabel(ctx, f.reviewerId)}</td>
                    <td className="py-2">
                      <DecisionBadge decision={decisions[f.id]?.decision} />
                      {decisions[f.id]?.comment && <span className="mt-1 block text-muted">“{decisions[f.id].comment}”</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="report-table mt-10 grid gap-8 sm:grid-cols-2">
          {["Prepared by (IAM analyst)", "Approved by (control owner)"].map((l) => (
            <div key={l}>
              <div className="h-10 border-b border-ink/40" />
              <p className="mt-1 text-xs text-muted">{l} · name, signature, date</p>
            </div>
          ))}
        </section>
      </article>
    </div>
  );
}
