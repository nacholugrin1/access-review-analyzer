import { RULES, SEVERITY_ORDER } from "@/lib/policy";
import type { Ctx } from "./context";
import { riskByEmployee } from "./context";
import { Card, CardHeader, Kpi, SEVERITY_STYLE, SeverityBadge } from "./ui";

export default function Overview({ ctx }: { ctx: Ctx }) {
  const { result, decisions } = ctx;
  const { stats, findings } = result;
  const total = findings.length;
  const decided = findings.filter((f) => decisions[f.id]);
  const revoke = decided.filter((f) => decisions[f.id].decision === "revoke").length;
  const pct = total ? Math.round((decided.length / total) * 100) : 0;
  const people = new Set(findings.filter((f) => f.employeeId).map((f) => f.employeeId)).size;

  const risk = riskByEmployee(findings);
  const top = [...risk.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const maxRule = Math.max(1, ...Object.values(stats.byRule));

  const bySystem = new Map<string, number>();
  for (const f of findings) bySystem.set(f.system, (bySystem.get(f.system) ?? 0) + 1);
  const systems = [...bySystem.entries()].sort((a, b) => b[1] - a[1]);
  const maxSys = Math.max(1, ...systems.map(([, n]) => n));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Identities in scope" value={stats.employees} sub={`${people} with at least one finding`} />
        <Kpi label="Accounts analysed" value={stats.accounts} sub={`${stats.enabledAccounts} enabled · ${stats.systems.length} systems`} />
        <Kpi label="Findings" value={total} sub={`${stats.bySeverity.high} high · ${stats.bySeverity.medium} medium · ${stats.bySeverity.low} low`} />
        <Kpi label="Critical" value={stats.bySeverity.critical} sub="fix before the review closes" tone="crit" />
      </div>

      <Card>
        <CardHeader
          title="Review progress"
          hint={`${decided.length} of ${total} findings decided · ${revoke} access revocations requested`}
        />
        <div className="px-5 py-4">
          <p className="mb-1.5 flex justify-between text-xs text-muted">
            <span>Decided</span>
            <span className="tabular font-medium text-ink">{pct}%</span>
          </p>
          <div className="flex h-2.5 overflow-hidden rounded-full bg-canvas" role="img" aria-label={`${pct}% of findings reviewed`}>
            <div className="bg-brand transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="mb-1.5 mt-4 text-xs text-muted">Findings by severity</p>
          <div className="flex h-3 overflow-hidden rounded-full" role="img" aria-label="Findings by severity">
            {SEVERITY_ORDER.map((s) =>
              stats.bySeverity[s] ? (
                <div key={s} className={SEVERITY_STYLE[s].bar} style={{ width: `${(stats.bySeverity[s] / total) * 100}%` }} />
              ) : null,
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            {SEVERITY_ORDER.map((s) => (
              <button key={s} type="button" onClick={() => ctx.showFindings({ severity: s })} className="inline-flex items-center gap-1.5 hover:text-ink">
                <span className={`size-2 rounded-full ${SEVERITY_STYLE[s].bar}`} />
                {SEVERITY_STYLE[s].label} <span className="tabular font-medium text-ink">{stats.bySeverity[s]}</span>
              </button>
            ))}
          </div>
        </div>
      </Card>

      <div id="controls" className="grid scroll-mt-4 gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader title="Findings by control" hint="Each rule tests one access-review control. Click to see its findings." />
          <ul className="divide-y divide-line">
            {RULES.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => ctx.showFindings({ ruleId: r.id })}
                  className="grid w-full grid-cols-[1fr_auto] items-center gap-x-4 px-5 py-3 text-left hover:bg-canvas"
                >
                  <span>
                    <span className="text-sm font-medium">{r.name}</span>
                    <span className="ml-2 font-mono text-[11px] text-muted">{r.id}</span>
                    <span className="block text-xs text-muted">{r.control}</span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="hidden h-1.5 w-28 overflow-hidden rounded-full bg-canvas sm:block">
                      <span className="block h-full bg-brand/70" style={{ width: `${(stats.byRule[r.id] / maxRule) * 100}%` }} />
                    </span>
                    <span className="tabular w-6 text-right text-sm font-semibold">{stats.byRule[r.id]}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Highest-risk identities" hint="Score = sum of finding weights (critical 10, high 5, medium 2, low 1)" />
            <ul className="divide-y divide-line">
              {top.map(([id, score]) => {
                const e = ctx.byEmp.get(id);
                const worst = findings.filter((f) => f.employeeId === id).sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity))[0];
                return (
                  <li key={id}>
                    <button type="button" onClick={() => ctx.openIdentity(id)} className="flex w-full items-center justify-between gap-3 px-5 py-2.5 text-left hover:bg-canvas">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{e?.name ?? id}</span>
                        <span className="block truncate text-xs text-muted">
                          {e?.department} · {e?.status}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        {worst && <SeverityBadge severity={worst.severity} />}
                        <span className="tabular w-6 text-right text-sm font-semibold">{score}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card>
            <CardHeader title="Findings by system" />
            <ul className="space-y-2.5 px-5 py-4">
              {systems.map(([sys, n]) => (
                <li key={sys}>
                  <button type="button" onClick={() => ctx.showFindings({ system: sys })} className="w-full text-left">
                    <span className="flex justify-between text-xs">
                      <span className="font-medium">{sys}</span>
                      <span className="tabular text-muted">{n}</span>
                    </span>
                    <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-canvas">
                      <span className="block h-full bg-brand/70" style={{ width: `${(n / maxSys) * 100}%` }} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
