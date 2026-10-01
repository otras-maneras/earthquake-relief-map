import { NextResponse } from "next/server";
import { stats } from "@/lib/news";

export async function GET() {
  try {
    const statsData = stats.getStats();
    return NextResponse.json({ ok: true, stats: statsData });
  } catch (error: any) {
    console.error("[API_NEWS_STATS_ERROR]:", error);
    return NextResponse.json(
      { ok: false, error: "Error al cargar las estadísticas." },
      { status: 500 }
    );
  }
}
