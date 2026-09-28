import { useState } from "react";
import type { Decision, Finding } from "@/lib/types";
import type { Ctx } from "./context";
import { reviewerLabel } from "./context";
import { DecisionButtons, SeverityBadge } from "./ui";

const COMMENT_HINT: Record<Decision, string> = {
  keep: "Business justification for keeping this access (auditors expect one)…",
  revoke: "Ticket number or note for the revocation…",
  escalate: "What should security or audit look at?…",
};

export default function FindingItem({ f, ctx, showReviewer = true }: { f: Finding; ctx: Ctx; showReviewer?: boolean }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const d = ctx.decisions[f.id];
  const onDecide = (x: Decision | undefined) => {
    ctx.decide(f.id, x);
    setEditing(Boolean(x)); // choosing a decision opens the comment box; clearing it closes it
  };
  return (
    <li className="px-4 py-3 sm:px-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex min-w-0 flex-1 items-start gap-3 text-left">
          <svg viewBox="0 0 20 20" className={`mt-0.5 size-4 shrink-0 text-muted transition ${open ? "rotate-90" : ""}`} fill="currentColor" aria-hidden>
            <path d="M7 5l6 5-6 5V5z" />
          </svg>
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2">
              <SeverityBadge severity={f.severity} />
              <span className="text-sm font-medium">{f.title}</span>
              <span className="font-mono text-[11px] text-muted">{f.ruleId}</span>
            </span>
            <span className="mt-0.5 block truncate text-xs text-muted">
              {f.subject} · {f.system}
              {showReviewer && <> · reviewer: {reviewerLabel(ctx, f.reviewerId)}</>}
            </span>
          </span>
        </button>
        <div className="pl-7 sm:pl-0">
          <DecisionButtons current={d?.decision} onDecide={onDecide} />
        </div>
      </div>
      {d && (
        <div className="mt-2 sm:ml-7">
          {editing ? (
            <label className="block">
              <span className="sr-only">Reviewer comment</span>
              <textarea
                autoFocus
                value={d.comment}
                onChange={(e) => ctx.comment(f.id, e.target.value)}
                onBlur={() => setEditing(false)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    setEditing(false);
                  }
                }}
                rows={2}
                placeholder={COMMENT_HINT[d.decision]}
                className="block w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand"
              />
              <span className="mt-1 block text-[11px] text-muted">Saved as you type · Enter to close · Shift+Enter for a new line</span>
            </label>
          ) : d.comment ? (
            <button type="button" onClick={() => setEditing(true)} className="block w-full rounded-md px-2 py-1 text-left text-xs text-muted hover:bg-canvas">
              <span className="italic">“{d.comment}”</span> <span className="ml-1 text-brand">Edit</span>
            </button>
          ) : (
            <button type="button" onClick={() => setEditing(true)} className="px-2 py-1 text-xs text-brand hover:underline">
              + Add comment
            </button>
          )}
        </div>
      )}
      {open && (
        <div className="mt-3 space-y-3 rounded-lg bg-canvas p-4 text-sm sm:ml-7">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Evidence</p>
            <p className="mt-1">{f.evidence}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Recommendation</p>
            <p className="mt-1">{f.recommendation}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Accounts</p>
              <p className="mt-1 font-mono text-xs">{f.accountIds.join(", ")}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Identity</p>
              {f.employeeId ? (
                <button type="button" className="mt-1 text-brand hover:underline" onClick={() => ctx.openIdentity(f.employeeId)}>
                  Open {f.subject}
                </button>
              ) : (
                <p className="mt-1 text-muted">Not linked to an employee</p>
              )}
            </div>
          </div>
          {!d && <p className="text-xs text-muted">Choose Keep, Revoke or Escalate to add a reviewer comment.</p>}
        </div>
      )}
    </li>
  );
}
