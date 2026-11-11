# gini_minnie: Phase 1 Implementation Plan

Portfolio analyzer for US equities (NYSE and NASDAQ). The user enters tickers with portfolio weights and gets analytics, visuals, what-if analysis for a new ticker, and news-driven suggestions.

> Every screen shows the disclaimer: *"For informational purposes only, not investment advice."*

---

## 1. Scope (Phase 1)

| # | Feature | Summary |
|---|---------|---------|
| F1 | Portfolio input | Ticker + % weight rows, a **Lock** toggle per row, optional total $ value. Validation (weights add up to 100%, ticker exists and is listed on NYSE or NASDAQ). |
| F2 | Portfolio overview | Total value, KPIs, allocation, performance vs. benchmark. |
| F3 | Risk and correlation | Correlation heatmap, risk contribution, drawdowns, rolling metrics. |
| F4 | Locked assets | Locked tickers are never reduced or removed by any suggestion or optimization. |
| F5 | What-if: add a ticker | Enter a new ticker and target weight. Shows before/after metrics and the expected impact. |
| F6 | News (last 48h) and suggestions | Collect news per holding and for the market, score sentiment and impact, and suggest rebalancing that respects locks. |

Out of scope for Phase 1: user accounts, broker sync, real-time streaming quotes, options and crypto, non-US markets.

---

## 2. Recommended architecture

```
┌──────────────────────┐      REST/JSON      ┌───────────────────────────────┐
│  Frontend (Next.js / │ ──────────────────▶ │  Backend API (Python FastAPI) │
│  React + TypeScript) │ ◀────────────────── │                               │
│  Plotly / Recharts   │                     │  ├─ data/      provider layer  │
└──────────────────────┘                     │  ├─ analytics/ metrics engine  │
                                             │  ├─ optimizer/ (locks aware)   │
                                             │  ├─ news/      fetch + LLM     │
                                             │  └─ cache/     SQLite → Redis  │
                                             └──────────────┬────────────────┘
                                                            │
                         ┌──────────────────────────────────┼─────────────────────┐
                         ▼                                  ▼                     ▼
                Market data provider               News provider           LLM (Claude API)
           (yfinance for prototyping →        (Finnhub / Polygon /       sentiment, impact,
            Polygon / FMP / Tiingo)            Marketaux)                 summaries
```

**Why Python for the backend:** pandas, numpy, scipy, PyPortfolioOpt, and statsmodels cover all the quant work. **Why React:** rich interactive charts and an easy path to production.

*Lighter alternative:* build Phase 1 entirely in **Streamlit**. Prototyping is about 2–3× faster, but the UI is less flexible. The analytics modules would be the same either way, so moving to React later stays cheap.

### Key libraries
- Backend: `fastapi`, `pydantic`, `pandas`, `numpy`, `scipy`, `PyPortfolioOpt`, `httpx`, `anthropic`, `pytest`
- Frontend: `next`, `react`, `typescript`, `@tanstack/react-query`, `plotly.js` (heatmaps, frontier) or `recharts`, `tailwindcss`

### Data provider abstraction
`MarketDataProvider` interface: `get_prices(tickers, start, end)`, `get_profile(ticker)` (exchange, sector, industry, market cap, beta), `get_fundamentals(ticker)`, `get_news(tickers, since)`. Start with **yfinance** (free, but unofficial and rate-limited). Before going public, swap to a paid API. Caching: daily prices are cached for 24h, profiles for 7 days, and news for 15 minutes.

---

## 3. Feature details

### F1: Portfolio input
- Editable table: `Ticker | Weight % | Lock 🔒 | (remove)`. Also supports CSV paste or upload.
- Optional "Total portfolio value ($)". With it, the app shows dollar amounts and approximate share counts.
- Validation:
  - The ticker resolves through the provider and its exchange is NYSE, NASDAQ, or NYSE American/Arca (ETFs). Should ETFs be allowed? See questions.
  - Weights must add up to 100% (±0.01). A "Normalize" button fixes small gaps.
  - No duplicates, and each ticker needs enough price history (at least 1 year, with a warning if shorter).
- Portfolio state is kept in local storage. Saved portfolios come in Phase 2.

