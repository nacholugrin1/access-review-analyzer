import { useState } from "react";
import { PRIVILEGED_ENTITLEMENTS } from "@/lib/policy";
import { entKey } from "@/lib/rules";
import type { Ctx } from "./context";
import { reviewerLabel, riskByEmployee, sortFindings } from "./context";
import FindingItem from "./FindingItem";
import { Card } from "./ui";

const PRIV = new Set(PRIVILEGED_ENTITLEMENTS);

export default function IdentitiesView({
  ctx,
  selected,
  onSelect,
}: {
  ctx: Ctx;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const [onlyFindings, setOnlyFindings] = useState(true);
  const risk = riskByEmployee(ctx.result.findings);
  const needle = q.trim().toLowerCase();
  const people = ctx.employees
    .filter((e) => (!onlyFindings || risk.has(e.employeeId)) && (!needle || `${e.name} ${e.department} ${e.title} ${e.employeeId}`.toLowerCase().includes(needle)))
    .sort((a, b) => (risk.get(b.employeeId) ?? 0) - (risk.get(a.employeeId) ?? 0) || a.name.localeCompare(b.name));

  const current = ctx.byEmp.get(selected ?? "") ?? ctx.byEmp.get(people[0]?.employeeId ?? "");
  const accounts = current ? ctx.accounts.filter((a) => a.employeeId === current.employeeId) : [];
  const findings = current ? ctx.result.findings.filter((f) => f.employeeId === current.employeeId).sort(sortFindings) : [];

  const statusStyle = (s: string) =>
    s === "Terminated" ? "bg-crit-soft text-crit" : s === "Leave" ? "bg-med-soft text-med" : "bg-ok-soft text-ok";

  return (
    <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
      <Card className="h-fit">
        <div className="space-y-2 border-b border-line p-4">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, department, ID"
            aria-label="Search identities"
            className="w-full rounded-lg border border-line px-2.5 py-1.5 text-sm outline-none focus:border-brand"
          />
          <label className="flex items-center gap-2 text-xs text-muted">
            <input type="checkbox" checked={onlyFindings} onChange={(e) => setOnlyFindings(e.target.checked)} className="accent-brand" />
            Only identities with findings
          </label>
        </div>
        <ul className="max-h-[34rem] divide-y divide-line overflow-y-auto">
          {people.map((e) => (
            <li key={e.employeeId}>
              <button
                type="button"
                onClick={() => onSelect(e.employeeId)}
                className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left ${current?.employeeId === e.employeeId ? "bg-brand-soft" : "hover:bg-canvas"}`}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{e.name}</span>
                  <span className="block truncate text-xs text-muted">
                    {e.department} · {e.title}
                  </span>
                </span>
                {risk.get(e.employeeId) ? <span className="tabular text-sm font-semibold">{risk.get(e.employeeId)}</span> : null}
              </button>
            </li>
          ))}
          {!people.length && <li className="px-4 py-8 text-center text-sm text-muted">No identities match.</li>}
        </ul>
      </Card>

      {current && (
        <div className="space-y-6">
          <Card className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">{current.name}</h2>
                <p className="text-sm text-muted">
                  {current.title} · {current.department} · {current.employeeId}
                </p>
              </div>
              <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${statusStyle(current.status)}`}>
                {current.status}
                {current.terminationDate && ` · ${current.terminationDate}`}
              </span>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-xs text-muted">Manager</dt>
                <dd className="truncate">{current.managerId ? reviewerLabel(ctx, current.managerId).split(" · ")[0] : "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Hired</dt>
                <dd className="tabular">{current.hireDate}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Accounts</dt>
                <dd className="tabular">
                  {accounts.filter((a) => a.enabled).length} enabled / {accounts.length}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Risk score</dt>
                <dd className="tabular font-semibold">{risk.get(current.employeeId) ?? 0}</dd>
              </div>
            </dl>
          </Card>

          <Card>
            <div className="border-b border-line px-5 py-3.5">
              <h3 className="text-sm font-semibold">Accounts and entitlements</h3>
              <p className="mt-0.5 text-xs text-muted">Privileged entitlements are highlighted.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-muted">
                  <tr className="border-b border-line">
                    <th className="px-5 py-2 font-medium">System</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Last login</th>
                    <th className="px-3 py-2 font-medium">MFA</th>
                    <th className="px-3 py-2 font-medium">Entitlements</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {accounts.map((a) => (
                    <tr key={a.accountId} className={a.enabled ? "" : "text-muted"}>
                      <td className="px-5 py-2.5">
                        <span className="font-medium">{a.system}</span>
                        <span className="block font-mono text-[11px] text-muted">{a.accountId}</span>
                      </td>
                      <td className="px-3 py-2.5">{a.enabled ? "Enabled" : "Disabled"}</td>
                      <td className="tabular px-3 py-2.5">{a.lastLogin || "Never"}</td>
                      <td className="px-3 py-2.5">{a.mfaEnrolled ? "Yes" : <span className="font-medium text-crit">No</span>}</td>
                      <td className="px-3 py-2.5">
                        <span className="flex flex-wrap gap-1">
                          {a.entitlements.map((e) => (
                            <span
                              key={e}
                              className={`rounded px-1.5 py-0.5 text-xs ${PRIV.has(entKey(a.system, e)) ? "bg-high-soft font-medium text-high" : "bg-canvas"}`}
                            >
                              {e}
                            </span>
                          ))}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <div className="border-b border-line px-5 py-3.5">
              <h3 className="text-sm font-semibold">Findings</h3>
            </div>
            {findings.length ? (
              <ul className="divide-y divide-line">
                {findings.map((f) => (
                  <FindingItem key={f.id} f={f} ctx={ctx} />
                ))}
              </ul>
            ) : (
              <p className="px-5 py-8 text-center text-sm text-muted">No findings for this identity.</p>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
