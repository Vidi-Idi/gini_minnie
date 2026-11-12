"use client";

import { useEffect, useMemo, useState } from "react";
import { HoldingInput, pct, summarize, usd, validate } from "@/lib/portfolio";

const STORAGE_KEY = "gini_minnie.portfolio.v1";

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

export default function PortfolioInput() {
  // Until the database is connected, the draft portfolio is kept in this browser.
  // This component renders client-only (see PortfolioInputClient), so reading storage here is safe.
  const [rows, setRows] = useState<HoldingInput[]>(loadRows);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
    } catch {}
  }, [rows]);

  const errors = useMemo(() => validate(rows), [rows]);
  const { rows: summary, total, lockedTotal } = useMemo(() => summarize(rows), [rows]);

  const update = (id: string, patch: Partial<HoldingInput>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const remove = (id: string) =>
    setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.id !== id) : [newRow()]));

  return (
    <section className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Total portfolio value" value={usd(total)} />
        <Stat label="Holdings" value={String(summary.filter((r) => r.amountUsd > 0).length)} />
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
              <tr key={r.id} className="border-b border-line last:border-0 align-top">
                <td className="px-4 py-2">
                  <input
                    aria-label="Ticker"
                    value={r.ticker}
                    onChange={(e) => update(r.id, { ticker: e.target.value.toUpperCase() })}
                    placeholder="AAPL"
                    className="w-24 rounded-md border border-line bg-transparent px-2 py-1.5 font-mono uppercase outline-none focus:border-accent"
                  />
                  {errors[r.id] && <p className="mt-1 text-xs text-danger">{errors[r.id]}</p>}
                </td>
                <td className="px-4 py-2">
                  <input
                    aria-label="Amount in dollars"
                    inputMode="decimal"
                    value={r.amount}
                    onChange={(e) => update(r.id, { amount: e.target.value })}
                    placeholder="10,000"
                    className="w-32 rounded-md border border-line bg-transparent px-2 py-1.5 tabular-nums outline-none focus:border-accent"
                  />
                </td>
                <td className="hidden px-4 py-2 pt-3.5 text-right tabular-nums sm:table-cell">
                  {r.amountUsd > 0 ? pct(r.weight) : "—"}
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

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => setRows((rs) => [...rs, newRow()])}
          className="rounded-lg border border-line bg-surface px-4 py-2 text-sm hover:border-accent"
        >
          + Add holding
        </button>
        <button
          type="button"
          disabled
          title="Coming next: requires the market data layer"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white opacity-50"
        >
          Analyze portfolio
        </button>
      </div>
    </section>
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
