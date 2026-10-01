import { ok, fail, preflight, rateLimited, withErrors } from '@/lib/api/http';
import { parsePersonasQuery, searchPersonas } from '@/lib/api/personas-search';

export const dynamic = 'force-dynamic';

export function OPTIONS() {
  return preflight();
}

// GET /v1/personas — búsqueda PII-segura de personas reportadas (reunificación).
// Para apps y chatbots: "¿está [nombre] reportado como desaparecido/localizado?".
// Requiere `q` (nombre) o `cedula` — es un lookup, no un volcado del registro.
// Devuelve nombre, estado, ubicación general, foto, fuente; cédula enmascarada;
// sin teléfono ni GPS; protege la ubicación de menores.
export const GET = withErrors(async (req: Request) => {
  const limited = rateLimited(req, 'personas');
  if (limited) return limited;

  const url = new URL(req.url);
  const q = parsePersonasQuery(url.searchParams);

  if ((!q.q || q.q.length < 2) && (!q.cedula || q.cedula.length < 3)) {
    return fail(
      400,
      'missing_query',
      'Indica un nombre (`q`, mín. 2 caracteres) o una cédula (`cedula`). Es una búsqueda, no un listado completo.',
    );
  }

  const { rows, total } = await searchPersonas(q);

  return ok(rows, {
    total,
    limit: q.limit,
    query: { q: q.q ?? null, cedula: q.cedula ? '***' : null, estado: q.estado ?? null },
    privacy: 'Datos PII-seguros: cédula enmascarada, sin teléfono ni GPS; ubicación de menores omitida.',
  });
});

export function POST() {
  return fail(405, 'method_not_allowed', 'Solo GET (búsqueda de solo lectura).');
}
