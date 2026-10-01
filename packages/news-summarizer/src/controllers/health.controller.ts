import type { Request, Response } from "express";
import { stats } from "../utils/stats";

export const checkHealth = async (_req: Request, res: Response) => {
  stats.trackRequest("GET /health");
  res.status(200).json({
    status: "available",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
  });
};