### F2: Overview dashboard
**KPI tiles:** total value · 1D / 1M / YTD / 1Y / 3Y return · annualized volatility · Sharpe · Sortino · max drawdown · beta vs SPY · weighted dividend yield · weighted P/E · number of holdings / effective N (1/HHI).

**Charts:**
- Allocation donut by holding, plus breakdowns by sector, industry, and market cap bucket.
- Cumulative performance vs **SPY** and **QQQ**, with a selectable look-back (1Y / 3Y / 5Y).
- Drawdown (underwater) chart.
- Contribution to return per holding (bar chart).

### F3: Risk and correlations
- **Correlation heatmap** of daily returns, clustered with hierarchical ordering. Highly correlated pairs (ρ > 0.8) are highlighted.
- **Risk contribution:** % of portfolio variance from each holding, compared with its weight. This shows the hidden concentration.
- Rolling 60-day volatility and rolling correlation to SPY.
- VaR / CVaR (95%, historical and parametric).
- Sector concentration warnings, for example "Tech = 62% of portfolio".
- **Efficient frontier** (Monte Carlo cloud plus the optimized curve) with the current portfolio plotted on it. **Locked weights are fixed constraints.**

### F4: Locked assets
- Optimizer constraint for locked tickers: `w_i = current_w_i`. Alternative semantics: `w_i ≥ current_w_i` (see questions).
- The UI shows a lock icon everywhere. Suggestions and what-if funding never reduce locked holdings.
- The insights panel reports how much the locks cost: "Your locked assets account for X% of portfolio risk."

### F5: What-if: add a new ticker
- Inputs: ticker and target weight (default 5%). Funding method:
  - **Pro-rata:** reduce unlocked holdings proportionally. This is the default.
  - **Sell specific:** take the weight from chosen holdings.
  - **Optimizer-chosen:** the optimizer decides, with locks respected.
- Outputs:
  - Side-by-side **before vs after**: return, vol, Sharpe, max DD, beta, VaR, effective N, sector mix.
  - Correlation of the new ticker with each holding and with the portfolio as a whole.
  - Marginal contribution to risk, and diversification ratio change.
  - The new ticker's position on the efficient frontier, and how the frontier shifts.
  - A plain-English verdict generated from the numbers, e.g. "Adds diversification (ρ = 0.21 to portfolio) and lowers volatility by 1.3pp; increases Tech exposure to 48%."
- "Expected impact" is **historical/statistical** (backtest over the chosen window plus covariance-based projection). It is presented as an estimate, never a guarantee.

### F6: News analysis (48h) and suggestions
Pipeline (runs on demand, cached for 15 minutes):
1. Fetch news from the last 48h for each holding, plus a macro and market feed (Fed, CPI, sector news).
2. Deduplicate by URL and title similarity, and drop low-relevance items.
3. **LLM scoring** (Claude API, structured JSON output) for each article:
   - `ticker(s)`, `sentiment (-1..1)`, `impact (low/med/high)`, `horizon (days/weeks/months)`, `event_type` (earnings, guidance, M&A, legal, macro, analyst rating…), and a one-line summary.
4. Aggregate per ticker: weighted sentiment score, top 3 stories, and a "news momentum" indicator.
5. **Suggestions engine.** It combines news signals with risk metrics:
   - Flags such as "Strong negative news on X (guidance cut) and X is 18% of the portfolio, so consider trimming."
   - Proposes a rebalanced allocation: optimizer with a sentiment tilt, locks respected, and a cap on max turnover.
   - Each suggestion links to its source articles, so the reasoning is traceable.
6. UI: news feed grouped by ticker with sentiment chips, a sentiment-by-holding bar chart, and a suggestions card showing "current vs suggested" weights.

Model choice: a fast, cheap model (e.g. Claude Haiku) for per-article scoring and a stronger model (e.g. Claude Sonnet) for the final portfolio-level summary and suggestions.

**Honesty guardrail:** the output is worded as *signals and considerations*, never as certain price predictions. Phase 2 adds tracking of past suggestions so their accuracy can be measured.

---

