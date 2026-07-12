import os
import duckdb
import subprocess

from extract import extract

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DB_PATH = os.path.join(REPO_ROOT, "market.duckdb")
DBT_PROJECT_DIR = os.path.join(REPO_ROOT, "dbt_project")


def transform(df):

    conn = duckdb.connect(
        DB_PATH
    )

    conn.execute(
        "CREATE OR REPLACE TABLE yahoo_raw AS SELECT * FROM df"
    )
    conn.close()

    subprocess.run(
        [
            "dbt",
            "run",
            "--select",
            "stg_market_prices",
            "--project-dir",
            DBT_PROJECT_DIR,
            "--profiles-dir",
            DBT_PROJECT_DIR
        ],
        check=True,
        env={**os.environ, "DBT_DUCKDB_PATH": DB_PATH}
    )

    conn = duckdb.connect(DB_PATH)

    print(conn.execute("SHOW TABLES").df())
    # Test output
    result = conn.execute(
        """
        SELECT *
        FROM stg_market_prices
        LIMIT 10
        """
    ).df()

    print(result)

    return result



if __name__ == "__main__":
    raw_df = extract()
    transform(raw_df)
