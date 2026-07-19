// Vercel serverless function: GET /api/investment/projection
// Thin adapter over the framework-agnostic business logic in api/_lib/ —
// same InvestmentController used previously by the standalone Fastify
// server, just wired to Vercel's (req, res) signature instead of routes.js.

import { R2Client } from "../_lib/data-access/R2Client.js";
import { MarketDataRepository } from "../_lib/data-access/MarketDataRepository.js";
import { InvestmentController } from "../_lib/api-management/InvestmentController.js";

// Reused across warm invocations of this function instance so the
// MarketDataRepository's in-memory Parquet cache actually pays off between
// requests, instead of re-fetching R2 on every single call.
let controller;
function getController() {
  if (!controller) {
    const repository = new MarketDataRepository(new R2Client());
    controller = new InvestmentController(repository);
  }
  return controller;
}

export default async function handler(req, res) {
  try {
    const result = await getController().getProjection(req.query);
    res.status(200).json(result);
  } catch (error) {
    if (error && error.statusCode) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      console.error(error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
}
