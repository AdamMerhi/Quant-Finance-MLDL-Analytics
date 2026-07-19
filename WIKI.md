# Quant Finance ML/DL Analytics — Project Wiki

## What This Project Is

A personal quant finance analytics platform. The end goal is an automated pipeline that fetches financial data, transforms it into Parquet files, stores it in Cloudflare R2, serves it via a FastAPI backend, and displays it on a Vercel-hosted frontend.

---

## Architecture

```
GitHub Actions (scheduled trigger)
          ↓
    Dagster Pipeline
          ↓
  fetch → transform → Parquet
          ↓
  Cloudflare R2 (object storage)
          ↓
    FastAPI Backend
          ↓
  DuckDB reads Parquet → JSON
          ↓
  Vercel Frontend
```

---

## Repository Structure

```
.
├── data_pipeline/                    # Dagster pipeline
│   ├── definitions.py                # Definitions: assets + resources + market_data_job
│   ├── project.py                    # Shared paths, DbtProject, manifest prep
│   ├── assets/
│   │   ├── dbt_assets.py             # @dbt_assets (dbt build -> stg_market_prices)
│   │   └── us_exchange/
│   │       ├── extract.py            # @asset raw_market_prices (yfinance -> DuckDB)
│   │       └── load.py               # @asset market_prices_parquet (DuckDB -> R2)
│   ├── resources/
│   │   └── r2.py                     # R2Resource (boto3 wrapper for Cloudflare R2)
│   └── dbt_project/                  # dbt project (duckdb adapter)
│       └── models/us-exchange/staging/
│           ├── _sources.yml          # declares source market.yahoo_raw
│           └── stg_market_prices.sql
├── .github/workflows/pipeline.yml    # Scheduled + manual DAG runs
├── Backend/                          # Empty — FastAPI + DuckDB planned
├── Frontend/                         # Static site deployed to Vercel
│   ├── index.html                    # Placeholder ("Coming soon")
│   └── .vercel/                      # Vercel project config (links to quant-fintech-frontend)
├── pyproject.toml                    # Registers data_pipeline as the Dagster module
├── .venv/                            # Local Python venv (gitignored)
├── .env                              # Secrets — gitignored (see Environment Variables below)
├── tdo.md                            # Roadmap / to-do list
├── docs/                             # Detailed knowledge-base pages, linked from here
│   └── sprint-1-data-engineering-outcomes.md
└── WIKI.md                           # This file
```

---

## Tech Stack

| Layer | Technology | Status |
|---|---|---|
| Orchestration | Dagster (+ dagster-dbt) | 3-asset DAG live: extract → dbt → load-to-R2 |
| Transform | dbt (duckdb adapter) | 1 staging model (`stg_market_prices`) |
| Storage | Cloudflare R2 | Live — pipeline writes Parquet to it each run |
| Backend API | FastAPI + DuckDB | Not started |
| Frontend | Static HTML → Vercel | Deployed (placeholder) |
| CI/CD trigger | GitHub Actions | Workflow committed, awaiting repo secrets |
| Data format | Apache Parquet | Live — written and verified in R2 |

---

## Local Development Setup

### Prerequisites
- Python 3.x
- Node.js / npm (for Vercel CLI)

### Python Environment

```powershell
# Activate the venv (Windows)
.venv\Scripts\activate

# Install the project (installs dagster, dagster-dbt, duckdb, dbt-core, dbt-duckdb, etc.)
pip install -e .
```

### Run Dagster Locally

```powershell
dagster dev
# or explicitly point to the definitions file:
dagster dev -f data_pipeline/definitions.py
```

Then open `http://localhost:3000` in a browser to use the Dagster UI, and click "Materialize all" to run the full DAG.

### Run the DAG headlessly (mirrors what CI does)

```powershell
dagster job execute -m data_pipeline -j market_data_job
```

### Deploy Frontend

```powershell
cd Frontend
vercel
```

---

## Environment Variables

Stored in `.env` at the project root (gitignored). Required by the Dagster pipeline to write to Cloudflare R2.

