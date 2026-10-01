import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { centros } from '@/db/schema';
import { ok, fail, preflight, rateLimited, send, wantsFormat, withErrors } from '@/lib/api/http';
import { toCentroDTO, toFeatureCollection, type CentroRow } from '@/lib/api/serialize';

export const dynamic = 'force-dynamic';

export function OPTIONS() {
  return preflight();
}

// GET /v1/centros/{id} — un centro por id (solo activos).
export const GET = withErrors(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const limited = rateLimited(req, 'centros-id');
  if (limited) return limited;

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return fail(400, 'invalid_id', 'El id debe ser un UUID válido.');
  }

  const [row] = (await db
    .select({
      id: centros.id,
      name: centros.name,
      address: centros.address,
      latitude: centros.latitude,
      longitude: centros.longitude,
      recibe: centros.recibe,
      necesitaAhora: centros.necesitaAhora,
      horario: centros.horario,
      contacto: centros.contacto,
      estado: centros.estado,
      tipo: centros.tipo,
      responsable: centros.responsable,
      fuente: centros.fuente,
      pais: centros.pais,
      ciudad: centros.ciudad,
      updatedAt: centros.updatedAt,
    })
    .from(centros)
    .where(and(eq(centros.id, id), eq(centros.active, true)))
    .limit(1)) as CentroRow[];

  if (!row) return fail(404, 'not_found', 'Centro no encontrado.');

  const dto = toCentroDTO(row);
  if (wantsFormat(req) === 'geojson') {
    return send(JSON.stringify(toFeatureCollection([dto]).features[0]), {
      cache: true,
      contentType: 'application/geo+json; charset=utf-8',
    });
  }
  return ok(dto);
});
