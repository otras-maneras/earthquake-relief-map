// Helpers compartidos de la API pública v1 (api.acopiove.org/v1).
// CORS abierto, envoltura JSON consistente, caché de CDN y rate-limit por IP.

import { blockedFor, hit, clientIp } from '@/lib/ratelimit';

export const DATA_LICENSE = 'CC-BY-4.0';
export const DATA_ATTRIBUTION = 'Datos: AcopioVE (acopiove.org), CC-BY-4.0';
export const LICENSE_URL = 'https://creativecommons.org/licenses/by/4.0/';
export const API_BASE = 'https://api.acopiove.org/v1';

// Cache de borde: la data cambia poco; sirve ~5 min y refresca en background.
export const PUBLIC_CACHE = 'public, s-maxage=300, stale-while-revalidate=600';

export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

/** Respuesta a preflight CORS (OPTIONS). */
export function preflight(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

/** Respuesta cruda con CORS (+ caché opcional y content-type a medida). */
export function send(
  body: string,
  opts: { status?: number; cache?: boolean; contentType?: string; headers?: Record<string, string> } = {},
): Response {
  const headers: Record<string, string> = {
    ...CORS_HEADERS,
    'Content-Type': opts.contentType ?? 'application/json; charset=utf-8',
    ...(opts.headers ?? {}),
  };
  if (opts.cache) headers['Cache-Control'] = PUBLIC_CACHE;
  return new Response(body, { status: opts.status ?? 200, headers });
}

/** Campos de paginación que también se exponen en la raíz (compat. scrapers). */
const PAGINATION_ROOT_KEYS = ['total', 'limit', 'offset'] as const;

/** Envoltura estándar: { data, meta:{ count, license, attribution, ... } }. */
export function ok(
  data: unknown,
  meta: Record<string, unknown> = {},
  opts: { cache?: boolean; headers?: Record<string, string> } = {},
): Response {
  const metaBlock: Record<string, unknown> = {
    count: Array.isArray(data) ? data.length : undefined,
    license: DATA_LICENSE,
    license_url: LICENSE_URL,
    attribution: DATA_ATTRIBUTION,
    ...meta,
  };

  const body: Record<string, unknown> = { data, meta: metaBlock };

  // Duplicar total/limit/offset en la raíz cuando vienen en meta (sin costo extra:
  // ya están calculados). meta.* sigue siendo el contrato canónico.
  for (const key of PAGINATION_ROOT_KEYS) {
    const v = metaBlock[key];
    if (typeof v === 'number' && Number.isFinite(v)) body[key] = v;
  }

  return send(JSON.stringify(body), { cache: opts.cache ?? true, headers: opts.headers });
}

/** Error JSON con CORS (sin caché). */
export function fail(status: number, code: string, message: string, headers?: Record<string, string>): Response {
  return send(JSON.stringify({ error: code, message }), { status, headers });
}

/**
 * Envuelve un handler para que cualquier excepción devuelva un 500 limpio CON
 * cabeceras CORS (si no, el navegador ve un error de CORS opaco en vez del mensaje).
 */
export function withErrors<Ctx>(
  handler: (req: Request, ctx: Ctx) => Promise<Response> | Response,
): (req: Request, ctx: Ctx) => Promise<Response> {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (e) {
      console.error('[apiv1] error:', e instanceof Error ? e.message : e);
      return fail(500, 'internal_error', 'Error interno del servidor.');
    }
  };
}

/**
 * Rate-limit por IP para la API pública. Generoso (la mayoría de hits los absorbe
 * el CDN). Devuelve una respuesta 429 si está bloqueado, o null si puede continuar.
 */
export function rateLimited(req: Request, bucket: string): Response | null {
  const key = `apiv1:${bucket}:${clientIp(req)}`;
  const left = blockedFor(key);
  if (left > 0) {
    return fail(429, 'rate_limited', 'Demasiadas solicitudes. Reintenta más tarde.', { 'Retry-After': String(left) });
  }
  hit(key, 120, 60_000, 2 * 60_000); // 120 req/min por IP → bloqueo 2 min
  return null;
}

/** Formato pedido: ?format=geojson|csv|json, o por cabecera Accept. */
export function wantsFormat(req: Request): 'json' | 'geojson' | 'csv' {
  const url = new URL(req.url);
  const f = (url.searchParams.get('format') || '').toLowerCase();
  if (f === 'geojson' || f === 'csv' || f === 'json') return f;
  const accept = req.headers.get('accept') || '';
  if (accept.includes('geo+json')) return 'geojson';
  if (accept.includes('text/csv')) return 'csv';
  return 'json';
}
