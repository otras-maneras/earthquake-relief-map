import { ok, fail, preflight, rateLimited, withErrors } from '@/lib/api/http';
import { queryTelefonos } from '@/lib/api/query';
import { toTelefonoDTO } from '@/lib/api/serialize';

export const dynamic = 'force-dynamic';

export function OPTIONS() {
  return preflight();
}

// GET /v1/telefonos — teléfonos de emergencia (público, solo lectura).
export const GET = withErrors(async (req: Request) => {
  const limited = rateLimited(req, 'telefonos');
  if (limited) return limited;

  const url = new URL(req.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 200, 1), 500);
  const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0);
  const { rows, total } = await queryTelefonos(url.searchParams);
  return ok(rows.map(toTelefonoDTO), { total, limit, offset });
});

export function POST() {
  return fail(405, 'method_not_allowed', 'Solo GET. La API es de solo lectura.');
}
