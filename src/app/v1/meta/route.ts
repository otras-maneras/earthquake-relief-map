import { sql, eq, and } from 'drizzle-orm';
import { db } from '@/db';
import { centros, telefonos } from '@/db/schema';
import { ok, preflight, rateLimited, withErrors } from '@/lib/api/http';

export const dynamic = 'force-dynamic';

export function OPTIONS() {
  return preflight();
}

// GET /v1/meta — conteos, última actualización y datos de licencia.
export const GET = withErrors(async (req: Request) => {
  const limited = rateLimited(req, 'meta');
  if (limited) return limited;

  const [c] = await db
    .select({
      total: sql<number>`count(*)::int`,
      refugios: sql<number>`count(*) filter (where ${centros.tipo} = 'refugio')::int`,
      acopios: sql<number>`count(*) filter (where ${centros.tipo} = 'acopio')::int`,
      paises: sql<number>`count(distinct ${centros.pais})::int`,
      updatedAt: sql<string | null>`max(${centros.updatedAt})`,
    })
    .from(centros)
    .where(eq(centros.active, true));

  const [t] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(telefonos)
    .where(eq(telefonos.active, true));

  return ok(
    {
      centros: { total: c.total, acopios: c.acopios, refugios: c.refugios, paises: c.paises },
      telefonos: { total: t.total },
      updated_at: c.updatedAt,
    },
    { endpoints: ['/v1/centros', '/v1/centros/{id}', '/v1/telefonos', '/v1/meta', '/v1/openapi.json'] },
  );
});
