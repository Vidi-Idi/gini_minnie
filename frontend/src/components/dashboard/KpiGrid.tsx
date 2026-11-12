import { Analysis } from "@/lib/api";
import { num, pct, signedPct, usd } from "@/lib/portfolio";
import { Delta } from "./Card";

type Tile = { label: string; value: React.ReactNode; hint?: string; title?: string };

export default function KpiGrid({ data }: { data: Analysis }) {
  const k = data.kpis;
  const vsBench =
    k.return_1y != null && k.benchmark_return_1y != null
      ? `${data.benchmark} ${signedPct(k.benchmark_return_1y)}`
      : undefined;

  const returns: Tile[] = [
    { label: "Total value", value: usd(k.total_usd) },
    { label: "1 day", value: <Delta value={k.return_1d} digits={2} /> },
    { label: "1 month", value: <Delta value={k.return_1m} /> },
    { label: "3 months", value: <Delta value={k.return_3m} /> },
    { label: "Year to date", value: <Delta value={k.return_ytd} /> },
    { label: "1 year", value: <Delta value={k.return_1y} />, hint: vsBench },
  ];
  const risk: Tile[] = [
    {
      label: "Volatility",
      value: pct(k.annual_volatility),
      title: "Annualized standard deviation of daily returns",
    },
    {
      label: "Sharpe ratio",
      value: num(k.sharpe),
      title: "Return above the risk-free rate per unit of volatility. Above 1 is good.",
    },
    {
      label: "Sortino ratio",
      value: num(k.sortino),
      title: "Like Sharpe, but only counts downside volatility",
    },
    {
      label: "Max drawdown",
      value: <span className="tabular-nums">{signedPct(k.max_drawdown)}</span>,
      title: "Largest peak-to-trough fall over the year",
    },
    {
      label: `Beta vs ${data.benchmark}`,
      value: num(k.beta),
      title: "1.0 moves with the benchmark; below 1 moves less",
    },
    {
      label: "Diversification",
      value: `${k.effective_holdings.toFixed(1)} of ${k.holdings_count}`,
      title: "Effective number of holdings (1 / sum of squared weights)",
    },
    {
      label: "Dividend yield",
      value: k.dividend_yield == null ? "—" : pct(k.dividend_yield),
    },
    {
      label: "P/E (stocks)",
      value: k.pe_ratio == null ? "—" : k.pe_ratio.toFixed(1),
      title: "Weighted harmonic mean of trailing P/E over stocks",
    },
  ];

  return (
    <div className="space-y-3">
      <Row tiles={returns} cols="grid-cols-2 sm:grid-cols-3 lg:grid-cols-6" />
      <Row tiles={risk} cols="grid-cols-2 sm:grid-cols-4" />
    </div>
  );
}

function Row({ tiles, cols }: { tiles: Tile[]; cols: string }) {
  return (
    <div className={`grid gap-3 ${cols}`}>
      {tiles.map((t) => (
        <div key={t.label} title={t.title} className="rounded-xl border border-line bg-surface px-4 py-3">
          <div className="text-xs text-muted">{t.label}</div>
          <div className="mt-1 text-lg font-semibold tabular-nums">{t.value}</div>
          {t.hint && <div className="mt-0.5 text-xs text-muted">{t.hint}</div>}
        </div>
      ))}
    </div>
  );
}
