import type { Request, Response } from "express";
import { stats } from "../utils/stats";
import { NewsService } from "../services/news.service";

export const getNewsSummary = async (req: Request, res: Response) => {
  try {
    stats.trackRequest("POST /api/news/summary");

    const { sources, accountId } = req.body;

    if (!sources || !Array.isArray(sources) || !accountId) {
      res.status(400).json({
        ok: false,
        error:
          "Faltan parámetros requeridos ('sources' como arreglo y 'accountId').",
      });
      return;
    }

    const summary = await NewsService.generateSummary(sources, accountId);

    res.status(200).json({
      ok: true,
      summary,
    });
  } catch (error: any) {
    res.status(500).json({
      ok: false,
      error: error.message || "Error interno al generar el boletín.",
    });
  }
};
