export type HoldingInput = {
  id: string;
  ticker: string;
  amount: string; // raw text from the input box
  locked: boolean;
};

export type RowSummary = HoldingInput & { amountUsd: number; weight: number };

const TICKER_RE = /^[A-Z][A-Z0-9.\-]{0,9}$/;

export function parseAmount(raw: string): number {
  const n = Number(raw.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Computes total and per-row weights from dollar amounts. */
export function summarize(rows: HoldingInput[]) {
  const amounts = rows.map((r) => parseAmount(r.amount));
  const total = amounts.reduce((a, b) => a + b, 0);
  const summarized: RowSummary[] = rows.map((r, i) => ({
    ...r,
    amountUsd: amounts[i],
    weight: total > 0 ? amounts[i] / total : 0,
  }));
  const lockedTotal = summarized.filter((r) => r.locked).reduce((a, r) => a + r.amountUsd, 0);
  return { rows: summarized, total, lockedTotal };
}

/** Returns an error message per row id, or nothing if the row is valid. */
export function validate(rows: HoldingInput[]): Record<string, string> {
  const errors: Record<string, string> = {};
  const seen = new Set<string>();
  for (const r of rows) {
    const t = r.ticker.trim().toUpperCase();
    if (!t && !r.amount.trim()) continue; // empty row, ignored
    if (!TICKER_RE.test(t)) errors[r.id] = "Enter a valid ticker symbol";
    else if (seen.has(t)) errors[r.id] = "Duplicate ticker";
    else if (parseAmount(r.amount) <= 0) errors[r.id] = "Enter an amount above $0";
    seen.add(t);
  }
  return errors;
}

export const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
