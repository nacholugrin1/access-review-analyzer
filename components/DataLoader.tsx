import { useState } from "react";
import { ACCOUNT_COLUMNS, HR_COLUMNS, parseAccounts, parseEmployees } from "@/lib/csv";
import type { Account, Employee } from "@/lib/types";
import { Button } from "./ui";

export default function DataLoader({
  onClose,
  onLoad,
  onSample,
  defaultAsOf,
}: {
  onClose: () => void;
  onLoad: (e: Employee[], a: Account[], label: string, asOf: string) => void;
  onSample: () => void;
  defaultAsOf: string;
}) {
  const [hrText, setHrText] = useState<{ name: string; text: string } | null>(null);
  const [accText, setAccText] = useState<{ name: string; text: string } | null>(null);
  const [asOf, setAsOf] = useState(defaultAsOf);
  const [errors, setErrors] = useState<string[]>([]);

  const read = (file: File | undefined, set: (v: { name: string; text: string }) => void) => {
    if (file) void file.text().then((text) => set({ name: file.name, text }));
  };

  const run = () => {
    if (!hrText || !accText) return setErrors(["Choose both files."]);
    const e = parseEmployees(hrText.text);
    const a = parseAccounts(accText.text);
    const all = [...e.errors, ...a.errors];
    if (!e.rows.length || !a.rows.length || all.length) return setErrors(all.length ? all : ["No valid rows found."]);
    onLoad(e.rows, a.rows, `${hrText.name} + ${accText.name}`, asOf);
  };

  const fileBox = (label: string, cols: readonly string[], value: { name: string } | null, onPick: (f?: File) => void) => (
    <label className="block rounded-lg border border-dashed border-line p-4 hover:border-brand">
      <span className="text-sm font-medium">{label}</span>
      <span className="mt-1 block font-mono text-[11px] leading-relaxed text-muted">{cols.join(", ")}</span>
      <input type="file" accept=".csv,text/csv" onChange={(e) => onPick(e.target.files?.[0])} className="mt-3 block w-full text-sm" />
      {value && <span className="mt-1 block text-xs text-ok">Loaded {value.name}</span>}
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4" role="dialog" aria-modal="true" aria-labelledby="loader-title">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="loader-title" className="text-base font-semibold">
              Load your data
            </h2>
            <p className="mt-1 text-sm text-muted">
              Two CSV files. They are read by this page in your browser and never sent anywhere. Multiple entitlements go in one cell,
              separated by semicolons.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-muted hover:bg-canvas">
            ✕
          </button>
        </div>
        <div className="mt-5 space-y-3">
          {fileBox("HR roster", HR_COLUMNS, hrText, (f) => read(f, setHrText))}
          {fileBox("Accounts and entitlements (all systems)", ACCOUNT_COLUMNS, accText, (f) => read(f, setAccText))}
          <label className="block text-sm">
            <span className="font-medium">Review date</span>
            <input
              type="date"
              value={asOf}
              onChange={(e) => setAsOf(e.target.value)}
              className="mt-1 block rounded-lg border border-line px-2.5 py-1.5 text-sm outline-none focus:border-brand"
            />
          </label>
        </div>
        {errors.length > 0 && (
          <ul className="mt-4 space-y-1 rounded-lg bg-crit-soft px-4 py-3 text-xs text-crit">
            {errors.slice(0, 8).map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted">
            Templates:{" "}
            <a className="text-brand hover:underline" href="sample/hr.csv" download>
              hr.csv
            </a>{" "}
            ·{" "}
            <a className="text-brand hover:underline" href="sample/accounts.csv" download>
              accounts.csv
            </a>
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onSample}>
              Use sample data
            </Button>
            <Button variant="primary" onClick={run}>
              Analyse
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
