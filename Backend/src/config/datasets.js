// Reads the root datasets.config.json — the single registry of parquet
// datasets and their fund/ticker mappings. Add new tables/funds there,
// not in code.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.resolve(__dirname, "../../../datasets.config.json");

const raw = readFileSync(CONFIG_PATH, "utf-8");
const config = JSON.parse(raw);

// Returns the dataset entry (r2Key, columns, funds) by its config key.
export function getDataset(datasetKey) {
  const dataset = config.datasets[datasetKey];
  if (!dataset) {
    throw new Error(`Unknown dataset "${datasetKey}" in datasets.config.json`);
  }
  return dataset;
}

// Resolves a fund key (e.g. "sp500") to its ticker (e.g. "IVV") within a dataset.
export function resolveTicker(datasetKey, fundKey) {
  const dataset = getDataset(datasetKey);
  const ticker = dataset.funds[fundKey];
  if (!ticker) {
    throw new Error(`Unknown fund "${fundKey}" for dataset "${datasetKey}"`);
  }
  return ticker;
}

// All valid fund keys for a dataset, e.g. ["voo", "sp500", "nasdaq"].
export function listFunds(datasetKey) {
  return Object.keys(getDataset(datasetKey).funds);
}
