import dagster as dg
from data_pipeline.assets import hello_world

defs = dg.Definitions(
    assets=[hello_world],
)

# run dagster dev -f data_pipeline/definitions.py