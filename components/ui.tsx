import type { Decision, Severity } from "@/lib/types";

export const SEVERITY_STYLE: Record<Severity, { label: string; chip: string; bar: string }> = {
  critical: { label: "Critical", chip: "bg-crit-soft text-crit ring-crit/20", bar: "bg-crit" },
  high: { label: "High", chip: "bg-high-soft text-high ring-high/20", bar: "bg-high" },
  medium: { label: "Medium", chip: "bg-med-soft text-med ring-med/20", bar: "bg-med-bar" },
  low: { label: "Low", chip: "bg-low-soft text-low ring-low/20", bar: "bg-low" },
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  const s = SEVERITY_STYLE[severity];
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${s.chip}`}>
      {s.label}
    </span>
  );
}

export const DECISION_LABEL: Record<Decision, string> = {
  keep: "Keep",
  revoke: "Revoke",
  escalate: "Escalate",
};

export function DecisionBadge({ decision }: { decision?: Decision }) {
  if (!decision) return <span className="text-xs text-muted">Pending</span>;
  const cls =
    decision === "revoke"
      ? "bg-crit-soft text-crit"
      : decision === "keep"
        ? "bg-ok-soft text-ok"
        : "bg-brand-soft text-brand";
  return <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${cls}`}>{DECISION_LABEL[decision]}</span>;
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-line bg-white ${className}`}>{children}</section>;
}

export function CardHeader({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-3.5">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

export function Kpi({ label, value, sub, tone }: { label: string; value: string | number; sub?: string; tone?: "crit" }) {
  return (
    <Card className="px-5 py-4">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className={`tabular mt-1 text-2xl font-semibold ${tone === "crit" ? "text-crit" : ""}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
    </Card>
  );
}

export function Button({
  children,
  onClick,
  variant = "secondary",
  className = "",
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
  type?: "button" | "submit";
}) {
  const base = "inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";
  const styles = {
    primary: "bg-brand text-white hover:bg-brand/90",
    secondary: "border border-line bg-white text-ink hover:bg-canvas",
    ghost: "text-brand hover:bg-brand-soft",
  }[variant];
  return (
    <button type={type} onClick={onClick} className={`${base} ${styles} ${className}`}>
      {children}
    </button>
  );
}

export function DecisionButtons({
  current,
  onDecide,
}: {
  current?: Decision;
  onDecide: (d: Decision | undefined) => void;
}) {
  const opts: { d: Decision; on: string }[] = [
    { d: "keep", on: "bg-ok text-white border-ok" },
    { d: "revoke", on: "bg-crit text-white border-crit" },
    { d: "escalate", on: "bg-brand text-white border-brand" },
  ];
  return (
    <div className="inline-flex overflow-hidden rounded-lg border border-line" role="group" aria-label="Review decision">
      {opts.map(({ d, on }) => (
        <button
          key={d}
          type="button"
          aria-pressed={current === d}
          onClick={() => onDecide(current === d ? undefined : d)}
          className={`border-l border-line px-2.5 py-1 text-xs font-medium first:border-l-0 ${
            current === d ? on : "bg-white text-muted hover:bg-canvas hover:text-ink"
          }`}
        >
          {DECISION_LABEL[d]}
        </button>
      ))}
    </div>
  );
}

export function download(filename: string, content: string, type = "text/csv;charset=utf-8") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
