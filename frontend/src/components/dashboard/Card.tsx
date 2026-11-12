export function Card({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-line bg-surface p-4 sm:p-5 ${className}`}>
      <h3 className="text-sm font-semibold">{title}</h3>
      {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Colored only as reinforcement: the sign is always shown, so color is never the only cue. */
export function Delta({ value, digits = 1 }: { value: number | null; digits?: number }) {
  if (value == null) return <span className="text-muted">—</span>;
  const cls = value > 0 ? "text-good" : value < 0 ? "text-critical" : "";
  const sign = value >= 0 ? "+" : "−";
  return (
    <span className={`tabular-nums ${cls}`}>
      {sign}
      {Math.abs(value * 100).toFixed(digits)}%
    </span>
  );
}
