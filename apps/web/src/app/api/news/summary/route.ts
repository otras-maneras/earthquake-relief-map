import { NextResponse } from "next/server";
import { NewsService } from "@/lib/news";

function parseSourcesParam(searchParams: URLSearchParams): string[] | null {
  const raw = searchParams.get("sources");
  if (!raw?.trim()) return ["all"];
  const sources = raw.split(",").map((s) => s.trim()).filter(Boolean);
  return sources.length > 0 ? sources : null;
}

/** Lee el boletín ya generado (caché en disco) sin llamar al modelo de IA. */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sources = parseSourcesParam(searchParams);
    if (!sources) {
      return NextResponse.json(
        { ok: false, error: "Parámetro 'sources' inválido. Ejemplo: ?sources=all o ?sources=elpais,dw" },
        { status: 400 },
      );
    }

    const result = await NewsService.getCachedSummary(sources);
    if (!result.summary) {
      return NextResponse.json(
        {
          ok: false,
          error: "No hay boletín en caché para esas fuentes. Use POST para generar el primero.",
          history: result.history,
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      ok: true,
      summary: result.summary,
      cachedAt: result.cachedAt,
      history: result.history,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error interno del servidor.";
    console.error("[API_NEWS_SUMMARY_GET_ERROR]:", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/**
 * Genera/regenera el boletín (llama al modelo de IA, tiene costo real). Reservado al cron
 * interno del servidor — el público solo puede LEER vía GET (caché en disco), nunca disparar
 * una generación. Ver NEWS_CRON_SECRET en .env.
 */
export async function POST(request: Request) {
  try {
    const secret = process.env.NEWS_CRON_SECRET;
    if (!secret) {
      return NextResponse.json({ ok: false, error: "Generación deshabilitada (falta configurar NEWS_CRON_SECRET)." }, { status: 503 });
    }
    if (request.headers.get("x-cron-secret") !== secret) {
      return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
    }

    const body = await request.json();
    const { sources, accountId } = body;

    if (!sources || !Array.isArray(sources) || sources.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Debes proporcionar un array de fuentes ('sources')." },
        { status: 400 }
      );
    }

    const account = accountId || "anonymous-web";
    const result = await NewsService.generateSummary(sources, account);

    return NextResponse.json({ ok: true, summary: result.summary, history: result.history });
  } catch (error: any) {
    console.error("[API_NEWS_SUMMARY_ERROR]:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Error interno del servidor." },
      { status: 500 }
    );
  }
}
