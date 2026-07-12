import dagster as dg
from dagster_dbt import DagsterDbtTranslator, DbtCliResource, dbt_assets

from data_pipeline.project import dbt_project


class CustomDagsterDbtTranslator(DagsterDbtTranslator):
    """Maps dbt nodes to Dagster asset keys explicitly, so lineage is
    predictable regardless of dbt folder nesting:

    - the `yahoo_raw` source is mapped onto the existing `raw_market_prices`
      asset key, so the extract asset shows up as the real upstream of the
      dbt models (instead of dagster-dbt creating a separate source node).
    - dbt models are keyed by their bare model name.
    """

    def get_asset_key(self, dbt_resource_props):
        resource_type = dbt_resource_props.get("resource_type")
        name = dbt_resource_props.get("name")

        if resource_type == "source" and name == "yahoo_raw":
            return dg.AssetKey("raw_market_prices")

        if resource_type == "model":
            return dg.AssetKey(name)

        return super().get_asset_key(dbt_resource_props)


@dbt_assets(
    manifest=dbt_project.manifest_path,
    dagster_dbt_translator=CustomDagsterDbtTranslator(),
)
def dbt_market_assets(context: dg.AssetExecutionContext, dbt: DbtCliResource):
    yield from dbt.cli(["build"], context=context).stream()
