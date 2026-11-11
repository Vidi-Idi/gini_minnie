# gini_minnie: Phase 1 Implementation Plan

Portfolio analyzer for US equities and ETFs (NYSE and NASDAQ). The user enters tickers with the dollar amount held in each and gets analytics, visuals, what-if analysis for a new ticker, and news-driven suggestions.

**Usage model:** a periodic review every **2–4 weeks**, not day trading. Each review should answer: "What changed since last time, and what (if anything) should I adjust?" Suggestions target a horizon of weeks to months and ignore daily noise.

---

## 0. Decisions (confirmed by product owner)

| Topic | Decision |
|-------|----------|
| Lock meaning | A locked ticker is **never removed** from the portfolio. Its weight may be trimmed or increased, but stays above a minimum floor (default 2%, adjustable per holding). |
| ETFs | Allowed (e.g. SPY, QQQ, sector ETFs). |
| Inputs | **Dollar amounts** per ticker. The app computes the percentages and the total. |
| Benchmark | User-selectable (default SPY; QQQ, DIA, IWM, or any valid ticker). |
| History window | **1 year** look-back for all metrics. |
| Suggestions | No turnover limit. May include **new tickers**. Expressed as concrete buy/sell $ amounts. |
| Budget | Free data sources by default. Paid services are used only when the user supplies their own API key (see §2). |
| Stack | Polish over speed: **Next.js (React + TypeScript) frontend + FastAPI backend**. |
| Users | Single user (owner), runs locally or on a private deploy. No login system in Phase 1. |
| Language | English only. |

> Every screen shows the disclaimer: *"For informational purposes only, not investment advice."*

---

## 1. Scope (Phase 1)

| # | Feature | Summary |
|---|---------|---------|
| F1 | Portfolio input | Ticker + **$ amount** rows and a **Lock** toggle per row. The app computes weights and total. Validation (ticker exists and is listed on NYSE or NASDAQ, stock or ETF). |
| F2 | Portfolio overview | Total value, KPIs, allocation, performance vs. benchmark. |
| F3 | Risk and correlation | Correlation heatmap, risk contribution, drawdowns, rolling metrics. |
| F4 | Locked assets | Locked tickers are never removed by any suggestion or optimization (they keep at least a minimum weight). |
| F5 | What-if: add a ticker | Enter a new ticker and target weight. Shows before/after metrics and the expected impact. |
| F6 | News (last 48h) and suggestions | Collect news per holding and for the market, score sentiment and impact, and suggest rebalancing that respects locks. |
| F7 | Review history | Each analysis can be saved as a dated snapshot, so the next review shows what changed since the last one. |

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
`MarketDataProvider` interface: `get_prices(tickers, start, end)`, `get_profile(ticker)` (exchange, sector, industry, market cap, beta, ETF flag), `get_fundamentals(ticker)`, `get_news(tickers, since)`. Caching: daily prices are cached for 24h, profiles for 7 days, and news for 15 minutes. Storage is a local **SQLite** file (cache + saved reviews), which fits a single user.

### Cost policy: free by default, paid only with your own key
| Need | Default (free) | Optional upgrade (user supplies key in `.env` / settings page) |
|------|----------------|---------------------------------------------------------------|
| Prices, profiles, ETF info | yfinance | Polygon / FMP / Tiingo |
| News (48h) | yfinance news + Finnhub free tier (free key) | Polygon / Marketaux |
| News scoring | Local model: FinBERT or VADER (no cost) | Claude API (better summaries and reasoning) |

The app works end to end with no paid key. A settings page shows which providers are active.

---

## 3. Feature details

### F1: Portfolio input
- Editable table: `Ticker | Amount ($) | Weight % (computed) | Lock 🔒 | Min weight (if locked) | (remove)`. Also supports CSV paste or upload.
- Total portfolio value = sum of amounts. Weights update live as amounts change.
- Validation:
  - The ticker resolves through the provider and is listed on NYSE, NASDAQ, NYSE American, or NYSE Arca. Stocks and ETFs are both accepted, and ETFs are labeled.
  - Amounts must be positive. No duplicate tickers.
  - Each ticker needs 1 year of price history. If it has less, the app warns and uses what is available.
- The current portfolio is saved in SQLite and loaded on the next visit.

### F2: Overview dashboard
**KPI tiles:** total value ($) · 1D / 1M / 3M / YTD / 1Y return · annualized volatility · Sharpe · Sortino · max drawdown · beta vs benchmark · weighted dividend yield · weighted P/E · number of holdings / effective N (1/HHI).

