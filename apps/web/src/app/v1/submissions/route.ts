import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { fail, send, CORS_HEADERS, API_BASE } from '@/lib/api/http';
import { centroSchema, SUGERENCIA_FIELDS } from '@/lib/validation';
import { blockedFor, hit, clientIp } from '@/lib/ratelimit';
import { db } from '@/db';
import { centros, centroSugerencias } from '@/db/schema';
import { findPossibleDuplicate } from '@/lib/api/duplicates';

export const dynamic = 'force-dynamic';

// CORS de escritura (permite POST además de GET/OPTIONS).
const WRITE_CORS: Record<string, string> = {
  ...CORS_HEADERS,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: WRITE_CORS });
}

// `source` = plataforma que contribuye (atribución). `website` = honeypot anti-bot.
// `external_id` = id del registro en el sistema de origen (ver normalizeBody / linking).
const submissionSchema = centroSchema.extend({
  source: z.string().max(120).optional().nullable(),
  website: z.string().optional().nullable(),
  external_id: z.string().max(120).optional().nullable(),
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Acepta el shape de LECTURA del DTO de /v1/centros (lat/lng/necesita_ahora) además del
// canónico de escritura (latitude/longitude/necesitaAhora), y `id` como alias de
// external_id. Así un consumidor que modele su POST sobre el objeto que LEE de la API
// funciona sin fricción (ej. el push de refugios de HelpMap).
function normalizeBody(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const b: Record<string, unknown> = { ...(raw as Record<string, unknown>) };
  if (b.latitude == null && b.lat != null) b.latitude = b.lat;
  if (b.longitude == null && b.lng != null) b.longitude = b.lng;
  if (b.necesitaAhora == null && b.necesita_ahora != null) b.necesitaAhora = b.necesita_ahora;
  if (b.external_id == null && b.id != null) b.external_id = b.id;
  return b;
}

// Payload de sugerencia: solo los campos de un centro que una edición puede proponer.
function buildSugerenciaPayload(d: Record<string, unknown>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const f of SUGERENCIA_FIELDS) {
    const v = d[f];
    if (v == null) continue;
    if (typeof v === 'string') {
      const t = v.trim();
      if (t) payload[f] = t;
    } else if (Array.isArray(v)) {
      if (v.length) payload[f] = v;
    } else {
      payload[f] = v;
    }
  }
  return payload;
}

// POST /v1/submissions — ingesta pública de sugerencias de puntos de apoyo.
// Abierto (sin llave), rate-limited, con honeypot. Dos caminos:
//   • Si `external_id` es el UUID de un centro nuestro existente → EDICIÓN: entra como
//     sugerencia moderada sobre ese centro (no crea un duplicado).
//   • Si no → ALTA nueva PENDIENTE (active=false), guardando external_id para trazabilidad.
// Un admin de AcopioVE revisa ambos casos antes de publicar.
export async function POST(req: Request) {
  // Rate-limit estricto de escritura: 10 sugerencias por IP cada 10 min.
  const key = `apiv1:submit:${clientIp(req)}`;
  const left = blockedFor(key);
  if (left > 0) {
    return fail(429, 'rate_limited', 'Demasiadas sugerencias seguidas. Reintenta más tarde.', {
      ...WRITE_CORS,
      'Retry-After': String(left),
    });
  }
  hit(key, 10, 10 * 60 * 1000, 10 * 60 * 1000);

  const raw = await req.json().catch(() => null);

  // Honeypot: un bot rellena `website`. Respondemos OK falso sin guardar nada.
  if (raw && typeof raw === 'object' && (raw as Record<string, unknown>).website) {
    return send(JSON.stringify({ data: { id: null, status: 'pending', possible_duplicate: false } }), {
      status: 201,
      headers: WRITE_CORS,
    });
  }

  const parsed = submissionSchema.safeParse(normalizeBody(raw));
  if (!parsed.success) {
    return fail(400, 'invalid', parsed.error.issues[0]?.message || 'Datos inválidos.', WRITE_CORS);
  }
  const d = parsed.data;
  const externalId = d.external_id?.trim() || null;

  // Camino EDICIÓN: el external_id apunta a un centro nuestro existente → sugerencia moderada.
  if (externalId && UUID_RE.test(externalId)) {
    const [centro] = await db.select({ id: centros.id }).from(centros).where(eq(centros.id, externalId));
    if (centro) {
      const payload = buildSugerenciaPayload(d as unknown as Record<string, unknown>);
      const [sug] = await db
        .insert(centroSugerencias)
        .values({
          centroId: centro.id,
          payload,
          fuente: d.source?.trim() || d.fuente?.trim() || 'Sugerencia (API v1)',
          status: 'pending',
        })
        .returning({ id: centroSugerencias.id });
      return send(
        JSON.stringify({
          data: {
            id: sug.id,
            status: 'pending',
            kind: 'suggestion',
            linked_to: centro.id,
            possible_duplicate: false,
          },
          meta: {
            message:
              'Edición recibida como sugerencia sobre un centro existente. Será revisada por AcopioVE antes de aplicarse.',
          },
        }),
        { status: 201, headers: WRITE_CORS },
      );
    }
    // external_id con forma de UUID pero sin match → cae al alta nueva (se conserva el id).
  }

  // Camino ALTA nueva: centro pendiente (active=false), guardando external_id.
  const dup = await findPossibleDuplicate(d.latitude, d.longitude, d.name);

  const [row] = await db
    .insert(centros)
    .values({
      name: d.name,
      address: d.address ?? null,
      latitude: String(d.latitude),
      longitude: String(d.longitude),
      recibe: d.recibe,
      necesitaAhora: d.necesitaAhora ?? null,
      horario: d.horario ?? null,
      contacto: d.contacto ?? null,
      estado: d.estado,
      tipo: d.tipo,
      responsable: d.responsable ?? null,
      // Atribución: la plataforma que contribuyó (o fuente declarada, o genérico).
      fuente: d.source?.trim() || d.fuente?.trim() || 'Sugerencia (API v1)',
      pais: d.pais ?? null,
      ciudad: d.ciudad ?? null,
      externalId,
      active: false,
    })
    .returning({ id: centros.id });

  return send(
    JSON.stringify({
      data: {
        id: row.id,
        status: 'pending',
        kind: 'new',
        possible_duplicate: !!dup,
        duplicate_of: dup ? { id: dup.id, name: dup.name, distance_m: dup.distanceM } : null,
      },
      meta: {
        message: 'Sugerencia recibida. Será revisada por AcopioVE antes de publicarse como verificada.',
        status_url: `${API_BASE}/submissions/${row.id}`,
      },
    }),
    { status: 201, headers: WRITE_CORS },
  );
}

export function GET() {
  return fail(
    405,
    'method_not_allowed',
    'Usa POST para enviar una sugerencia, o GET /v1/submissions/{id} para consultar su estado.',
    WRITE_CORS,
  );
}
