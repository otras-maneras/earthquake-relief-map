import { send, preflight } from '@/lib/api/http';
import { openapiSpec } from '@/lib/api/openapi';

export const dynamic = 'force-dynamic';

export function OPTIONS() {
  return preflight();
}

// GET /v1/openapi.json — especificación OpenAPI 3.1 de la API.
export function GET() {
  return send(JSON.stringify(openapiSpec), { cache: true });
}