**Charts:**
- Allocation donut by holding, plus breakdowns by sector, industry, and market cap bucket.
- Cumulative performance over the last year vs the **selected benchmark** (dropdown: SPY default, QQQ, DIA, IWM, or any ticker).
- ETF look-through (where data is available): top underlying holdings and sector exposure of ETFs, so overlap is visible (e.g. AAPL held directly and inside QQQ).
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
- Optimizer constraint for locked tickers: `w_i ≥ min_w_i` (default 2%, adjustable per holding). Locked tickers can be trimmed or increased but never dropped.
- The UI shows a lock icon everywhere. Suggestions and what-if funding never remove a locked holding.
- The insights panel reports how much the locks cost: "Your locked assets account for X% of portfolio risk."

### F5: What-if: add a new ticker
- Inputs: ticker and **amount to invest ($)**, with an option to **add new cash** or **fund from existing holdings**. Funding methods when reallocating:
  - **Pro-rata:** reduce holdings proportionally (locked ones not below their floor). This is the default.
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
1. Fetch news from the last 48h for each holding, plus a macro and market feed (Fed, CPI, sector news). Because reviews happen every 2–4 weeks, a **"since last review"** window (up to 30 days) is also offered, with the 48h window as the default.
2. Deduplicate by URL and title similarity, and drop low-relevance items.
3. **Scoring** for each article. By default a free local model (FinBERT) scores sentiment. If the user adds a Claude API key, the LLM also produces the richer fields below as structured JSON:
   - `ticker(s)`, `sentiment (-1..1)`, `impact (low/med/high)`, `horizon (days/weeks/months)`, `event_type` (earnings, guidance, M&A, legal, macro, analyst rating…), and a one-line summary.
4. Aggregate per ticker: weighted sentiment score, top 3 stories, and a "news momentum" indicator.
5. **Suggestions engine.** It combines news signals with risk metrics:
   - Flags such as "Strong negative news on X (guidance cut) and X is 18% of the portfolio, so consider trimming."
   - Proposes a rebalanced allocation: optimizer with a sentiment tilt, locks respected, no turnover cap. Output is a concrete **trade list** ("Sell $1,200 of X, buy $800 of Y").
   - May propose **new tickers** from a candidate universe (S&P 500 + Nasdaq-100 + major sector/broad ETFs), ranked by diversification benefit (low correlation to the portfolio), risk-adjusted 1Y performance, and news sentiment. Each one can be sent to the what-if page with one click.
   - Each suggestion links to its source articles, so the reasoning is traceable.
6. UI: news feed grouped by ticker with sentiment chips, a sentiment-by-holding bar chart, and a suggestions card showing "current vs suggested" weights.

Model choice (only if a Claude key is supplied): a fast, cheap model (e.g. Claude Haiku) for per-article scoring and a stronger model (e.g. Claude Sonnet) for the final portfolio-level summary and suggestions. Without a key, the summary is built from templates.

### F7: Review history
- "Save review" stores a dated snapshot: holdings, KPIs, suggestions shown.
- The next review opens with a **"Since last review"** panel: portfolio value change, return vs benchmark, weight drift, and which past suggestions were followed and how they performed.
- A timeline chart of portfolio value and key metrics across reviews.

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
| GET/POST | `/api/reviews` | List and save review snapshots |
| GET | `/api/reviews/compare?from=&to=` | "Since last review" comparison |
| GET | `/api/settings/providers` | Which data/news/LLM providers are active |

`Holding = { ticker: str, amount_usd: float, locked: bool, min_weight?: float }`

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
| **M5: News & Suggestions** | News provider, FinBERT scoring + optional Claude scoring, aggregation, suggestion engine with trade list and new-ticker candidates, UI | 1.5 weeks |
| **M5b: Review history** | Snapshots in SQLite, "since last review" panel, timeline | 3–4 days |
| **M6: Polish** | Design pass, dark mode, error states, loading skeletons, responsive layout, disclaimers, one-command local run (`docker compose up`) | 1 week |

Total: about **6–7 weeks** for one developer.

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
- **LLM cost.** Zero by default (local FinBERT). With a Claude key, scores are cached per article URL and a small model handles per-article scoring.
- **Free-tier limits.** Free news APIs cap requests. Fine at a review every 2–4 weeks, and caching keeps usage low.

---

## 9. Remaining open items
1. Default minimum weight for locked holdings: 2% proposed.
2. Candidate universe for new-ticker suggestions: S&P 500 + Nasdaq-100 + major ETFs proposed.
3. Hosting: run locally only (`docker compose up`), or a private cloud deploy as well?
