import { ok, preflight, API_BASE } from '@/lib/api/http';

export const dynamic = 'force-dynamic';

export function OPTIONS() {
  return preflight();
}

// GET /v1 — índice de la API.
export function GET() {
  return ok(
    {
      name: 'AcopioVE API',
      version: '1.0.0',
      description: 'Centros de acopio, refugios y teléfonos de emergencia (Venezuela 2026). Solo lectura, abierta.',
      base_url: API_BASE,
      docs: `${API_BASE}/docs`,
      openapi: `${API_BASE}/openapi.json`,
      endpoints: {
        centros: `${API_BASE}/centros`,
        centro: `${API_BASE}/centros/{id}`,
        telefonos: `${API_BASE}/telefonos`,
        meta: `${API_BASE}/meta`,
      },
    },
    {},
  );
}
