import dagster as dg

@dg.asset
def hello_world():
    return "Hello Dagster"