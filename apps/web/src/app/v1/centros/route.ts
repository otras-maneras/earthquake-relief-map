import { ok, fail, preflight, rateLimited, send, wantsFormat, withErrors } from '@/lib/api/http';
import { parseCentrosQuery, queryCentros } from '@/lib/api/query';
import { toCentroDTO, toFeatureCollection, centrosToCSV } from '@/lib/api/serialize';

export const dynamic = 'force-dynamic';

export function OPTIONS() {
  return preflight();
}

// GET /v1/centros — centros de acopio y refugios (público, solo lectura).
export const GET = withErrors(async (req: Request) => {
  const limited = rateLimited(req, 'centros');
  if (limited) return limited;

  const url = new URL(req.url);
  const q = parseCentrosQuery(url.searchParams);
  const { rows, total } = await queryCentros(q);
  const items = rows.map(toCentroDTO);

  const format = wantsFormat(req);
  if (format === 'geojson') {
    return send(JSON.stringify(toFeatureCollection(items)), {
      cache: true,
      contentType: 'application/geo+json; charset=utf-8',
    });
  }
  if (format === 'csv') {
    return send(centrosToCSV(items), { cache: true, contentType: 'text/csv; charset=utf-8' });
  }

  return ok(items, { total, limit: q.limit, offset: q.offset });
});

// Cualquier otro método: 405 con CORS.
export function POST() {
  return fail(405, 'method_not_allowed', 'Solo GET. La API es de solo lectura.');
}
