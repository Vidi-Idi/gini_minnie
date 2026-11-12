"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Analysis } from "@/lib/api";
import { signedPct } from "@/lib/portfolio";
import { Card } from "./Card";

const monthTick = (d: string) =>
  new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short" });
const fullDate = (d: string) =>
  new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const axis = { stroke: "var(--muted)", fontSize: 11, tickLine: false, axisLine: false } as const;

export function PerformanceChart({ data }: { data: Analysis }) {
  const rows = data.series.dates.map((d, i) => ({
    date: d,
    // Plotted in percent points so the axis gets round ticks (0%, 5%, 10%...).
    portfolio: data.series.portfolio[i] - 100,
    benchmark: data.series.benchmark[i] - 100,
  }));
  const last = rows[rows.length - 1];

  return (
    <Card
      title="Performance vs benchmark"
      subtitle={`Cumulative return, ${fullDate(data.window_start)} – ${fullDate(data.window_end)}. Current weights held constant.`}
    >
      <div className="mb-3 flex flex-wrap gap-4 text-xs" aria-label="Legend">
        <LegendItem color="var(--series-1)" label="Portfolio" value={signedPct(last.portfolio / 100)} />
        <LegendItem color="var(--series-2)" label={data.benchmark} value={signedPct(last.benchmark / 100)} />
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--grid)" vertical={false} />
            <XAxis dataKey="date" tickFormatter={monthTick} minTickGap={32} {...axis} />
            <YAxis tickFormatter={(v) => `${v}%`} width={44} {...axis} />
            <Tooltip
              cursor={{ stroke: "var(--muted)", strokeDasharray: "3 3" }}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <TooltipBox title={fullDate(String(label))}>
                    <TooltipRow color="var(--series-1)" label="Portfolio" value={signedPct(payload[0]?.payload.portfolio / 100)} />
                    <TooltipRow color="var(--series-2)" label={data.benchmark} value={signedPct(payload[0]?.payload.benchmark / 100)} />
                  </TooltipBox>
                ) : null
              }
            />
            <Line dataKey="benchmark" stroke="var(--series-2)" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }} isAnimationActive={false} />
            <Line dataKey="portfolio" stroke="var(--series-1)" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

export function DrawdownChart({ data }: { data: Analysis }) {
  const rows = data.series.dates.map((d, i) => ({ date: d, dd: data.series.drawdown[i] * 100 }));
  return (
    <Card
      title="Drawdown"
      subtitle={`How far the portfolio was below its previous high. Worst: ${signedPct(data.kpis.max_drawdown)}.`}
    >
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={rows} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--grid)" vertical={false} />
            <XAxis dataKey="date" tickFormatter={monthTick} minTickGap={32} {...axis} />
            <YAxis tickFormatter={(v) => `${v}%`} width={44} {...axis} />
            <Tooltip
              cursor={{ stroke: "var(--muted)", strokeDasharray: "3 3" }}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <TooltipBox title={fullDate(String(label))}>
                    <TooltipRow color="var(--series-1)" label="Below high" value={signedPct(Number(payload[0].value) / 100)} />
                  </TooltipBox>
                ) : null
              }
            />
            <Area dataKey="dd" stroke="var(--series-1)" strokeWidth={2} fill="var(--series-1)" fillOpacity={0.15} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function LegendItem({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-0.5 w-4 rounded" style={{ background: color }} />
      <span className="text-muted">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </span>
  );
}

export function TooltipBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-md">
      <div className="mb-1 font-medium">{title}</div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

export function TooltipRow({ color, label, value }: { color?: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="inline-flex items-center gap-1.5 text-muted">
        {color && <span className="h-2 w-2 rounded-full" style={{ background: color }} />}
        {label}
      </span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
