// Entry point: loads env, wires repository -> controller -> routes, and
// starts listening. Run with `npm start` or `node server.js` from Backend/.

import { fileURLToPath } from "node:url";
import path from "node:path";
import dotenv from "dotenv";
import Fastify from "fastify";
import cors from "@fastify/cors";

import { R2Client } from "./src/data-access/R2Client.js";
import { MarketDataRepository } from "./src/data-access/MarketDataRepository.js";
import { InvestmentController } from "./src/api-management/InvestmentController.js";
import { registerRoutes } from "./src/api-management/routes.js";

// .env lives at the repo root (shared with the Dagster pipeline), not
// inside Backend/, so load it explicitly regardless of the CWD this is run from.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const PORT = Number(process.env.PORT) || 8080;

// Allowed origins for the Frontend to call this API from.
const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
];

async function main() {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: ALLOWED_ORIGINS });

  const r2Client = new R2Client();
  const marketDataRepository = new MarketDataRepository(r2Client);
  const investmentController = new InvestmentController(marketDataRepository);

  registerRoutes(app, investmentController);

  // Warm the cache at boot so the first real request isn't slow.
  try {
    await marketDataRepository.ensureLoaded();
    app.log.info("Market data cache warmed.");
  } catch (error) {
    app.log.warn({ err: error }, "Could not warm market data cache at boot — will retry on first request.");
  }

  await app.listen({ port: PORT, host: "0.0.0.0" });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
