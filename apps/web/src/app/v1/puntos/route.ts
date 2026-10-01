import { ok, fail, preflight, rateLimited, send, wantsFormat, withErrors } from '@/lib/api/http';
import { buildPuntos, parsePuntosQuery, filterPuntos, puntosToFeatureCollection, puntosToCSV } from '@/lib/api/puntos';

export const dynamic = 'force-dynamic';

export function OPTIONS() {
  return preflight();
}

// GET /v1/puntos — directorio unificado de ayuda (público, solo lectura):
// acopios, refugios, teléfonos de emergencia y puntos de salud/hospitales.
// Pensado para apps y chatbots: una sola llamada, JSON/GeoJSON/CSV.
// Filtros: tipo (CSV), ciudad, pais, near=lat,lng (+radius km), limit, offset.
export const GET = withErrors(async (req: Request) => {
  const limited = rateLimited(req, 'puntos');
  if (limited) return limited;

  const url = new URL(req.url);
  const q = parsePuntosQuery(url.searchParams);
  const all = await buildPuntos();
  const { rows, total } = filterPuntos(all, q);

  const format = wantsFormat(req);
  if (format === 'geojson') {
    return send(JSON.stringify(puntosToFeatureCollection(rows)), {
      cache: true,
      contentType: 'application/geo+json; charset=utf-8',
    });
  }
  if (format === 'csv') {
    return send(puntosToCSV(rows), { cache: true, contentType: 'text/csv; charset=utf-8' });
  }

  return ok(rows, {
    total,
    limit: q.limit,
    offset: q.offset,
    tipos: ['acopio', 'refugio', 'salud', 'telefono'],
    note: 'Directorio de ayuda. No incluye datos de personas (PII).',
  });
});

export function POST() {
  return fail(405, 'method_not_allowed', 'Solo GET. Para contribuir puntos usa POST /v1/submissions.');
}
