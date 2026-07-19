// Loads the market-prices Parquet file from R2 once, keeps the last close
// per (ticker, month) in memory, and serves month-end-close windows to the
// investment calculators in O(months) per request.
//
// Reload is time-based (not per-request) since the pipeline only refreshes
// the file at most once a day.

import { parquetReadObjects } from "hyparquet";
import { getDataset } from "../config/datasets.js";

const RELOAD_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

// Wraps a Node Buffer as the AsyncBuffer shape hyparquet expects.
function toAsyncBuffer(buffer) {
  return {
    byteLength: buffer.byteLength,
    slice(start, end) {
      return buffer.buffer.slice(
        buffer.byteOffset + start,
        buffer.byteOffset + (end ?? buffer.byteLength)
      );
    },
  };
}

function monthKey(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export class MarketDataRepository {
  constructor(r2Client, datasetKey = "us_exchange_market_prices") {
    this.r2Client = r2Client;
    this.datasetKey = datasetKey;
    // Map<ticker, Array<{ month: string, close: number }>> sorted ascending by month.
    this.byTicker = new Map();
    this.loadedAt = 0;
  }

  // Fetches + parses the Parquet file and rebuilds the month-end-close index.
  // Safe to call repeatedly — only does work if the cache is empty or stale.
  async ensureLoaded() {
    const isStale = Date.now() - this.loadedAt > RELOAD_INTERVAL_MS;
    if (this.byTicker.size > 0 && !isStale) return;

    const { r2Key } = getDataset(this.datasetKey);
    const buffer = await this.r2Client.getObjectBuffer(r2Key);
    const rows = await parquetReadObjects({ file: toAsyncBuffer(buffer) });

    // One pass, O(N): keep the latest row seen per (ticker, month) — since
    // stg_market_prices is date-ascending this naturally lands on month-end.
    const latestByTickerMonth = new Map(); // ticker -> Map<month, close>
    for (const row of rows) {
      const ticker = row.ticker;
      const month = monthKey(row.date instanceof Date ? row.date : new Date(row.date));
      let monthMap = latestByTickerMonth.get(ticker);
      if (!monthMap) {
        monthMap = new Map();
        latestByTickerMonth.set(ticker, monthMap);
      }
      monthMap.set(month, row.close);
    }

    this.byTicker = new Map();
    for (const [ticker, monthMap] of latestByTickerMonth) {
      const series = Array.from(monthMap, ([month, close]) => ({ month, close }));
      series.sort((a, b) => (a.month < b.month ? -1 : a.month > b.month ? 1 : 0));
      this.byTicker.set(ticker, series);
    }
    this.loadedAt = Date.now();
  }

  // Returns the last `months + 1` month-end closes for a ticker (the "+1"
  // gives a starting point plus `months` returns), clamped to what exists.
  // { closes: number[], labels: string[] } both ordered oldest -> newest.
  async getMonthEndCloses(ticker, months) {
    await this.ensureLoaded();
    const series = this.byTicker.get(ticker);
    if (!series || series.length === 0) {
      throw new Error(`No data available for ticker "${ticker}"`);
    }

    const windowSize = Math.min(months + 1, series.length);
    const window = series.slice(series.length - windowSize);

    return {
      closes: window.map((point) => point.close),
      labels: window.map((point) => point.month),
    };
  }

  // All tickers currently present in the cache (mainly for diagnostics/health).
  async availableTickers() {
    await this.ensureLoaded();
    return Array.from(this.byTicker.keys());
  }
}