## 4. API sketch (backend)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/tickers/validate?symbol=` | Exists? Exchange, name, sector |
| POST | `/api/portfolio/analyze` | Body: holdings[], total_value?, lookback, benchmark → KPIs, series, breakdowns |
| POST | `/api/portfolio/risk` | Correlation matrix, risk contributions, VaR, rolling stats |
| POST | `/api/portfolio/frontier` | Efficient frontier with lock constraints |
| POST | `/api/portfolio/whatif` | Body: holdings[], new_ticker, weight, funding → before/after |
| POST | `/api/portfolio/news` | 48h news, scored, aggregated, plus suggestions |

`Holding = { ticker: str, weight: float, locked: bool }`

---

## 5. Repository layout

```
gini_minnie/
├─ backend/
│  ├─ app/main.py
│  ├─ app/api/            # routers
│  ├─ app/data/           # provider interface + yfinance impl + cache
│  ├─ app/analytics/      # returns, risk, correlation, attribution
│  ├─ app/optimizer/      # frontier, lock constraints
│  ├─ app/news/           # fetchers, LLM scoring, suggestions
│  └─ tests/
├─ frontend/
│  ├─ app/ (Next.js routes: /, /risk, /what-if, /news)
│  └─ components/ (KpiTile, CorrelationHeatmap, AllocationDonut, ...)
├─ docs/
└─ docker-compose.yml
```

---

## 6. Milestones

| Milestone | Deliverables | Est. |
|-----------|--------------|------|
| **M0: Setup** | Repo scaffold, FastAPI + Next.js, lint/test/CI (GitHub Actions), docker-compose, `.env` handling for API keys | 2–3 days |
| **M1: Data layer** | Provider interface, yfinance impl, exchange validation (NYSE/NASDAQ), caching, unit tests with recorded fixtures | 3–4 days |
| **M2: Input + Overview** | Input table with locks and validation; `/analyze`; KPI tiles, allocation, performance vs SPY, drawdown | 1 week |
| **M3: Risk & Correlation** | Heatmap, risk contribution, rolling metrics, VaR, efficient frontier with locks | 1 week |
| **M4: What-if** | `/whatif`, funding modes, before/after comparison, generated verdict | 4–5 days |
| **M5: News & Suggestions** | News provider, LLM scoring with JSON schema, aggregation, suggestion engine, UI | 1–1.5 weeks |
| **M6: Polish & deploy** | Error states, loading skeletons, mobile layout, disclaimers, deploy (e.g. Vercel + Render/Fly.io) | 3–4 days |

Total: about **5–6 weeks** for one developer. M3 and M5 can run in parallel with two developers.

---

## 7. Testing strategy
- Analytics checked against hand-computed values (e.g. Sharpe and beta on synthetic series).
- Optimizer property tests: locked weights unchanged, weights add up to 1, no negative weights (long-only).
- Provider calls mocked with recorded fixtures, so CI makes no network calls.
- LLM output validated against a JSON schema, with retry and fallback to "unscored".
- Playwright smoke test on the main flow.

---

## 8. Risks
- **yfinance reliability.** It is unofficial and can break or rate-limit. Mitigated by the provider abstraction and caching, with a planned move to a paid API.
- **News licensing.** Store only headline, summary, and link. Do not store full article text.
- **Regulatory.** Suggestions might read as personal advice. Mitigated by clear disclaimers, "considerations" wording, and no order execution.
- **LLM cost.** Mitigated by caching scores per article URL and using a small model for per-article scoring.

---

## 9. Open questions for the product owner
1. **Lock semantics:** should a locked ticker keep its **exact weight**, or just **never be reduced** (adding more is OK)?
2. **ETFs:** allow ETFs (SPY, QQQ, sector ETFs) as holdings, or only individual stocks?
3. **Dollar amounts:** should users optionally enter total value or share counts, or only percentages?
4. **Benchmark:** SPY by default? Should users be able to choose (QQQ, DIA, custom)?
5. **History window:** default look-back for metrics: 1Y, 3Y, or 5Y?
6. **Suggestion aggressiveness:** max turnover per suggestion (e.g. ≤10% of the portfolio)? Allow suggesting *new* tickers, or only re-weighting existing ones?
7. **Budget for data/LLM APIs:** free tier only for Phase 1, or OK with paid (~$30–100/month)?
8. **Platform:** web app only? Is Streamlit acceptable for a faster first version, or go straight to React?
9. **Users:** single user / local, or multi-user with logins (affects storage and hosting)?
10. **Language/UI:** English only, or also Hebrew (RTL)?
