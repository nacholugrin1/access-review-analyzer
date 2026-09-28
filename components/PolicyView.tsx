import { PRIVILEGED_DEPARTMENTS, PRIVILEGED_ENTITLEMENTS, RULES, SOD_RULES } from "@/lib/policy";
import type { AnalysisSettings } from "@/lib/types";
import type { Ctx } from "./context";
import { Card, CardHeader, SeverityBadge } from "./ui";

export default function PolicyView({
  ctx,
  settings,
  onChange,
}: {
  ctx: Ctx;
  settings: AnalysisSettings;
  onChange: (s: AnalysisSettings) => void;
}) {
  const input = "mt-1 w-full rounded-lg border border-line px-2.5 py-1.5 text-sm outline-none focus:border-brand";
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Review settings" hint="Findings recalculate instantly. Decisions already taken are kept." />
        <div className="grid gap-4 p-5 sm:grid-cols-3">
          <label className="block text-sm">
            <span className="font-medium">Review date</span>
            <input type="date" value={settings.asOf} onChange={(e) => e.target.value && onChange({ ...settings, asOf: e.target.value })} className={input} />
            <span className="mt-1 block text-xs text-muted">All ages (dormancy, days since termination) are measured to this date.</span>
          </label>
          <label className="block text-sm">
            <span className="font-medium">Dormancy threshold: {settings.dormancyDays} days</span>
            <input
              type="range"
              min={30}
              max={365}
              step={15}
              value={settings.dormancyDays}
              onChange={(e) => onChange({ ...settings, dormancyDays: Number(e.target.value) })}
              className="mt-3 w-full accent-brand"
            />
            <span className="mt-1 block text-xs text-muted">90 days is a common baseline; privileged accounts often use 30–45.</span>
          </label>
          <label className="block text-sm">
            <span className="font-medium">Peer outlier threshold: {Math.round(settings.peerThreshold * 100)}%</span>
            <input
              type="range"
              min={5}
              max={40}
              step={5}
              value={Math.round(settings.peerThreshold * 100)}
              onChange={(e) => onChange({ ...settings, peerThreshold: Number(e.target.value) / 100 })}
              className="mt-3 w-full accent-brand"
            />
            <span className="mt-1 block text-xs text-muted">
              Flag entitlements held by less than this share of a department (groups of {settings.minPeerGroup}+).
            </span>
          </label>
        </div>
      </Card>

      <Card>
        <CardHeader title="Rules" hint="Deterministic by design: the same files and settings always produce the same findings." />
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-muted">
              <tr className="border-b border-line">
                <th className="px-5 py-2 font-medium">Rule</th>
                <th className="px-3 py-2 font-medium">Control tested</th>
                <th className="px-3 py-2 font-medium">What it checks</th>
                <th className="px-3 py-2 text-right font-medium">Findings</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {RULES.map((r) => (
                <tr key={r.id}>
                  <td className="px-5 py-2.5">
                    <span className="font-medium">{r.name}</span>
                    <span className="block font-mono text-[11px] text-muted">{r.id}</span>
                  </td>
                  <td className="px-3 py-2.5">{r.control}</td>
                  <td className="px-3 py-2.5 text-muted">{r.description}</td>
                  <td className="tabular px-3 py-2.5 text-right font-semibold">{ctx.result.stats.byRule[r.id]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Segregation of duties matrix" hint="Pairs that must never sit with the same person." />
          <ul className="divide-y divide-line">
            {SOD_RULES.map((r) => (
              <li key={r.id} className="px-5 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-xs">
                    {r.left} <span className="text-muted">+</span> {r.right}
                  </span>
                  <SeverityBadge severity={r.severity} />
                </div>
                <p className="mt-1 text-xs text-muted">{r.risk}</p>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader
            title="Privileged entitlements"
            hint={`Expected only in: ${PRIVILEGED_DEPARTMENTS.join(", ")}. Elsewhere they need a documented business reason.`}
          />
          <ul className="flex flex-wrap gap-1.5 p-5">
            {PRIVILEGED_ENTITLEMENTS.map((e) => (
              <li key={e} className="rounded bg-high-soft px-2 py-1 font-mono text-xs text-high">
                {e}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
