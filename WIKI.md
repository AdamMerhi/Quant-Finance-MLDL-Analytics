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
├── data_pipeline/          # Dagster pipeline
│   ├── assets.py           # Asset definitions (currently: hello_world scaffold)
│   └── definitions.py      # Dagster Definitions object (registers assets)
├── Backend/                # Empty — FastAPI + DuckDB planned
├── Frontend/               # Static site deployed to Vercel
│   ├── index.html          # Placeholder ("Coming soon")
│   └── .vercel/            # Vercel project config (links to quant-fintech-frontend)
├── pyproject.toml          # Registers data_pipeline as the Dagster module
├── .venv/                  # Local Python venv (gitignored)
├── .env                    # Secrets — gitignored (see Environment Variables below)
├── tdo.md                  # Roadmap / to-do list
└── WIKI.md                 # This file
```

---

## Tech Stack

| Layer | Technology | Status |
|---|---|---|
| Orchestration | Dagster | Scaffold only |
| Storage | Cloudflare R2 | Connected (credentials in .env) |
| Backend API | FastAPI + DuckDB | Not started |
| Frontend | Static HTML → Vercel | Deployed (placeholder) |
| CI/CD trigger | GitHub Actions | Not connected |
| Data format | Apache Parquet | Not yet produced |

---

## Local Development Setup

### Prerequisites
- Python 3.x
- Node.js / npm (for Vercel CLI)

### Python Environment

```powershell
# Activate the venv (Windows)
.venv\Scripts\activate

# Install packages (already done — for reference)
pip install dagster boto3 python-dotenv pandas pyarrow duckdb
```

### Run Dagster Locally

```powershell
dagster dev
# or explicitly point to the definitions file:
dagster dev -f data_pipeline/definitions.py
```

Then open `http://localhost:3000` in a browser to use the Dagster UI.

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

Load in Python with:

```python
from dotenv import load_dotenv
import os

load_dotenv()
bucket = os.getenv("R2_BUCKET")
```

---

## Dagster Pipeline

**File:** `data_pipeline/assets.py`

Currently a hello-world scaffold:

```python
@dg.asset
def hello_world():
    return "Hello Dagster"
```

**Adding a new asset:**
1. Define it with `@dg.asset` in `data_pipeline/assets.py`
2. Import it in `data_pipeline/definitions.py` and add it to the `assets=[...]` list in `dg.Definitions`

---

## Roadmap

### Setup (Original)
- [x] GitHub repo
- [ ] Connect Claude (in progress)
- [ ] Connect Obsidian
- [x] Connect Dagster
- [x] Connect Cloudflare R2
- [ ] Connect GitHub Actions
- [x] Connect Vercel
- [ ] Build full DevOps pipeline

### Sprint 1 — Data Engineering
- [ ] Create domain developer account (data source)
- [ ] Write data retrieval Python script, test output to Parquet
- [ ] Upload Parquet files to Cloudflare R2

### Sprint 2 — Backend (planned)
- [ ] FastAPI app in `Backend/`
- [ ] DuckDB reads Parquet from R2
- [ ] JSON API endpoints

### Sprint 3 — Frontend (planned)
- [ ] Replace placeholder with real charts/tables
- [ ] Fetch data from FastAPI

---

## Notes & Gotchas

- `Frontend/index.html` is currently UTF-16 LE encoded (PowerShell `Out-File` artifact). When rewriting it, use UTF-8 — the Write tool does this automatically. If using PowerShell, pass `-Encoding utf8`.
- The `.venv/` directory is gitignored. Always activate it before running Python commands.
- Dagster uses `pyproject.toml` to discover the `data_pipeline` module — don't rename the directory without updating that config.