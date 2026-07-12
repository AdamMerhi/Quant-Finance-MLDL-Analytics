import dagster as dg
import duckdb
import yfinance as yf

from data_pipeline.project import DUCKDB_PATH

TICKERS = [
    "IVV",
    "VOO",
    "^IXIC",
]


@dg.asset(group_name="us_exchange", kinds={"python", "duckdb"})
def raw_market_prices() -> dg.MaterializeResult:
    """Fetch daily OHLCV bars from Yahoo Finance and land them in DuckDB as
    the `yahoo_raw` table (declared as a dbt source in
    dbt_project/models/us-exchange/staging/_sources.yml).
    """

    raw = yf.download(
        tickers=TICKERS,
        start="2020-01-01",
        group_by="ticker",
        auto_adjust=False,
    )

    long_df = (
        raw
        .stack(level="Ticker", future_stack=True)
        .reset_index()
        .rename(columns={
            "Date": "date",
            "Ticker": "ticker",
            "Open": "open",
            "High": "high",
            "Low": "low",
            "Close": "close",
            "Adj Close": "adj_close",
            "Volume": "volume",
        })
    )

    conn = duckdb.connect(DUCKDB_PATH)
    try:
        conn.execute("CREATE OR REPLACE TABLE yahoo_raw AS SELECT * FROM long_df")
    finally:
        conn.close()

    return dg.MaterializeResult(
        metadata={
            "row_count": len(long_df),
            "tickers": TICKERS,
        }
    )
