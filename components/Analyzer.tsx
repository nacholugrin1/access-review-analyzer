"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { parseAccounts, parseEmployees } from "@/lib/csv";
import { analyze, DEFAULT_SETTINGS } from "@/lib/rules";
import type { Account, AnalysisSettings, Decision, Employee, ReviewDecision } from "@/lib/types";
import type { Ctx, FindingFilter } from "./context";
import DataLoader from "./DataLoader";
import FindingsView from "./FindingsView";
import HowToUse from "./HowToUse";
import IdentitiesView from "./IdentitiesView";
import Overview from "./Overview";
import PolicyView from "./PolicyView";
import ReportView from "./ReportView";
import ReviewView from "./ReviewView";

type Tab = "overview" | "findings" | "review" | "identities" | "policy" | "report";
const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "findings", label: "Findings" },
  { id: "review", label: "Review campaign" },
  { id: "identities", label: "Identities" },
  { id: "policy", label: "Policy & settings" },
  { id: "report", label: "Audit report" },
];

const SAMPLE_LABEL = "Sample: Northwind Payments (fictitious)";
const GUIDE_KEY = "ara.guide.v1";
const noopSubscribe = () => () => {};
function readGuideHidden(): boolean {
  try {
    return localStorage.getItem(GUIDE_KEY) === "hidden";
  } catch {
    return false;
  }
}

// Reviewer decisions are kept in this browser only (localStorage), per dataset.
const storageKey = (label: string) => `ara.decisions.v1:${label}`;
function readDecisions(label: string): Record<string, ReviewDecision> {
  try {
    return JSON.parse(localStorage.getItem(storageKey(label)) ?? "{}");
  } catch {
    return {};
  }
}
function writeDecisions(label: string, d: Record<string, ReviewDecision>) {
  try {
    localStorage.setItem(storageKey(label), JSON.stringify(d));
  } catch {
    /* storage unavailable (private mode): decisions live for this session only */
  }
}

async function fetchSample() {
  const [hr, acc] = await Promise.all(
    ["sample/hr.csv", "sample/accounts.csv"].map((p) =>
      fetch(p).then((r) => {
        if (!r.ok) throw new Error(`${p}: HTTP ${r.status}`);
        return r.text();
      }),
    ),
  );
  return { hr, acc };
}

