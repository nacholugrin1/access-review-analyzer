import { useState } from "react";
import { RULES, SEVERITY_ORDER } from "@/lib/policy";
import type { RuleId, Severity } from "@/lib/types";
import type { Ctx, FindingFilter } from "./context";
import { sortFindings } from "./context";
import FindingItem from "./FindingItem";
import { Button, Card, SEVERITY_STYLE } from "./ui";

type Status = "all" | "pending" | "decided";

export default function FindingsView({ ctx, initial }: { ctx: Ctx; initial: FindingFilter }) {
  const [severity, setSeverity] = useState<Severity | "">(initial.severity ?? "");
  const [ruleId, setRuleId] = useState<RuleId | "">(initial.ruleId ?? "");
  const [system, setSystem] = useState(initial.system ?? "");
  const [status, setStatus] = useState<Status>("all");
  const [q, setQ] = useState("");

  const needle = q.trim().toLowerCase();
  const list = ctx.result.findings
    .filter(
      (f) =>
        (!severity || f.severity === severity) &&
        (!ruleId || f.ruleId === ruleId) &&
        (!system || f.system === system) &&
        (status === "all" || (status === "pending" ? !ctx.decisions[f.id] : !!ctx.decisions[f.id])) &&
        (!needle || `${f.subject} ${f.evidence} ${f.title}`.toLowerCase().includes(needle)),
    )
    .sort(sortFindings);

  const systems = [...new Set(ctx.result.findings.map((f) => f.system))].sort();
  const select = "rounded-lg border border-line bg-white px-2.5 py-1.5 text-sm outline-none focus:border-brand";
  const pendingVisible = list.filter((f) => !ctx.decisions[f.id]);

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search person, account or evidence"
            aria-label="Search findings"
            className={`${select} w-full sm:w-64`}
          />
          <select value={ruleId} onChange={(e) => setRuleId(e.target.value as RuleId | "")} className={`${select} w-full min-w-0 sm:w-auto sm:max-w-xs`} aria-label="Rule">
            <option value="">All rules</option>
            {RULES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.id} · {r.name}
              </option>
            ))}
          </select>
          <select value={system} onChange={(e) => setSystem(e.target.value)} className={select} aria-label="System">
            <option value="">All systems</option>
            {systems.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value as Status)} className={select} aria-label="Decision status">
            <option value="all">Any status</option>
            <option value="pending">Pending</option>
            <option value="decided">Decided</option>
          </select>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSeverity("")}
            className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${!severity ? "bg-ink text-white ring-ink" : "ring-line hover:bg-canvas"}`}
          >
            All severities
          </button>
          {SEVERITY_ORDER.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSeverity(severity === s ? "" : s)}
              className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${severity === s ? SEVERITY_STYLE[s].chip : "ring-line hover:bg-canvas"}`}
            >
              {SEVERITY_STYLE[s].label}
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3">
          <p className="text-sm">
            <span className="tabular font-semibold">{list.length}</span> <span className="text-muted">findings</span>
          </p>
          {pendingVisible.some((f) => f.ruleId === "TERM-01") && (
            <Button
              variant="ghost"
              onClick={() => pendingVisible.filter((f) => f.ruleId === "TERM-01").forEach((f) => ctx.decide(f.id, "revoke"))}
            >
              Revoke all pending leaver access
            </Button>
          )}
        </div>
        {list.length ? (
          <ul className="divide-y divide-line">
            {list.map((f) => (
              <FindingItem key={f.id} f={f} ctx={ctx} />
            ))}
          </ul>
        ) : (
          <p className="px-5 py-12 text-center text-sm text-muted">No findings match these filters.</p>
        )}
      </Card>
    </div>
  );
}
