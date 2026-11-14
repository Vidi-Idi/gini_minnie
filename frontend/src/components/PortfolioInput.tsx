"use client";

import { useEffect, useMemo, useState } from "react";
import { Analysis, AnalyzeError, analyzePortfolio, wakeBackend } from "@/lib/api";
import {
  HoldingInput,
  normalizeTicker,
  parseAmount,
  pct,
  summarize,
  usd,
  validate,
} from "@/lib/portfolio";
import Dashboard from "./dashboard/Dashboard";

const STORAGE_KEY = "gini_minnie.portfolio.v1";
const BENCH_KEY = "gini_minnie.benchmark.v1";
const BENCHMARKS = [
  { value: "SPY", label: "S&P 500 (SPY)" },
  { value: "QQQ", label: "Nasdaq-100 (QQQ)" },
  { value: "DIA", label: "Dow Jones (DIA)" },
  { value: "IWM", label: "Russell 2000 (IWM)" },
];

const newRow = (): HoldingInput => ({
  id: crypto.randomUUID(),
  ticker: "",
  amount: "",
  locked: false,
});

function loadRows(): HoldingInput[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const parsed = saved ? (JSON.parse(saved) as HoldingInput[]) : [];
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch {}
  return [newRow()];
}

function loadBenchmark(): string {
  try {
    return localStorage.getItem(BENCH_KEY) || "SPY";
  } catch {
    return "SPY";
  }
}

