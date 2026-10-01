import { Router } from "express";
import type { Request, Response } from "express";

import { getNewsSummary } from "../controllers/news.controller";
import { stats } from "../utils/stats";

const router = Router();

router.post("/summary", getNewsSummary);

router.get("/stats", (_req: Request, res: Response) => {
  res.json({ ok: true, stats: stats.getStats() });
});

export default router;
