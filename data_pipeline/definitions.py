import dagster as dg
from dagster_dbt import DbtCliResource
from dotenv import load_dotenv

from data_pipeline.assets.dbt_assets import dbt_market_assets
from data_pipeline.assets.us_exchange.extract import raw_market_prices
from data_pipeline.assets.us_exchange.load import market_prices_parquet
from data_pipeline.project import DBT_PROJECT_DIR
from data_pipeline.resources.r2 import R2Resource

# Loads R2_* credentials from .env when running locally. On GitHub Actions
# these are injected directly as env vars via repo secrets, so this is a
# no-op there.
load_dotenv()

market_data_job = dg.define_asset_job(
    name="market_data_job",
    selection=dg.AssetSelection.all(),
)

defs = dg.Definitions(
    assets=[raw_market_prices, dbt_market_assets, market_prices_parquet],
    jobs=[market_data_job],
    resources={
        "dbt": DbtCliResource(project_dir=DBT_PROJECT_DIR, profiles_dir=DBT_PROJECT_DIR),
        "r2": R2Resource(),
    },
)

# Local dev:      dagster dev -f data_pipeline/definitions.py
# Headless / CI:  dagster job execute -m data_pipeline -j market_data_job