export default function PortfolioInput() {
  // Until the database is connected, the draft portfolio is kept in this browser.
  // This component renders client-only (see PortfolioInputClient), so reading storage here is safe.
  const [rows, setRows] = useState<HoldingInput[]>(loadRows);
  const [benchmark, setBenchmark] = useState<string>(loadBenchmark);
  const [customBench, setCustomBench] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});

  const [slow, setSlow] = useState(false);

  useEffect(() => {
    wakeBackend();
  }, []);

  useEffect(() => {
    if (!loading) return;
    const t = setTimeout(() => setSlow(true), 6000);
    return () => {
      clearTimeout(t);
      setSlow(false);
    };
  }, [loading]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
      localStorage.setItem(BENCH_KEY, benchmark);
    } catch {}
  }, [rows, benchmark]);

  const errors = useMemo(() => validate(rows), [rows]);
  const { rows: summary, total, lockedTotal } = useMemo(() => summarize(rows), [rows]);
  const filled = summary.filter((r) => r.ticker.trim() && r.amountUsd > 0);
  const canAnalyze = filled.length > 0 && Object.keys(errors).length === 0 && !loading;

  const update = (id: string, patch: Partial<HoldingInput>) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    setServerErrors({});
  };
  const remove = (id: string) =>
    setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.id !== id) : [newRow()]));

  async function runAnalysis() {
    setLoading(true);
    setError(null);
    setServerErrors({});
    try {
      const result = await analyzePortfolio(
        filled.map((r) => ({
          ticker: normalizeTicker(r.ticker),
          amount_usd: r.amountUsd,
          locked: r.locked,
        })),
        normalizeTicker(benchmark) || "SPY",
      );
      setAnalysis(result);
    } catch (e) {
      const err = e instanceof AnalyzeError ? e : new AnalyzeError(String(e));
      setError(err.message);
      setServerErrors(err.tickerErrors);
    } finally {
      setLoading(false);
    }
  }

  const rowError = (r: HoldingInput) =>
    errors[r.id] ?? serverErrors[normalizeTicker(r.ticker)]?.replace(/^[^:]+:\s*/, "");
  const benchError = serverErrors[normalizeTicker(benchmark)];

  return (
    <div className="space-y-8">
      <section className="space-y-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Stat label="Total portfolio value" value={usd(total)} />
          <Stat label="Holdings" value={String(filled.length)} />
          <Stat
            label="Locked (never sold)"
            value={total > 0 ? `${usd(lockedTotal)} · ${pct(lockedTotal / total)}` : usd(0)}
          />
        </div>

        <div className="overflow-hidden rounded-xl border border-line bg-surface">
          <table className="w-full text-sm">
            <thead className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Ticker</th>
                <th className="px-4 py-3 font-medium">Amount ($)</th>
                <th className="hidden px-4 py-3 text-right font-medium sm:table-cell">Weight</th>
                <th className="px-4 py-3 text-center font-medium">Lock</th>
                <th className="px-2 py-3" aria-label="Remove" />
              </tr>
            </thead>
            <tbody>
              {summary.map((r) => (
                <tr key={r.id} className="border-b border-line align-top last:border-0">
                  <td className="px-4 py-2">
                    <input
                      aria-label="Ticker"
                      value={r.ticker}
                      onChange={(e) => update(r.id, { ticker: e.target.value.toUpperCase() })}
                      placeholder="AAPL"
                      className="w-24 rounded-md border border-line bg-transparent px-2 py-1.5 font-mono uppercase outline-none focus:border-accent"
                    />
                    {rowError(r) && <p className="mt-1 text-xs text-danger">{rowError(r)}</p>}
                  </td>
                  <td className="px-4 py-2">
                    <input
                      aria-label="Amount in dollars"
                      inputMode="decimal"
                      value={r.amount}
                      onChange={(e) => update(r.id, { amount: e.target.value })}
                      onKeyDown={(e) => e.key === "Enter" && canAnalyze && runAnalysis()}
                      placeholder="10,000"
                      className="w-32 rounded-md border border-line bg-transparent px-2 py-1.5 tabular-nums outline-none focus:border-accent"
                    />
                  </td>
                  <td className="hidden px-4 py-2 pt-3.5 text-right tabular-nums sm:table-cell">
                    {parseAmount(r.amount) > 0 ? pct(r.weight) : "—"}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => update(r.id, { locked: !r.locked })}
                      aria-pressed={r.locked}
                      aria-label={r.locked ? `Unlock ${r.ticker || "holding"}` : `Lock ${r.ticker || "holding"}`}
                      title={r.locked ? "Locked: suggestions will never sell this" : "Lock this holding"}
                      className={`rounded-md px-2 py-1.5 ${r.locked ? "bg-accent/15 text-accent" : "text-muted hover:text-foreground"}`}
                    >
                      {r.locked ? "🔒" : "🔓"}
                    </button>
                  </td>
                  <td className="px-2 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => remove(r.id)}
                      aria-label={`Remove ${r.ticker || "row"}`}
                      className="rounded-md px-2 py-1.5 text-muted hover:text-danger"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <button
            type="button"
            onClick={() => setRows((rs) => [...rs, newRow()])}
            className="rounded-lg border border-line bg-surface px-4 py-2 text-sm hover:border-accent"
          >
            + Add holding
          </button>

          <label className="ml-auto flex flex-col text-xs text-muted">
            Compare with
            <div className="mt-1 flex gap-2">
              {customBench ? (
                <input
                  aria-label="Benchmark ticker"
                  value={benchmark}
                  onChange={(e) => setBenchmark(e.target.value.toUpperCase())}
                  placeholder="Ticker"
                  className="w-28 rounded-lg border border-line bg-surface px-2 py-2 font-mono text-sm text-foreground uppercase outline-none focus:border-accent"
                />
              ) : (
                <select
                  aria-label="Benchmark"
                  value={BENCHMARKS.some((b) => b.value === benchmark) ? benchmark : ""}
                  onChange={(e) =>
                    e.target.value === "__custom" ? setCustomBench(true) : setBenchmark(e.target.value)
                  }
                  className="rounded-lg border border-line bg-surface px-2 py-2 text-sm text-foreground outline-none focus:border-accent"
                >
                  {!BENCHMARKS.some((b) => b.value === benchmark) && (
                    <option value="">{benchmark}</option>
                  )}
                  {BENCHMARKS.map((b) => (
                    <option key={b.value} value={b.value}>
                      {b.label}
                    </option>
                  ))}
                  <option value="__custom">Other ticker…</option>
                </select>
              )}
              {customBench && (
                <button
                  type="button"
                  onClick={() => setCustomBench(false)}
                  className="text-xs text-muted underline"
                >
                  list
                </button>
              )}
            </div>
            {benchError && <span className="mt-1 text-danger">{benchError}</span>}
          </label>

          <button
            type="button"
            onClick={runAnalysis}
            disabled={!canAnalyze}
            className="rounded-lg bg-accent px-5 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-50"
          >
            {loading ? "Analyzing…" : analysis ? "Re-analyze" : "Analyze portfolio"}
          </button>
        </div>
        {slow && (
          <p className="text-sm text-muted">
            Waking up the analysis server. The first request after a quiet period can take up to a
            minute.
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
      </section>

      {loading && !analysis && (
        <div className="h-96 animate-pulse rounded-xl border border-line bg-surface" />
      )}
      {analysis && (
        <section className={`space-y-4 transition-opacity ${loading ? "opacity-50" : ""}`}>
          <h2 className="text-2xl font-semibold tracking-tight">Analysis</h2>
          <Dashboard data={analysis} />
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}
