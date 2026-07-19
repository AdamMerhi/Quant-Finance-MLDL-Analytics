← Back to [WIKI](WIKI.md)

# Sprint 2 — Backend: Outcomes

**Goal:** stand up the first backend API — read the pipeline's real market data out of Cloudflare R2 and serve investment growth projections to the Frontend, replacing its hard-coded placeholder returns.

**Status at end of sprint:** `Backend/` is no longer empty. A Node + Fastify API reads `stg_market_prices.parquet` from R2, computes real month-by-month compounded projections for three funds, and the Frontend calculator fetches from it live. Super/Savings Account remain local placeholders (unchanged). No CI/deployment for the backend yet — local only (see [Follow-ups](#follow-ups--known-gaps)).

---

## 1. Starting point

Before this sprint:
- `Backend/` was completely empty — no files, no `package.json`.
- The Frontend's `Investment.js` had a single `IndexFund` class labeled "VTI / S&P 500 / Nasdaq" with a hard-coded static 10% return — no relation to the real tickers the pipeline actually fetches (`IVV`, `VOO`, `^IXIC`; no `VTI` anywhere in the data).
- `data_pipeline/assets/us_exchange/extract.py` fetched a fixed `start="2020-01-01"` window regardless of when the pipeline ran.
- No config anywhere named which R2 objects/columns existed or which fund mapped to which ticker.
- The originally planned backend stack (per `CLAUDE.md`/`docs/WIKI.md`) was **FastAPI + DuckDB**; this sprint used **Node.js + Fastify + a pure-JS Parquet reader (`hyparquet`)** instead — see [§2.6](#26-stack-change-fastapi-duckdb--node-fastify-hyparquet) for why.

## 2. What changed and why

### 2.1 Rolling 20-year data window
**Before:** `extract.py` hard-coded `start="2020-01-01"`.
**After:** `start = date.today().replace(year=today.year - 20)` — every run fetches a rolling 20-year window ending "today," instead of a fixed start date that grows stale.
**Why:** the projection feature needs as much historical depth as possible (a 20-year slider), and a fixed 2020 start date would never extend backward as the tool matures.

### 2.2 Root dataset registry (`datasets.config.json`)
**New file:** `datasets.config.json` at the repo root.
**What it does:** a single JSON registry mapping dataset keys → R2 key, expected columns, and a `funds` object (`voo → VOO`, `sp500 → IVV`, `nasdaq → ^IXIC`).
**Why:** the backend needed one place to add future parquet tables/fund mappings without touching code — `Backend/src/config/datasets.js` just reads and validates against this file. The Python pipeline could read the same file later instead of hardcoding `R2_KEY` in `load.py`.

### 2.3 Backend package layout (`Backend/`)
**New files**, organized by responsibility rather than dumped in one file:

| Folder | File | Responsibility |
|---|---|---|
| `src/config/` | `datasets.js` | Reads `datasets.config.json`; exposes `getDataset()` / `resolveTicker()` / `listFunds()` |
| `src/data-access/` | `R2Client.js` | boto3-equivalent S3 client for Cloudflare R2 (same env vars as `data_pipeline/resources/r2.py`) |
| `src/data-access/` | `MarketDataRepository.js` | Parses the Parquet buffer with `hyparquet`, caches month-end closes per ticker in memory (6h TTL) |
| `src/investment-calculations/` | `Investment.js` | Base class: `applyReturn()`, `project(principal)` — the compounding loop |
| `src/investment-calculations/` | `MarketInvestment.js` | Extends `Investment`; turns a series of month-end closes into monthly returns |
| `src/investment-calculations/` | `funds.js` | Thin `Voo`/`Sp500`/`Nasdaq` subclasses + a `createFund()` factory |
| `src/api-management/` | `InvestmentController.js` | Validates the request, resolves the ticker, wires repository → fund → response |
| `src/api-management/` | `routes.js` | Registers `GET /health` and `GET /api/investment/projection` |
| `src/ml-dl/` | `.gitkeep` | Empty placeholder for future ML/DL work |
| — | `server.js` | Boots Fastify + CORS, warms the data cache at startup, listens on `PORT` (default 8080) |

**Why this split:** mirrors what a senior engineer would do for a small service — config, data access, business logic, and API wiring each own a folder, so a future second dataset or fund only touches one or two files, not all of them.

### 2.4 Investment class hierarchy — mirrors the Frontend's OOP style
**Backend base `Investment`:** `applyReturn(balance, rate)` for one month of compound growth, `project(principal)` looping over `monthlyReturns()` to build a `balances` array. Abstract `monthlyReturns()` must be implemented by subclasses.
**`MarketInvestment`:** takes an injected array of month-end closes, computes `monthlyReturns()` as the percent change between consecutive closes.
**`Voo` / `Sp500` / `Nasdaq`:** five-line subclasses that just name themselves; all math lives in the base classes. `funds.createFund(fundKey, closes)` is the factory — `InvestmentController` only ever calls `.project()` on the returned object, never checks which fund it got (the same polymorphism principle as the Frontend's `CalculatorApp`).
**Why:** keeps the calculation logic identical in shape to the existing Frontend `Investment`/`IndexFund`/`Super`/`SavingsAccount` hierarchy, satisfying the "Java-style OOP" requirement and keeping both codebases easy to reason about side by side (see the [class diagram](diagrams/classes/class-diagram.mmd)).

### 2.5 Month-end-close compounding logic
**Approach:** for a request `fund=X&liquidity=L&years=Y`:
1. Resolve `X` → ticker via `datasets.config.json`.
2. Pull the last `Y*12 + 1` month-end closes for that ticker (clamped to whatever history exists).
3. Compute monthly returns as `close[m] / close[m-1] - 1`.
4. Compound `L` forward: `balances[0] = L`, `balances[m] = balances[m-1] * (1 + returns[m])`.
5. Return `{ fund, ticker, liquidity, months, labels, balances, finalValue, gain, totalReturnPct }`.

**Why month-end close (not average):** decided explicitly over "average of the month" — a month-end snapshot is what real return calculations use, and it's what the `close` column (the only price field surviving into `stg_market_prices`) naturally supports without extra aggregation.

### 2.6 Stack change: FastAPI/DuckDB → Node/Fastify/hyparquet
**Originally planned** (per `CLAUDE.md` and `docs/WIKI.md`): FastAPI + DuckDB reading Parquet from R2.
**Actually built:** Node.js + Fastify, with `hyparquet` — a dependency-free, pure-JS Parquet parser — instead of DuckDB/SQL.
**Why:** a deliberate choice made mid-sprint to keep the whole investment-calculation stack in one language (JavaScript, matching the Frontend's existing OOP class model) and avoid a second query-engine dependency for a single, simple aggregation (month-end close per ticker) that a few lines of JS handle directly. This is a real, intentional deviation from the original target architecture — `CLAUDE.md`, `docs/WIKI.md`, and the system/infrastructure diagrams have been updated to describe the Fastify/hyparquet stack instead of FastAPI/DuckDB.

### 2.7 Frontend wiring
**`Investment.js`:** added `Investment.projectSeries()` (async wrapper; default just calls the existing sync `project()`), a new `MarketFund` base class overriding `projectSeries()` to `fetch()` the backend, and `chartUnit()` (base `"yrs"`, `MarketFund` `"mo"`). Replaced the single placeholder `IndexFund` with `Voo`, `Sp500`, `Nasdaq` — each a thin `MarketFund` subclass naming its `fundKey`.
**`app.js`:** `update()` is now `async`; it `await`s `projectSeries()` and guards against a stale response if the user switches investments while a fetch is in flight (`if (this.selected !== requestedInvestment) return;`).
**`Chart.js`:** `draw(balances, unit = "yrs")` now takes an explicit unit label instead of assuming years — needed because market-fund projections are monthly (`years*12` points) while Super/Savings Account are still yearly.
**`index.html`:** footer copy updated to state which options use real data vs. placeholders.
**Why:** keeps the existing polymorphic pattern (`CalculatorApp` never checks which `Investment` subtype is selected) while accommodating a data source that's now asynchronous and a different time resolution.

### 2.8 Bug found and fixed during verification: chart axis unit
**Found:** after wiring the Frontend to the live API, the growth chart labeled its x-axis "78 yrs" when the data was actually 78 **months** — `GrowthChart.drawAxes()` always appended the literal string `"yrs"`.
**Fixed:** `draw()`/`drawAxes()` now accept a `unit` parameter; `app.js` passes `requestedInvestment.chartUnit()` through. Confirmed visually in-browser: VOO/S&P 500/Nasdaq now show "N mo", Super/Savings Account still show "N yrs".

---

## 3. Current API surface

```
GET /health
GET /api/investment/projection?fund={voo|sp500|nasdaq}&liquidity={number>=0}&years={1-40}
  -> { fund, ticker, liquidity, months, labels, balances, finalValue, gain, totalReturnPct }
```

See the [API diagram](diagrams/api/api.mmd) for the full request path: Frontend `MarketFund.projectSeries()` → Fastify route → `InvestmentController` → `MarketDataRepository` (R2 + hyparquet, cached) + `funds.createFund()` (polymorphic `Investment.project()`) → JSON back to the chart.

---

## 4. File tree (current, `Backend/` + touched Frontend files)

```
datasets.config.json                     # NEW — dataset/fund registry (root)

Backend/
├── package.json                         # type:module; fastify, @fastify/cors, hyparquet, @aws-sdk/client-s3, dotenv
├── server.js                            # Fastify bootstrap, CORS, cache warm, listen
└── src/
    ├── config/
    │   └── datasets.js
    ├── data-access/
    │   ├── R2Client.js
    │   └── MarketDataRepository.js
    ├── investment-calculations/
    │   ├── Investment.js
    │   ├── MarketInvestment.js
    │   └── funds.js
    ├── api-management/
    │   ├── routes.js
    │   └── InvestmentController.js
    └── ml-dl/
        └── .gitkeep                     # empty — future ML/DL work

Frontend/JS/
├── Investment.js                        # + MarketFund, Voo, Sp500, Nasdaq, projectSeries(), chartUnit()
├── Chart.js                             # draw(balances, unit) — was draw(balances)
└── app.js                               # update() now async; stale-response guard

data_pipeline/assets/us_exchange/
└── extract.py                           # start date now rolling (today - 20y), was hard-coded "2020-01-01"
```

---

## 5. Bugs found and fixed during verification

1. **Chart x-axis mislabeled months as years** — see [§2.8](#28-bug-found-and-fixed-during-verification-chart-axis-unit). Caught visually in-browser, not by a type check or test.
2. **dotenv couldn't find `.env`** — `import "dotenv/config"` resolves `.env` relative to the process's CWD, but `.env` lives at the repo root while `server.js` runs from `Backend/`. Fixed by loading it explicitly with an absolute path (`dotenv.config({ path: path.resolve(__dirname, "../.env") })`).
3. No other runtime errors — the `hyparquet` DATE decoding, R2 auth, and Fastify routing all worked on the first successful run once the above two were fixed.

---

## 6. Verification performed

- **Unit sanity (no network):** `MarketInvestment` given closes `[100, 110, 121]` → `monthlyReturns() ≈ [0.10, 0.10]` → `project(10000) → [10000, 11000, 12100]`. Confirms the compounding math and array lengths independent of any real data.
- **Repository parse (real R2):** `MarketDataRepository.load()` against the live bucket — all three tickers (`VOO`, `^IXIC`, `IVV`) present, ~79 months each (reflecting the pipeline's pre-this-sprint `2020-01-01` start date; will grow once the pipeline re-runs with the new rolling window), months sorted ascending.
- **API integration (curl):** `fund=sp500&liquidity=10000&years=10` → `balances[0]===10000`, 79 points, `finalValue≈$23,101` (+131%, plausible for IVV's actual 2020–2026 run). `fund=nasdaq`, `fund=voo` also verified. Bad `fund` → 400. `years=999` → 400. `GET /health` → `{"status":"ok"}`.
- **End-to-end in-browser** (served Frontend statically + ran the Fastify server locally, driven via Chrome automation): selected VOO → chart drew a real, noisy month-over-month line (not a smooth synthetic curve) with correct dollar values; switched to Nasdaq → chart and summary updated correctly; switched to Savings Account → confirmed the old local yearly path (and "N yrs" label) still works unaffected; zero console errors throughout.

---

## Follow-ups / known gaps

- **Backend is local-only.** No deployment/hosting yet for the Fastify API (see the dashed "Deployed backend host (planned)" node in the [infrastructure diagram](diagrams/infrastructure/infrastructure.mmd)) — the Frontend currently points at `http://localhost:8080`, which only works in local development.
- **CORS allowlist** in `server.js` covers common local dev ports only; needs the production Vercel domain added once the backend is deployed.
- **No automated tests** for the backend (unit or integration) — verification this sprint was manual (see §6).
- **Only ~79 months of history exist in R2 today** — the pipeline needs to re-run with the new rolling 20-year `extract.py` window (§2.1) before the full 40-year slider range is meaningfully populated.
- **Super/Savings Account are still synthetic placeholders** — real superannuation/savings-rate data sourcing is unscoped future work.
- **`ml-dl/` is an empty placeholder** — no ML/DL work has started.
