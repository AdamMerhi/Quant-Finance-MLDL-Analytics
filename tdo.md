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

- ~~Build Github repo~~
- Connect Claude
- Connect Obsidean 
- Connect Dagster
- Connext Cloudflare
- Connect Github Action
- Connect Vercel1
- Build Arcictecture and DevOps Pipeline