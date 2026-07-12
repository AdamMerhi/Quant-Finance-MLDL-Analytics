"""Shared paths and dbt project wiring used by both the Dagster assets and
the dbt CLI resource. Centralized here so extract/dbt/load assets all agree
on where the DuckDB file and dbt project live.
"""

import os
from pathlib import Path

from dagster_dbt import DbtProject

DATA_PIPELINE_DIR = Path(__file__).parent.resolve()
DBT_PROJECT_DIR = DATA_PIPELINE_DIR / "dbt_project"
DUCKDB_PATH = str(DATA_PIPELINE_DIR / "market.duckdb")

# dbt's profiles.yml reads this via env_var('DBT_DUCKDB_PATH') so the dbt
# subprocess and the Dagster assets always point at the same DuckDB file.
os.environ.setdefault("DBT_DUCKDB_PATH", DUCKDB_PATH)

dbt_project = DbtProject(project_dir=DBT_PROJECT_DIR)

# DbtProject.prepare_if_dev() only regenerates the manifest under
# `dagster dev` (it checks the DAGSTER_IS_DEV_CLI env var). GitHub Actions
# runs this headlessly via `dagster job execute`, so that hook never fires
# there. Since target/ is gitignored and this project has no separate
# build-time packaging step, always (re)build the manifest at import time —
# it's cheap and keeps `dagster dev` and CI behaving identically.
dbt_project.preparer.prepare(dbt_project)
