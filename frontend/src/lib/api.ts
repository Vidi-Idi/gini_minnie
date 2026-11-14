export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

/**
 * The free backend plan sleeps when idle and needs 30–60s to wake up.
 * Called when the page opens, so it is usually awake by the time you click Analyze.
 */
export function wakeBackend(): void {
  fetch(`${API_URL}/api/health`).catch(() => {});
}

export type Slice = { label: string; weight: number };

export type HoldingDetail = {
  ticker: string;
  name: string;
  quote_type: "EQUITY" | "ETF";
  exchange: string;
  sector: string | null;
  amount_usd: number;
  weight: number;
  locked: boolean;
  return_1y: number | null;
  annual_volatility: number | null;
  contribution_to_return: number | null;
  risk_contribution: number | null;
};

export type Kpis = {
  total_usd: number;
  return_1d: number | null;
  return_1m: number | null;
  return_3m: number | null;
  return_ytd: number | null;
  return_1y: number | null;
  benchmark_return_1y: number | null;
  annual_volatility: number;
  sharpe: number | null;
  sortino: number | null;
  max_drawdown: number;
  beta: number | null;
  correlation_to_benchmark: number | null;
  dividend_yield: number | null;
  pe_ratio: number | null;
  holdings_count: number;
  effective_holdings: number;
};

export type Analysis = {
  benchmark: string;
  window_start: string;
  window_end: string;
  kpis: Kpis;
  holdings: HoldingDetail[];
  series: { dates: string[]; portfolio: number[]; benchmark: number[]; drawdown: number[] };
  sectors: Slice[];
  asset_types: Slice[];
  market_caps: Slice[];
  correlation: Record<string, Record<string, number>>;
  warnings: string[];
};

export class AnalyzeError extends Error {
  constructor(
    message: string,
    public tickerErrors: Record<string, string> = {},
  ) {
    super(message);
  }
}

export async function analyzePortfolio(
  holdings: { ticker: string; amount_usd: number; locked: boolean }[],
  benchmark: string,
): Promise<Analysis> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/portfolio/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ holdings, benchmark }),
    });
  } catch {
    throw new AnalyzeError(
      "Could not reach the analysis server. If it was asleep, wait a few seconds and try again.",
    );
  }
  if (res.ok) return res.json();
  const body = await res.json().catch(() => ({}));
  const detail = body?.detail;
  if (detail?.ticker_errors) {
    throw new AnalyzeError("Some tickers could not be used.", detail.ticker_errors);
  }
  if (detail?.message) throw new AnalyzeError(detail.message);
  throw new AnalyzeError(`Analysis failed (HTTP ${res.status}).`);
}
