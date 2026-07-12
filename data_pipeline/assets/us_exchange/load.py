import io

import dagster as dg
import duckdb
import pyarrow.parquet as pq

from data_pipeline.project import DUCKDB_PATH
from data_pipeline.resources.r2 import R2Resource

R2_KEY = "us_exchange/stg_market_prices.parquet"


@dg.asset(
    deps=["stg_market_prices"],
    group_name="us_exchange",
    kinds={"python", "parquet"},
)
def market_prices_parquet(r2: R2Resource) -> dg.MaterializeResult:
    """Read the dbt-built stg_market_prices table out of DuckDB, write it to
    Parquet in memory, and upload it to Cloudflare R2 — the durable store the
    FastAPI backend reads from (DuckDB itself is not persisted across cloud
    runs).
    """

    conn = duckdb.connect(DUCKDB_PATH)
    try:
        # fetch_arrow_table() (unlike .arrow(), which can return a
        # RecordBatchReader depending on duckdb version) always returns a
        # materialized pyarrow.Table, which is what pq.write_table expects.
        table = conn.execute("SELECT * FROM stg_market_prices").fetch_arrow_table()
    finally:
        conn.close()

    buffer = io.BytesIO()
    pq.write_table(table, buffer)

    r2.put_bytes(R2_KEY, buffer.getvalue())

    return dg.MaterializeResult(
        metadata={
            "row_count": table.num_rows,
            "r2_key": R2_KEY,
        }
    )
