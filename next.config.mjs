/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  async redirects() {
    return [
      // Servicios de mapas y búsquedas redirigen a la landing principal.
      // Solo la API pública y las páginas de contenido/documentación permanecen activas.
      { source: '/acopio', destination: '/', permanent: false },
      { source: '/mapa-3d', destination: '/', permanent: false },
      { source: '/busquedas', destination: '/', permanent: false },
      { source: '/busqueda-avanzada', destination: '/', permanent: false },
    ];
  },

  async headers() {
    // CSP en modo enforcing. Calibrada para lo que la app carga de verdad:
    //  - script-src: 'unsafe-inline' (scripts inline de Next, JSON-LD y el cargador
    //    de analytics) + los hosts externos de Umami y Google Analytics. Migrar a
    //    nonces y quitar 'unsafe-inline' es trabajo aparte.
    //  - worker-src blob:: MapLibre GL (/mapa-3d) crea Web Workers desde blob:.
    //  - img/connect https:: tiles CARTO/OpenFreeMap y las APIs de fuentes externas.
    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'self'",
      "img-src 'self' data: blob: https:",
      "script-src 'self' 'unsafe-inline' https://cloud.umami.is https://www.googletagmanager.com https://www.google-analytics.com",
      "style-src 'self' 'unsafe-inline'",
      "connect-src 'self' https:",
      "font-src 'self' data:",
      "form-action 'self'",
      "worker-src 'self' blob:",
    ].join('; ');
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // El botón "mi ubicación" usa geolocalización; el resto desactivado.
          { key: 'Permissions-Policy', value: 'geolocation=(self), camera=(), microphone=()' },
          { key: 'Content-Security-Policy', value: csp },
        ],
      },
    ];
  },
};

export default nextConfig;
