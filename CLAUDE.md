# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A personal quant finance analytics platform. Target architecture (full detail in `docs/WIKI.md`):

```
GitHub Actions (trigger) → Dagster pipeline (extract → dbt transform → Parquet)
→ Cloudflare R2 (storage) → FastAPI backend (DuckDB reads Parquet → JSON)
→ Vercel frontend
```

Current state: the Dagster pipeline is a live 3-asset DAG (`raw_market_prices` → `stg_market_prices` (dbt) → `market_prices_parquet`) that writes to Cloudflare R2 on every run, and `.github/workflows/daily-pipeline.yml` schedules it daily (awaiting repo secrets); `Backend/` is empty (FastAPI planned); `Frontend/` is a static placeholder deployed to Vercel (project `quant-fintech-frontend`) with a real client-side `Investment`/`IndexFund`/`Super`/`SavingsAccount` class model but no API calls yet.

## Structure

- `data_pipeline/` — Dagster assets under `assets/` (`dbt_assets.py`, `us_exchange/extract.py`, `us_exchange/load.py`), `resources/r2.py`, shared paths/dbt wiring in `project.py`, and `Definitions` in `definitions.py`. A dbt project lives at `data_pipeline/dbt_project/`. `pyproject.toml` registers `data_pipeline` as the Dagster module.
- `Backend/` — empty; FastAPI + DuckDB planned.
- `Frontend/` — static site (`index.html`, `CSS/`, `JS/`), linked to Vercel via `Frontend/.vercel/`.
- `docs/` — documentation hub; `docs/WIKI.md` is the master architecture doc, `docs/diagrams/` holds Mermaid sources + rendered SVGs, `docs/images/` holds supporting images.
- `.env` (gitignored) — Cloudflare R2 credentials: `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`, `R2_BUCKET`, `CLOUDFLARE_ACCOUNT_ID`.

## Commands

Python environment is a local venv at `.venv/` (activate with `.venv\Scripts\activate` on Windows). Installed packages: dagster, dagster-dbt, dagster-duckdb, dbt-core, dbt-duckdb, duckdb, boto3, python-dotenv, pandas, pyarrow, yfinance.

- Run Dagster locally: `dagster dev` (uses `pyproject.toml` module config), or `dagster dev -f data_pipeline/definitions.py`
- Run the DAG headlessly: `dagster job execute -m data_pipeline -j market_data_job`
- Deploy frontend: `vercel` from `Frontend/`
- Render architecture diagrams: `bash scripts/generate-diagrams.sh` (renders every `docs/diagrams/**/*.mmd` to an `.svg` beside it; requires Node.js)

There are no tests or linters configured yet.

## Architecture Documentation

`docs/WIKI.md` is the master, human-readable architecture doc. `docs/diagrams/**/*.mmd` are the editable Mermaid source files — the source of truth for diagrams; `.github/workflows/diagrams.yml` auto-renders them to `.svg` on push to `main` and commits the SVGs back. **Never hand-edit a generated `.svg`.**

When making a change that affects a service, module, class relationship, database table/relationship, API boundary, infrastructure, external integration, queue, event flow, or major workflow:
1. Inspect the relevant existing diagram(s) under `docs/diagrams/` before making the change.
2. Update the matching `.mmd` file to reflect the new architecture.
3. Update `docs/WIKI.md` if the high-level explanation changed.
4. Skip diagram/WIKI updates for trivial, non-architectural changes (e.g. a bug fix that doesn't change structure).
5. Keep diagrams focused and readable — don't cram unrelated concerns into one diagram, and don't invent architecture that doesn't exist yet.

Two diagrams are intentionally not yet authored (`docs/diagrams/classes/`, `docs/diagrams/api/`) because the Frontend investment-logic classes are still evolving and `Backend/` is empty. When that architecture is built out, author `class-diagram.mmd` / `api.mmd`, update `docs/WIKI.md`'s "(planned)" sections, and check off the corresponding Roadmap items.

## Notes

- `Frontend/index.html` is UTF-16 LE encoded — a PowerShell `Out-File` artifact. Prefer writing files as UTF-8 (the Write tool does this; if using PowerShell, pass `-Encoding utf8`).
- New Dagster assets go in `data_pipeline/assets/` and must be registered in the `Definitions` object in `data_pipeline/definitions.py`.