export default function Analyzer() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [datasetLabel, setDatasetLabel] = useState("");
  const [settings, setSettings] = useState<AnalysisSettings>(DEFAULT_SETTINGS);
  const [decisions, setDecisions] = useState<Record<string, ReviewDecision>>({});
  const [tab, setTab] = useState<Tab>("overview");
  const [filter, setFilter] = useState<FindingFilter>({});
  const [identity, setIdentity] = useState<string | null>(null);
  const [loaderOpen, setLoaderOpen] = useState(false);
  const [loadError, setLoadError] = useState("");
  // The "How to use" guide shows on the first visit; "Got it" hides it, the header button brings it back.
  // Read from the browser only (the server render assumes "hidden" so the static HTML stays stable).
  const guideHiddenStored = useSyncExternalStore(noopSubscribe, readGuideHidden, () => true);
  const [guideReopened, setGuideReopened] = useState(false);
  const [guideDismissed, setGuideDismissed] = useState(false);
  const guideOpen = guideReopened || (!guideHiddenStored && !guideDismissed);
  const setGuideOpen = (open: boolean) => setGuideReopened(open);
  const closeGuide = () => {
    setGuideReopened(false);
    setGuideDismissed(true);
    try {
      localStorage.setItem(GUIDE_KEY, "hidden");
    } catch {
      /* storage unavailable: the guide simply shows again next visit */
    }
  };

  const loadDataset = useCallback((emps: Employee[], accs: Account[], label: string, asOf?: string) => {
    setEmployees(emps);
    setAccounts(accs);
    setDatasetLabel(label);
    setDecisions(readDecisions(label));
    if (asOf) setSettings((s) => ({ ...s, asOf }));
    setFilter({});
    setIdentity(null);
  }, []);

  const loadSample = useCallback(() => {
    // State is only set in the promise callbacks, once the files have arrived.
    fetchSample()
      .then(({ hr, acc }) => {
        setLoadError("");
        loadDataset(parseEmployees(hr).rows, parseAccounts(acc).rows, SAMPLE_LABEL, DEFAULT_SETTINGS.asOf);
      })
      .catch((e: Error) => setLoadError(`Could not load the sample dataset (${e.message}).`));
  }, [loadDataset]);

  useEffect(() => {
    loadSample();
  }, [loadSample]);

  const result = useMemo(() => analyze(employees, accounts, settings), [employees, accounts, settings]);
  const byEmp = useMemo(() => new Map(employees.map((e) => [e.employeeId, e])), [employees]);

  const update = useCallback(
    (fn: (d: Record<string, ReviewDecision>) => Record<string, ReviewDecision>) =>
      setDecisions((prev) => {
        const next = fn(prev);
        writeDecisions(datasetLabel, next);
        return next;
      }),
    [datasetLabel],
  );

  const ctx: Ctx = {
    result,
    employees,
    accounts,
    byEmp,
    decisions,
    datasetLabel,
    decide: (id, d?: Decision) =>
      update((prev) => {
        const next = { ...prev };
        if (!d) delete next[id];
        else next[id] = { decision: d, comment: prev[id]?.comment ?? "", decidedAt: new Date().toISOString() };
        return next;
      }),
    // A comment always belongs to a decision: without one, there is nothing to comment on.
    comment: (id, text) =>
      update((prev) => (prev[id] ? { ...prev, [id]: { ...prev[id], comment: text } } : prev)),
    openIdentity: (id) => {
      setIdentity(id);
      setTab("identities");
    },
    showFindings: (f) => {
      setFilter(f);
      setTab("findings");
    },
  };

  const total = result.findings.length;
  const decided = result.findings.filter((f) => ctx.decisions[f.id]).length;
  const ready = employees.length > 0;

  return (
    <div className="min-h-screen">
      <header className="no-print border-b border-line bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-lg bg-brand text-white" aria-hidden>
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6l7-3z" />
                <path d="M9 12l2 2 4-4" />
              </svg>
            </div>
            <div>
              <h1 className="text-base font-semibold leading-tight">Access Review Analyzer</h1>
              <p className="text-xs text-muted">{datasetLabel || "Loading…"} · review date {settings.asOf}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setGuideOpen(true);
                setTab("overview");
              }}
              className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-brand hover:bg-brand-soft"
            >
              How to use
            </button>
            {ready && (
              <span className="tabular hidden text-xs text-muted sm:inline">
                {decided}/{total} reviewed
              </span>
            )}
            <button
              type="button"
              onClick={() => setLoaderOpen(true)}
              className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm font-medium hover:bg-canvas"
            >
              Load your data
            </button>
          </div>
        </div>
        <nav className="mx-auto max-w-7xl overflow-x-auto px-4 sm:px-6" aria-label="Sections">
          <ul className="flex gap-1">
            {TABS.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => {
                    setTab(t.id);
                    if (t.id === "findings") setFilter({});
                  }}
                  aria-current={tab === t.id ? "page" : undefined}
                  className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium ${
                    tab === t.id ? "border-brand text-brand" : "border-transparent text-muted hover:text-ink"
                  }`}
                >
                  {t.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      {datasetLabel === SAMPLE_LABEL && tab !== "report" && (
        <div className="no-print border-b border-line bg-brand-soft">
          <p className="mx-auto max-w-7xl px-4 py-2 text-xs text-brand sm:px-6">
            You are looking at a fictitious company generated for this demo. Load your own HR and account exports with
            “Load your data” — files are processed in your browser and never uploaded anywhere.
          </p>
        </div>
      )}

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {loadError && <p className="mb-4 rounded-lg bg-crit-soft px-4 py-3 text-sm text-crit">{loadError}</p>}
        {!ready && !loadError && <p className="py-20 text-center text-sm text-muted">Loading dataset…</p>}
        {ready && tab === "overview" && guideOpen && (
          <HowToUse
            onClose={closeGuide}
            onGo={(t) => {
              setTab(t);
              if (t === "findings") setFilter({});
            }}
          />
        )}
        {ready && tab === "overview" && <Overview ctx={ctx} />}
        {ready && tab === "findings" && <FindingsView ctx={ctx} initial={filter} key={JSON.stringify(filter)} />}
        {ready && tab === "review" && <ReviewView ctx={ctx} />}
        {ready && tab === "identities" && <IdentitiesView ctx={ctx} selected={identity} onSelect={setIdentity} />}
        {ready && tab === "policy" && <PolicyView ctx={ctx} settings={settings} onChange={setSettings} />}
        {ready && tab === "report" && <ReportView ctx={ctx} />}
      </main>

      <footer className="no-print mx-auto max-w-7xl px-4 pb-10 pt-4 text-xs text-muted sm:px-6">
        Built by Ignacio Lugrin · Deterministic rule engine, no data leaves the browser · Sample data is fictitious.
      </footer>

      {loaderOpen && (
        <DataLoader
          onClose={() => setLoaderOpen(false)}
          onLoad={(e, a, label, asOf) => {
            loadDataset(e, a, label, asOf);
            setLoaderOpen(false);
            setTab("overview");
          }}
          onSample={() => {
            loadSample();
            setLoaderOpen(false);
            setTab("overview");
          }}
          defaultAsOf={new Date().toISOString().slice(0, 10)}
        />
      )}
    </div>
  );
}
