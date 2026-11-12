import { Slice } from "@/lib/api";
import { pct } from "@/lib/portfolio";

/** Horizontal bars for a part-of-whole breakdown; bar length = share of 100%. One series, one color; labels carry the values. */
export default function BreakdownBars({ slices, max = 8 }: { slices: Slice[]; max?: number }) {
  const shown = slices.slice(0, max);
  const rest = slices.slice(max).reduce((a, s) => a + s.weight, 0);
  const rows = rest > 0 ? [...shown, { label: "All others", weight: rest }] : shown;
  return (
    <ul className="space-y-2.5">
      {rows.map((s) => (
        <li key={s.label} title={`${s.label}: ${pct(s.weight)}`}>
          <div className="mb-1 flex justify-between text-xs">
            <span>{s.label}</span>
            <span className="tabular-nums text-muted">{pct(s.weight)}</span>
          </div>
          <div className="h-2 rounded-full bg-line/60">
            <div
              className="h-2 rounded-full bg-series-1"
              style={{ width: `${Math.min(s.weight, 1) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
