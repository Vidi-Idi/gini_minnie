import { Analysis } from "@/lib/api";
import BreakdownBars from "./BreakdownBars";
import { Card } from "./Card";
import CorrelationHeatmap from "./CorrelationHeatmap";
import HoldingsTable from "./HoldingsTable";
import KpiGrid from "./KpiGrid";
import { DrawdownChart, PerformanceChart } from "./PerformanceChart";

export default function Dashboard({ data }: { data: Analysis }) {
  const highCorr = data.holdings.flatMap((a, i) =>
    data.holdings
      .slice(i + 1)
      .filter((b) => data.correlation[a.ticker][b.ticker] > 0.8)
      .map((b) => `${a.ticker} & ${b.ticker}`),
  );
  const topSector = data.sectors[0];

  return (
    <div className="space-y-4">
      {data.warnings.length > 0 && (
        <div className="rounded-lg border border-line bg-surface px-4 py-3 text-sm">
          {data.warnings.map((w) => (
            <p key={w}>⚠️ {w}</p>
          ))}
        </div>
      )}

      <KpiGrid data={data} />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <PerformanceChart data={data} />
          <DrawdownChart data={data} />
        </div>
        <Card
          title="Sector exposure"
          subtitle={
            topSector
              ? `ETFs are split into their sectors. Largest: ${topSector.label} ${(topSector.weight * 100).toFixed(0)}%.`
              : undefined
          }
        >
          <BreakdownBars slices={data.sectors} />
        </Card>
      </div>

      <Card title="Holdings" subtitle="▲ = carries noticeably more of the portfolio's risk than its weight.">
        <HoldingsTable data={data} />
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card
          title="Correlation"
          subtitle={
            highCorr.length
              ? `Highly correlated (above 0.8): ${highCorr.join(", ")}. These tend to move together.`
              : "Daily-return correlation over the year. No pairs above 0.8."
          }
          className="lg:col-span-2"
        >
          <CorrelationHeatmap data={data} />
        </Card>
        <div className="space-y-4">
          <Card title="Stocks vs ETFs">
            <BreakdownBars slices={data.asset_types} />
          </Card>
          <Card title="Company size">
            <BreakdownBars slices={data.market_caps} />
          </Card>
        </div>
      </div>
    </div>
  );
}
