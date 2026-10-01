import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { send, fail, CORS_HEADERS } from '@/lib/api/http';
import { db } from '@/db';
import { centros } from '@/db/schema';

export const dynamic = 'force-dynamic';

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

// GET /v1/submissions/{id} — estado de una sugerencia (read-only).
//   pending  → recibida, en revisión.
//   approved → revisada y publicada (ya visible en /v1/centros y el mapa).
//   404      → no existe (pudo ser rechazada/eliminada).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return fail(400, 'invalid_id', 'ID inválido.');
  }

  const [row] = await db
    .select({
      id: centros.id,
      name: centros.name,
      tipo: centros.tipo,
      ciudad: centros.ciudad,
      pais: centros.pais,
      active: centros.active,
      createdAt: centros.createdAt,
      updatedAt: centros.updatedAt,
    })
    .from(centros)
    .where(eq(centros.id, id))
    .limit(1);

  if (!row) {
    return fail(404, 'not_found', 'No existe una sugerencia con ese id (pudo ser rechazada).');
  }

  // No se cachea: el estado cambia al aprobarse.
  return send(
    JSON.stringify({
      data: {
        id: row.id,
        status: row.active ? 'approved' : 'pending',
        name: row.name,
        tipo: row.tipo,
        ciudad: row.ciudad,
        pais: row.pais,
        submitted_at: row.createdAt,
        updated_at: row.updatedAt,
      },
    }),
    { status: 200 },
  );
}
