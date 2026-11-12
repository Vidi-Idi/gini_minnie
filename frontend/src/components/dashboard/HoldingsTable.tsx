import { Analysis } from "@/lib/api";
import { pct, usd } from "@/lib/portfolio";
import { Delta } from "./Card";

export default function HoldingsTable({ data }: { data: Analysis }) {
  return (
    <div className="-mx-4 overflow-x-auto sm:mx-0">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="border-b border-line text-left text-xs text-muted">
          <tr>
            <th className="px-4 py-2 font-medium sm:pl-0">Holding</th>
            <th className="px-3 py-2 text-right font-medium">Value</th>
            <th className="px-3 py-2 text-right font-medium">Weight</th>
            <th className="px-3 py-2 text-right font-medium">1Y return</th>
            <th className="px-3 py-2 text-right font-medium" title="Weight × 1Y return">
              Contribution
            </th>
            <th className="px-3 py-2 text-right font-medium">Volatility</th>
            <th
              className="px-4 py-2 text-right font-medium sm:pr-0"
              title="Share of total portfolio risk (variance). Compare with the weight."
            >
              Share of risk
            </th>
          </tr>
        </thead>
        <tbody>
          {data.holdings.map((h) => {
            const riskHeavy = (h.risk_contribution ?? 0) > h.weight * 1.25;
            return (
              <tr key={h.ticker} className="border-b border-line last:border-0">
                <td className="px-4 py-2.5 sm:pl-0">
                  <div className="flex items-center gap-1.5 font-mono font-medium">
                    {h.ticker}
                    {h.locked && <span title="Locked: never sold">🔒</span>}
                    {h.quote_type === "ETF" && (
                      <span className="rounded bg-line px-1 font-sans text-[10px] text-muted">ETF</span>
                    )}
                  </div>
                  <div className="max-w-[220px] truncate text-xs text-muted">
                    {h.name} · {h.exchange}
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">{usd(h.amount_usd)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{pct(h.weight)}</td>
                <td className="px-3 py-2.5 text-right"><Delta value={h.return_1y} /></td>
                <td className="px-3 py-2.5 text-right"><Delta value={h.contribution_to_return} /></td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {h.annual_volatility == null ? "—" : pct(h.annual_volatility)}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums sm:pr-0">
                  {h.risk_contribution == null ? "—" : pct(h.risk_contribution)}
                  {riskHeavy && (
                    <span className="ml-1 text-xs text-muted" title="Carries noticeably more risk than its weight">
                      ▲
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