| Variable | Purpose |
|---|---|
| `R2_ACCESS_KEY_ID` | Cloudflare R2 access key |
| `R2_SECRET_ACCESS_KEY` | Cloudflare R2 secret key |
| `R2_ENDPOINT` | R2 S3-compatible endpoint URL |
| `R2_BUCKET` | Target bucket name |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID |

Loaded automatically by `data_pipeline/definitions.py` via `python-dotenv`'s `load_dotenv()` when running locally. On GitHub Actions, the same variable names are injected directly as env vars from repo secrets (see `.github/workflows/pipeline.yml`) — no `.env` file is needed there.

---

## Dagster Pipeline

**Current DAG** (see [Sprint 1 Outcomes](docs/sprint-1-data-engineering-outcomes.md) for full detail, lineage diagram, and the reasoning behind every change):

```
raw_market_prices  →  stg_market_prices  →  market_prices_parquet
  (yfinance fetch)     (dbt model)            (Parquet → R2)
```

- `data_pipeline/assets/us_exchange/extract.py` — `raw_market_prices`: fetches OHLCV bars from yfinance, lands them in DuckDB as table `yahoo_raw`.
- `data_pipeline/assets/dbt_assets.py` — `dbt_market_assets`: runs the dbt project via `dagster-dbt`, producing `stg_market_prices`.
- `data_pipeline/assets/us_exchange/load.py` — `market_prices_parquet`: reads the dbt output, writes Parquet, uploads to R2.
- `data_pipeline/definitions.py` — wires all three into one `Definitions` object plus `market_data_job`, the job GitHub Actions executes on a schedule.

**Adding a new asset:**
1. Define it with `@dg.asset` in the relevant file under `data_pipeline/assets/`
2. Import it in `data_pipeline/definitions.py` and add it to the `assets=[...]` list in `dg.Definitions`

---

## Roadmap

### Setup (Original)
- [x] GitHub repo
- [ ] Connect Claude (in progress)
- [ ] Connect Obsidian
- [x] Connect Dagster
- [x] Connect Cloudflare R2
- [x] Connect GitHub Actions (workflow committed; needs repo secrets before it can run — see [Sprint 1 Outcomes](docs/sprint-1-data-engineering-outcomes.md#follow-ups--known-gaps))
- [x] Connect Vercel
- [ ] Build full DevOps pipeline

### Sprint 1 — Data Engineering ✅
- [ ] Create domain developer account (data source)
- [x] Write data retrieval Python script, test output to Parquet
- [x] Upload Parquet files to Cloudflare R2

Full writeup: [Sprint 1 — Data Engineering Outcomes](docs/sprint-1-data-engineering-outcomes.md)

### Sprint 2 — Backend (planned)
- [ ] FastAPI app in `Backend/`
- [ ] DuckDB reads Parquet from R2
- [ ] JSON API endpoints

### Sprint 3 — Frontend (planned)
- [ ] Replace placeholder with real charts/tables
- [ ] Fetch data from FastAPI

---

## Sprint Outcomes

Detailed, per-sprint knowledge-base pages live in `docs/` and are linked from here as each sprint wraps up:

- [Sprint 1 — Data Engineering Outcomes](docs/sprint-1-data-engineering-outcomes.md) — DAG lineage, full file tree, the reasoning behind every logic/structure change, bugs found during verification, and how everything was tested end-to-end.

---

## Notes & Gotchas

- `Frontend/index.html` is currently UTF-16 LE encoded (PowerShell `Out-File` artifact). When rewriting it, use UTF-8 — the Write tool does this automatically. If using PowerShell, pass `-Encoding utf8`.
- The `.venv/` directory is gitignored. Always activate it before running Python commands.
- Dagster uses `pyproject.toml` to discover the `data_pipeline` module — don't rename the directory without updating that config.
- `market.duckdb`, dbt's `target/`/`logs/`, and `*.parquet` are all gitignored — they're regenerated every run and should never be committed. R2 is the durable store, not the local DuckDB file.
