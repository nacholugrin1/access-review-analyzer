export type Tab = "overview" | "findings" | "review" | "identities" | "policy" | "report";

const STEPS: { tab: Tab; title: string; text: string }[] = [
  {
    tab: "overview",
    title: "See what the rules found",
    text: "Eight access-review controls run on a fictitious fintech. Click any control, like “Leaver with active access”, to open its findings.",
  },
  {
    tab: "findings",
    title: "Read the evidence",
    text: "Expand a finding (▸) to see why it was flagged, the accounts involved and the recommended fix.",
  },
  {
    tab: "review",
    title: "Decide as each manager",
    text: "Pick a reviewer and choose Keep (access is needed), Revoke (remove it) or Escalate (security or audit should decide). A comment box opens so you can justify it.",
  },
  {
    tab: "policy",
    title: "Tune the policy",
    text: "Move the dormancy threshold (e.g. 90 → 180 days) or the review date and watch the findings recalculate.",
  },
  {
    tab: "report",
    title: "Close the review",
    text: "Print or save the audit report as PDF, or export a CSV with every decision: the evidence an auditor would receive.",
  },
];

export default function HowToUse({ current, onGo, onClose }: { current: Tab; onGo: (tab: Tab) => void; onClose: () => void }) {
  return (
    <section aria-labelledby="howto-title" className="no-print mb-6 rounded-xl border border-brand/30 bg-white">
      <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h2 id="howto-title" className="text-sm font-semibold">How to use this demo · 2 minutes</h2>
          <p className="mt-0.5 text-xs text-muted">
            You are the access-review owner at Northwind Payments (fictitious). Click a step to go there; the one you are on is
            highlighted. This guide stays on top until you close it.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-lg border border-line px-3 py-1 text-xs font-medium hover:bg-canvas"
        >
          Close guide
        </button>
      </div>
      <ol className="grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-5">
        {STEPS.map((s, i) => {
          const active = s.tab === current;
          return (
          <li key={s.tab} className="bg-white">
            <button
              type="button"
              aria-current={active ? "step" : undefined}
              onClick={() => onGo(s.tab)}
              className={`flex h-full w-full gap-3 p-4 text-left ${active ? "bg-brand-soft" : "hover:bg-canvas"}`}
            >
              <span
                className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold ${
                  active ? "bg-brand text-white ring-4 ring-brand/20" : "bg-brand/80 text-white"
                }`}
              >
                {i + 1}
              </span>
              <span>
                <span className="block text-sm font-medium">{s.title}</span>
                <span className="mt-1 block text-xs leading-relaxed text-muted">{s.text}</span>
              </span>
            </button>
          </li>
          );
        })}
      </ol>
      <p className="border-t border-line px-5 py-3 text-xs text-muted">
        Want to try your own data? Use <span className="font-medium text-ink">Load your data</span> with an HR roster and an
        accounts export (sample CSVs to copy the format are inside). Everything runs in your browser; nothing is uploaded.
      </p>
    </section>
  );
}
