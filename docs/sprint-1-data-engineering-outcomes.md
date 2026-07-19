← Back to [WIKI](WIKI.md)

# Sprint 1 — Data Engineering: Outcomes

**Goal:** turn the manual `python transform.py` script into a real Dagster DAG that can run unattended on a GitHub Actions schedule, landing data durably in Cloudflare R2.

**Status at end of sprint:** DAG builds, runs, and lands verified data in R2 end-to-end via `dagster job execute`. GitHub Actions workflow is committed but **not yet live** — repo secrets still need to be added (see [Follow-ups](#follow-ups--known-gaps)).

---

## 1. Starting point

Before this sprint, `data_pipeline/` had:
- `assets.py` — a single placeholder `hello_world` asset, the only thing registered in `Definitions`.
- `assets/us-exchange/` (hyphenated, no `__init__.py`) containing `extract.py`, `transform.py`, an empty `load.py`.
- `transform.py` was a plain function invoked by hand: `python transform.py`. It called `yfinance`, wrote a DuckDB table, then shelled out to `dbt run` via `subprocess.run`, closing/reopening the DuckDB connection around the subprocess call to dodge DuckDB's single-writer file lock.
- No dbt project scaffold existed at all (`dbt_project.yml` and `profiles.yml` were missing — this is what originally caused `dbt run` to fail with a `profiles-dir does not exist` error).
- The dbt model queried a bare table `yahoo_raw`, not a declared dbt `source`.
- `market.duckdb` was untracked in `.gitignore` and would've been committed.

None of this was wired into Dagster — `extract`/`transform` were invisible to it, and it couldn't survive a cloud run anyway (local DuckDB file = ephemeral filesystem on any cloud runner, no R2 write step existed).

## 2. What changed and why

### 2.1 Made the ETL code importable as a real package
**Before:** `assets/us-exchange/` (hyphen — invalid Python identifier) with no `__init__.py`; `transform.py` did `from extract import extract`, which only resolved if you `cd`'d into that exact folder first.
**After:** `assets/us_exchange/` (underscore, proper package) with `__init__.py` files throughout.
**Why:** Dagster imports `data_pipeline` as a package from the repo root — any relative/bare import that depends on the current working directory breaks the moment Dagster (or CI) imports the module from elsewhere.

### 2.2 Split `transform.py` into real Dagster assets
**Before:** one function did extract → write DuckDB table → shell out to dbt → print results, run only via `__main__`.
**After:** three `@asset`s, one per pipeline stage:

| Asset | File | Responsibility |
|---|---|---|
| `raw_market_prices` | `assets/us_exchange/extract.py` | Pulls OHLCV bars from yfinance, reshapes to a tidy long DataFrame, writes it to DuckDB as table `yahoo_raw` |
| `stg_market_prices` | `assets/dbt_assets.py` (`dbt_market_assets`, dagster-dbt multi-asset) | Runs the dbt model that cleans/selects columns from `yahoo_raw` |
| `market_prices_parquet` | `assets/us_exchange/load.py` | Reads the dbt output back out of DuckDB, writes Parquet, uploads to Cloudflare R2 |

**Why:** Dagster's value (lineage, retries, observability, scheduling) only applies to things declared as assets. A plain function invisible to `Definitions` gets none of that — this sprint's whole point was making the pipeline orchestrator-aware.

### 2.3 Replaced the dbt `subprocess.run` hack with `dagster-dbt`
**Before:** `transform.py` called `subprocess.run(["dbt", "run", ...])` directly, manually closing the DuckDB connection first (DuckDB only allows one process to hold a database file open at a time — the dbt subprocess and the Python process would otherwise deadlock/conflict on the same `market.duckdb` file).
**After:** `dagster-dbt`'s `@dbt_assets` decorator (`assets/dbt_assets.py`) wraps `dbt build`, executed through a `DbtCliResource`. Dagster runs each asset in its own step/subprocess in dependency order, so the extract step's connection is already closed by the time the dbt step opens the file — no manual lock choreography needed.
**Why:** the subprocess hack worked but was fragile and gave Dagster zero visibility into what dbt actually did (no per-model lineage, no failure detail beyond "process exited non-zero"). `dagster-dbt` turns every dbt model into a first-class asset node.

### 2.4 Declared `yahoo_raw` as a dbt source, not a bare table reference
**Before:** `stg_market_prices.sql` did `FROM yahoo_raw` — dbt had no formal knowledge this table existed or where it came from.
**After:** `dbt_project/models/us-exchange/staging/_sources.yml` declares `yahoo_raw` as a source under a `market` source group; the model does `FROM {{ source('market', 'yahoo_raw') }}`.
**Why:** this is what lets dbt (and therefore `dagster-dbt`) express "`stg_market_prices` depends on `yahoo_raw`" as structured metadata instead of an opaque SQL string — which is what makes the cross-tool lineage stitch in §2.5 possible at all.

### 2.5 Custom `DagsterDbtTranslator` to unify extract → dbt lineage
**File:** `assets/dbt_assets.py`

By default, `dagster-dbt` would create a *separate* asset node for the `yahoo_raw` source (distinct from the `raw_market_prices` Python asset that actually produces it), leaving two disconnected graph roots. A custom translator overrides `get_asset_key`:
- the `yahoo_raw` **source** node is remapped onto the existing `raw_market_prices` asset key,
- dbt **model** nodes are keyed by their bare model name (flat, not nested by folder path — avoids fragility from the `us-exchange` hyphenated folder name showing up in dbt's fully-qualified name).

**Why:** without this, the Dagster asset graph shows `raw_market_prices` and the dbt-generated `yahoo_raw` source as two unrelated nodes, even though they're the same table. The remap makes `raw_market_prices → stg_market_prices → market_prices_parquet` one continuous, accurate lineage graph (see §3).

### 2.6 Added the load step: Parquet → Cloudflare R2
**Before:** `load.py` was a 0-byte empty file. No durable storage step existed anywhere.
**After:** `market_prices_parquet` asset (`assets/us_exchange/load.py`) reads `stg_market_prices` out of DuckDB via `fetch_arrow_table()`, writes it to an in-memory Parquet buffer, and uploads it to R2 through a new `R2Resource` (`resources/r2.py`) wrapping boto3.
**Why:** this project's target architecture (see main [WIKI](WIKI.md#system-architecture)) treats R2/Parquet as the system of record, with DuckDB used only as an in-run compute engine. Cloud runners (GitHub Actions included) have ephemeral filesystems — anything left only in local DuckDB vanishes the moment the run ends. Without this step, the pipeline could never actually be useful on a schedule.

### 2.7 Centralized paths and dbt manifest prep in `project.py`
**New file:** `data_pipeline/project.py`
Defines `DUCKDB_PATH`, `DBT_PROJECT_DIR`, sets the `DBT_DUCKDB_PATH` env var that `profiles.yml` reads via `env_var(...)`, and builds a `dagster_dbt.DbtProject`.
**Why:** every asset and the dbt CLI resource need to agree on exactly one DuckDB file path and one dbt project directory — previously this was computed ad hoc inside `transform.py` by counting `dirname()` levels, which is exactly the kind of thing that silently breaks when a file moves.

One non-obvious wrinkle found during verification: `DbtProject.prepare_if_dev()` **only** regenerates the dbt manifest under `dagster dev` (it checks the `DAGSTER_IS_DEV_CLI` env var) — it does *not* check whether the manifest is simply missing. Since GitHub Actions runs headlessly via `dagster job execute`, that hook would never fire there, leaving CI runs with no manifest at all. Fixed by calling `dbt_project.preparer.prepare(dbt_project)` unconditionally instead, so `dagster dev` and CI behave identically.

### 2.8 `.gitignore` and dependency cleanup
- Added `*.duckdb`, `*.duckdb.wal`, `dbt_project/target/`, `dbt_project/logs/`, `*.parquet`, `*.egg-info/` — none of these are meant to be committed; they're all regenerated per run.
- `pyproject.toml`: added `dagster-dbt`, `dagster-duckdb`, `dagster-duckdb-pandas`, `duckdb`, `dbt-core`, `dbt-duckdb` as explicit dependencies (previously used but undeclared), removed a duplicate `pyarrow` entry, and added `[tool.setuptools.packages.find]` scoped to `data_pipeline*` — without this, `pip install -e .` failed outright because setuptools found `Backend/`, `Frontend/`, and `data_pipeline/` as sibling top-level packages and refused to guess which one to build.

---

## 3. Current DAG / lineage

```
raw_market_prices  (Python asset — yfinance → DuckDB table `yahoo_raw`)
        │
        ▼
stg_market_prices  (dbt model — dagster-dbt asset, source('market','yahoo_raw') → clean columns)
        │
        ▼
market_prices_parquet  (Python asset — DuckDB → Parquet → Cloudflare R2 upload)
```

Verified directly from the loaded `Definitions` object:

```
raw_market_prices        <- []
stg_market_prices        <- ['raw_market_prices']
market_prices_parquet    <- ['stg_market_prices']
```

Registered as a single job, `market_data_job` (`dg.AssetSelection.all()`), so both `dagster dev` (manual "Materialize all") and CI (`dagster job execute -m data_pipeline -j market_data_job`) run the exact same graph.

---

## 4. File tree (current)

```
data_pipeline/
├── __init__.py                          # re-exports `defs`
├── definitions.py                       # wires assets + resources + market_data_job
├── project.py                           # shared paths, DbtProject, manifest prep
├── market.duckdb                        # gitignored — regenerated every run
├── assets/
│   ├── __init__.py
│   ├── dbt_assets.py                    # @dbt_assets + CustomDagsterDbtTranslator
│   └── us_exchange/
│       ├── __init__.py
│       ├── extract.py                   # @asset raw_market_prices
│       └── load.py                      # @asset market_prices_parquet
├── resources/
│   ├── __init__.py
│   └── r2.py                            # R2Resource (boto3 wrapper for Cloudflare R2)
└── dbt_project/
    ├── dbt_project.yml
    ├── profiles.yml                     # duckdb target, path via env_var('DBT_DUCKDB_PATH')
    └── models/us-exchange/staging/
        ├── _sources.yml                 # declares source market.yahoo_raw
        └── stg_market_prices.sql        # FROM {{ source('market', 'yahoo_raw') }}

.github/workflows/
└── pipeline.yml                         # cron (weekdays 22:00 UTC) + workflow_dispatch
```

Deleted: `data_pipeline/assets.py` (`hello_world` placeholder), the old hyphenated `assets/us-exchange/` folder and its `transform.py`.

---

## 5. Bugs found and fixed during verification

These weren't hypothetical — each one failed a real `dagster job execute` run before being fixed:

1. **`pyarrow.lib.RecordBatchReader` vs `Table`** — `conn.execute(...).arrow()` returned a `RecordBatchReader` on the installed `duckdb` version (1.5.4), but `pq.write_table` requires an actual `Table`. Fixed by switching to `.fetch_arrow_table()`, which always materializes a `Table`.
2. **R2 region rejection** — boto3 inferred a real AWS region (`ap-southeast-2`, from local AWS config) for the S3 client. R2 only accepts its own region tokens (`auto`, `wnam`, `enam`, `weur`, `eeur`, `apac`, `oc`) and rejected the request with `InvalidRegionName`. Fixed by hardcoding `region_name="auto"` in `R2Resource._client()`.
3. **Manifest not built outside `dagster dev`** — see §2.7. Would have caused every CI run to fail immediately on the dbt step.
4. **`setuptools` multi-package ambiguity** — `pip install -e .` failed because the repo root also contains `Backend/` and `Frontend/`. Fixed via `[tool.setuptools.packages.find] include = ["data_pipeline*"]`.

---

## 6. Verification performed

- `dagster definitions validate -m data_pipeline` — passes.
- `dagster job execute -m data_pipeline -j market_data_job` (headless, mirrors what CI runs) — `RUN_SUCCESS`, all three assets materialized in order.
- Asset graph dependency edges inspected directly from the loaded `Definitions` object — matches §3 exactly.
- R2 bucket listed via boto3 after a run: `us_exchange/stg_market_prices.parquet`, 91,354 bytes, present.
- Downloaded that Parquet file back and read it with DuckDB: 4,914 rows, columns `date, ticker, close, volume`, date range 2020-01-02 → 2026-07-10, covering all three tickers (`IVV`, `VOO`, `^IXIC`). Confirms the R2 copy isn't just present but structurally correct.

---

## Follow-ups / known gaps

- **GitHub Actions secrets not yet added.** `.github/workflows/pipeline.yml` references `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `CLOUDFLARE_ACCOUNT_ID` via `secrets.*` — these currently only exist in the local `.env` and must be added under repo Settings → Secrets and variables → Actions before the schedule can run successfully.
- `Backend/` (FastAPI + DuckDB reading Parquet from R2) is still unimplemented — Sprint 2 territory.
- `assets/real-estate/` and the matching dbt `models/real-estate/` are still empty placeholders for a future second data domain.
- No tests exist yet for the asset logic (e.g. the yfinance reshape or the dbt model output shape).
