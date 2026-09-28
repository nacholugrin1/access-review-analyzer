import { useState } from "react";
import type { Finding } from "@/lib/types";
import type { Ctx } from "./context";
import { reviewerLabel, sortFindings } from "./context";
import FindingItem from "./FindingItem";
import { Card } from "./ui";

// A review campaign sends each reviewer (usually the manager) only the
// decisions that are theirs to make. This view is that inbox, per reviewer.
export default function ReviewView({ ctx }: { ctx: Ctx }) {
  const groups = new Map<string, Finding[]>();
  for (const f of ctx.result.findings) groups.set(f.reviewerId, [...(groups.get(f.reviewerId) ?? []), f]);
  const reviewers = [...groups.entries()]
    .map(([id, list]) => ({ id, list: list.sort(sortFindings), pending: list.filter((f) => !ctx.decisions[f.id]).length }))
    .sort((a, b) => b.pending - a.pending || b.list.length - a.list.length);
  const [active, setActive] = useState(reviewers[0]?.id ?? "");
  const current = reviewers.find((r) => r.id === active) ?? reviewers[0];

  return (
    <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
      <Card className="h-fit">
        <div className="border-b border-line px-5 py-3.5">
          <h2 className="text-sm font-semibold">Reviewers</h2>
          <p className="mt-0.5 text-xs text-muted">{reviewers.length} people · sorted by pending decisions</p>
        </div>
        <ul className="max-h-[32rem] divide-y divide-line overflow-y-auto">
          {reviewers.map((r) => (
            <li key={r.id || "system"}>
              <button
                type="button"
                onClick={() => setActive(r.id)}
                aria-current={current?.id === r.id}
                className={`flex w-full items-center justify-between gap-3 px-5 py-2.5 text-left ${current?.id === r.id ? "bg-brand-soft" : "hover:bg-canvas"}`}
              >
                <span className="min-w-0 truncate text-sm">{reviewerLabel(ctx, r.id)}</span>
                <span className={`tabular shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${r.pending ? "bg-high-soft text-high" : "bg-ok-soft text-ok"}`}>
                  {r.pending ? `${r.pending} pending` : "done"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Card>

      {current && (
        <Card>
          <div className="border-b border-line px-5 py-3.5">
            <h2 className="text-sm font-semibold">{reviewerLabel(ctx, current.id)}</h2>
            <p className="mt-0.5 text-xs text-muted">
              {current.list.length} decisions · {current.pending} pending. Keep = access confirmed as needed · Revoke = remove it · Escalate = needs security or audit input.
            </p>
          </div>
          <ul className="divide-y divide-line">
            {current.list.map((f) => (
              <FindingItem key={f.id} f={f} ctx={ctx} showReviewer={false} />
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
