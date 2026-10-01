import { CORS_HEADERS } from '@/lib/api/http';

export const dynamic = 'force-dynamic';

// GET /v1/docs — documentación interactiva (Scalar) sobre el OpenAPI.
export function GET() {
  const html = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>AcopioVE API — Documentación</title>
    <link rel="icon" href="https://acopiove.org/favicon.ico" />
  </head>
  <body>
    <script id="api-reference" data-url="/v1/openapi.json"></script>
    <script>
      var configuration = { theme: 'default', metaData: { title: 'AcopioVE API' } };
      document.getElementById('api-reference').dataset.configuration = JSON.stringify(configuration);
    </script>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
  </body>
</html>`;
  return new Response(html, {
    status: 200,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600',
    },
  });
}
