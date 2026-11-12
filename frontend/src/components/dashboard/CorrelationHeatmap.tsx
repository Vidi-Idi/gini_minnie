"use client";

import { useState } from "react";
import { Analysis } from "@/lib/api";

/** Diverging scale: red (−1) → neutral gray (0) → blue (+1), mixed in OKLab. */
function cellColor(r: number) {
  const pole = r >= 0 ? "var(--div-pos)" : "var(--div-neg)";
  return `color-mix(in oklab, ${pole} ${Math.round(Math.abs(r) * 100)}%, var(--div-mid))`;
}

export default function CorrelationHeatmap({ data }: { data: Analysis }) {
  const tickers = data.holdings.map((h) => h.ticker);
  const [hover, setHover] = useState<[string, string] | null>(null);
  const n = tickers.length;
  const value = hover ? data.correlation[hover[0]][hover[1]] : null;

  return (
    <div>
      <div className="overflow-x-auto">
        <div
          className="grid gap-0.5 text-[11px]"
          style={{ gridTemplateColumns: `auto repeat(${n}, minmax(36px, 1fr))` }}
          role="table"
          aria-label="Correlation matrix of daily returns"
        >
          <div />
          {tickers.map((t) => (
            <div key={t} className="truncate pb-1 text-center font-mono text-muted" role="columnheader">
              {t}
            </div>
          ))}
          {tickers.map((a) => (
            <div key={a} className="contents" role="row">
              <div className="truncate pr-2 text-right font-mono leading-9 text-muted" role="rowheader">
                {a}
              </div>
              {tickers.map((b) => {
                const r = data.correlation[a][b];
                const active = hover && hover[0] === a && hover[1] === b;
                return (
                  <div
                    key={b}
                    role="cell"
                    onMouseEnter={() => setHover([a, b])}
                    onMouseLeave={() => setHover(null)}
                    className={`flex h-9 items-center justify-center rounded tabular-nums ${active ? "ring-2 ring-foreground" : ""} ${Math.abs(r) > 0.6 ? "text-white" : "text-foreground"}`}
                    style={{ background: cellColor(r) }}
                    title={`${a} vs ${b}: ${r.toFixed(2)}`}
                  >
                    {n <= 10 ? r.toFixed(2) : ""}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <div className="flex items-center gap-2">
          <span>−1</span>
          <span
            className="h-2 w-32 rounded-full"
            style={{
              background:
                "linear-gradient(to right, var(--div-neg), var(--div-mid), var(--div-pos))",
            }}
          />
          <span>+1</span>
        </div>
        <span className="tabular-nums">
          {hover ? `${hover[0]} vs ${hover[1]}: ${value!.toFixed(2)}` : "Hover a cell for details"}
        </span>
      </div>
    </div>
  );
}
