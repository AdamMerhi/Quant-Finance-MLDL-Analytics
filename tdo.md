## Structure 

                GitHub Actions (trigger)
                          ↓
                    Dagster Pipeline
                          ↓
        fetch → transform → build Parquet
                          ↓
                 Cloudflare R2 (storage)
                          ↓
                    FastAPI Backend
                          ↓
                DuckDB reads Parquet
                          ↓
                     JSON output
                          ↓
                 Vercel Frontend

## To Do
### Original Set up
- ~~Build Github repo~~
- Connect Claude
- Connect Obsidean 
- ~~Connect Dagster~~
- ~~Connext Cloudflare~~
- Connect Github Action
- ~~Connect Vercel~~
- Build Arcictecture and DevOps Pipeline

### Sprint 1 (Data Engineering)
- Create Domain developer account 
- Create data retrival python script and test into parquet
- Upload into cloudflare

## Installed Packages
- pip install boto3 python-dotenv pandas pyarrow duckdb
