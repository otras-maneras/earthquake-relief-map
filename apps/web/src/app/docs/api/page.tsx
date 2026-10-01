import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, Code, Database, ShieldCheck, Globe, RefreshCw, MessageCircle } from 'lucide-react';
import { SiteHeader, SiteFooter, Eyebrow, ES_NAV, BRAND_PALETTE } from '@/components/site/Chrome';

export const revalidate = 300;

const SITE_URL = 'https://acopiove.org';

export const metadata: Metadata = {
  title: 'Documentación de la API Pública - AcopioVE',
  description:
    'Documentación técnica para consumir y reutilizar los datos abiertos de AcopioVE. Endpoints de centros de acopio, refugios y teléfonos de emergencia (terremoto de Venezuela 2026).',
  alternates: { canonical: `${SITE_URL}/docs/api` },
  openGraph: {
    type: 'website',
    locale: 'es_VE',
    url: `${SITE_URL}/docs/api`,
    siteName: 'AcopioVE',
    title: 'Documentación de la API Pública - AcopioVE',
    description: 'Endpoints de centros de acopio, refugios y teléfonos de emergencia.',
    images: [{ url: '/og-image-v2.png', width: 1200, height: 630, alt: 'AcopioVE API' }],
  },
};

export default function ApiDocsPage() {
  const sections = [
    { id: 'introduccion', title: 'Introducción' },
    { id: 'generalidades', title: 'Generalidades' },
    { id: 'hub-deduplicacion', title: 'Hub de APIs y Deduplicación' },
    { id: 'endpoints', title: 'Endpoints' },
    { id: 'boletin-noticias', title: 'Boletín de noticias' },
    { id: 'personas', title: 'Búsqueda de personas' },
    { id: 'contribuir', title: 'Contribuir datos' },
    { id: 'chatbot', title: 'Integración WhatsApp' },
    { id: 'formatos', title: 'Formatos de salida' },
    { id: 'ejemplos', title: 'Ejemplos de código' },
    { id: 'licencia', title: 'Licencia y Atribución' },
  ];

  return (
    <main id="main-content" className="min-h-[100dvh] bg-ap-bg font-sans" style={BRAND_PALETTE}>
      <SiteHeader nav={ES_NAV} active="/docs" />

      {/* Hero */}
      <section className="border-b border-ap-border bg-ap-surface">
        <div className="max-w-[1000px] mx-auto px-4 py-12 md:py-16">
          <div className="flex items-center gap-2">
            <Link
              href="/docs"
              className="text-[13px] font-bold text-ap-muted hover:text-ap-primary flex items-center gap-1.5 transition-colors group"
            >
              <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
              Volver a Documentación
            </Link>
          </div>
          <div className="mt-4">
            <Eyebrow>Desarrolladores y Datos Abiertos</Eyebrow>
          </div>
          <h1 className="text-[30px] md:text-[40px] font-extrabold text-ap-primary font-outfit leading-[1.08] mt-3 max-w-3xl">
            Documentación de la API Pública (v1)
          </h1>
          <p className="text-[16px] text-ap-secondary mt-4 max-w-2xl leading-relaxed">
            Consuma de forma programática, libre y abierta toda la información de centros de acopio, refugios y teléfonos de emergencia recopilada en AcopioVE.
          </p>
          <div className="flex flex-wrap gap-3 mt-6">
            <a
              href="https://api.acopiove.org/v1/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-ap-primary text-ap-surface text-[14px] font-bold px-4 py-2.5 rounded-lg hover:opacity-90 transition-opacity"
            >
              Consola Interactiva (Scalar)
              <ExternalLink size={14} />
            </a>
            <a
              href="https://api.acopiove.org/v1/openapi.json"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 border border-ap-border bg-ap-surface text-ap-primary text-[14px] font-bold px-4 py-2.5 rounded-lg hover:bg-ap-surface-hover transition-colors"
            >
              Especificación OpenAPI 3.1
              <Code size={14} />
            </a>
          </div>
        </div>
      </section>

      {/* Contenido */}
      <section className="max-w-[1000px] mx-auto px-4 py-12">
        <div className="flex flex-col md:flex-row gap-8 items-start">
          {/* Navegación lateral (Sticky Sidebar) */}
          <aside className="w-full md:w-[260px] shrink-0 sticky top-20 hidden md:block border border-ap-border rounded-xl p-4 bg-ap-surface">
            <h2 className="text-[13px] font-bold text-ap-muted uppercase tracking-[0.08em] border-b border-ap-border pb-2 mb-3">
              En esta guía
            </h2>
            <nav className="flex flex-col gap-1">
              {sections.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className="text-[13.5px] font-medium text-ap-secondary hover:text-ap-primary transition-colors py-1 leading-normal"
                >
                  {s.title}
                </a>
              ))}
            </nav>
          </aside>

          {/* Artículos de documentación */}
          <article className="w-full md:flex-1 min-w-0 space-y-12">
            {/* Introducción */}
            <section id="introduccion" className="scroll-mt-20">
              <h2 className="text-[20px] md:text-[24px] font-extrabold text-ap-primary font-outfit">
                Introducción
              </h2>
              <div className="text-[15px] text-ap-secondary mt-4 space-y-4 leading-relaxed">
                <p>
                  Durante situaciones de emergencia humanitaria, la fluidez y el acceso a la información salvan vidas. La API de <strong>AcopioVE</strong> permite a medios, desarrolladores, ONG, brigadas y <strong>chatbots/asistentes</strong> consultar de forma libre y automatizada los registros verificados. El endpoint estrella es <a href="#endpoints" className="font-bold text-ap-primary hover:underline"><code className="font-mono">/puntos</code></a>: un <strong>directorio de ayuda unificado</strong> (acopios, refugios, teléfonos y salud) en una sola llamada. Además, otras plataformas pueden <a href="#contribuir" className="font-bold text-ap-primary hover:underline">contribuir nuevos puntos</a>.
                </p>
                <div className="bg-emerald-50 border border-emerald-150 rounded-xl p-4 text-[14px] text-emerald-950 flex gap-3">
                  <ShieldCheck className="text-emerald-800 mt-0.5 shrink-0" size={18} />
                  <div>
                    <strong>API Abierta e Inclusiva:</strong> no se requiere clave ni autenticación. La lectura es 100% pública; las contribuciones (<code className="font-mono">POST /submissions</code>) también son abiertas, pero entran como <strong>pendientes</strong> y se revisan antes de publicarse. No exponemos datos de personas (PII).
                  </div>
                </div>
                <div className="border border-ap-border rounded-xl p-4 bg-ap-surface/40 text-[14px] flex items-start gap-3">
                  <Database className="text-ap-muted mt-0.5 shrink-0" size={18} />
                  <div>
                    <strong className="text-ap-primary">AcopioVE funciona como un hub:</strong> además de nuestros datos propios,
                    esta API <strong>agrega y unifica</strong> múltiples fuentes públicas (registros de personas, puntos de salud, daños y más),
                    conservando la atribución de cada una. ¿De dónde viene cada dato? Mirá el catálogo completo de fuentes en{' '}
                    <Link href="/docs/fuentes" className="font-bold text-ap-primary hover:underline">/docs/fuentes</Link>.
                  </div>
                </div>
              </div>
            </section>

            {/* Generalidades */}
            <section id="generalidades" className="scroll-mt-20 border-t border-ap-border pt-10">
              <h2 className="text-[20px] md:text-[24px] font-extrabold text-ap-primary font-outfit">
                Generalidades técnicas
              </h2>
              <div className="text-[15px] text-ap-secondary mt-4 space-y-4 leading-relaxed">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="border border-ap-border rounded-xl p-4 bg-ap-surface/40">
                    <div className="flex items-center gap-2 text-ap-primary font-bold text-[14.5px] font-outfit">
                      <Globe size={16} />
                      URL Base de Producción
                    </div>
                    <div className="mt-2 font-mono text-[13px] bg-ap-bg border border-ap-border p-2 rounded select-all break-all">
                      https://api.acopiove.org/v1
                    </div>
                  </div>
                  <div className="border border-ap-border rounded-xl p-4 bg-ap-surface/40">
                    <div className="flex items-center gap-2 text-ap-primary font-bold text-[14.5px] font-outfit">
                      <RefreshCw size={16} />
                      Límites y Caché
                    </div>
                    <p className="mt-2 text-[13px] text-ap-secondary">
                      Rate limit de <strong>120 solicitudes por minuto por IP</strong>. Las respuestas exitosas son cacheadas en el edge (Cloudflare) por 5 minutos, reduciendo drásticamente la latencia.
                    </p>
                  </div>
                </div>
                <p>
                  Todas las respuestas exitosas de tipo JSON siguen una estructura consistente de envoltura.
                  En listados paginados (<code className="font-mono">/centros</code>, <code className="font-mono">/telefonos</code>, <code className="font-mono">/puntos</code>, <code className="font-mono">/personas</code>), los campos <code className="font-mono">total</code>, <code className="font-mono">limit</code> y <code className="font-mono">offset</code> aparecen también en la <strong>raíz</strong> del JSON (además de en <code className="font-mono">meta</code>) para compatibilidad con scrapers y clientes genéricos.
                </p>
                <pre className="bg-ap-primary text-ap-surface-hover p-4 rounded-xl font-mono text-[13px] overflow-x-auto leading-normal">
{`{
  "data": [ ... ],
  "meta": {
    "count": 100,
    "total": 647,
    "limit": 100,
    "offset": 0,
    "license": "CC-BY-4.0",
    "license_url": "https://creativecommons.org/licenses/by/4.0/",
    "attribution": "Datos: AcopioVE (acopiove.org), CC-BY-4.0"
  },
  "total": 647,
  "limit": 100,
  "offset": 0
}`}
                </pre>
              </div>
            </section>

            {/* Hub de APIs y Deduplicación */}
            <section id="hub-deduplicacion" className="scroll-mt-20 border-t border-ap-border pt-10">
              <h2 className="text-[20px] md:text-[24px] font-extrabold text-ap-primary font-outfit">
                Arquitectura de Agregación y Deduplicación
              </h2>
              <div className="text-[15px] text-ap-secondary mt-4 space-y-4 leading-relaxed">
                <p>
                  Para simplificar el desarrollo de aplicaciones de asistencia en medio de la crisis, AcopioVE funciona como un <strong>Hub de Agregación de Datos</strong>. En lugar de exigir a los integradores consultar múltiples APIs por separado, nuestro backend unifica en tiempo real los registros de:
                </p>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li><strong>SOS Venezuela:</strong> Indicadores y listado de personas desaparecidas o a salvo.</li>
                  <li><strong>Localizados Venezuela:</strong> Directorio de personas en centros de salud y albergues.</li>
                  <li><strong>CIVIS Venezuela:</strong> Red verídica de hospitales y puntos de primera respuesta.</li>
                  <li><strong>Mapa de Daños (terremotovenezuela.com):</strong> Registro georreferenciado de edificios afectados.</li>
                  <li><strong>Reporte VE:</strong> Incidencias y cortes de servicios públicos en vivo.</li>
                  <li><strong>Centros de Insumos:</strong> Requerimientos de suministros y depósitos logísticos.</li>
                  <li><strong>Hub Venezuela Ayuda:</strong> Consolidado de ofertas y peticiones ciudadanas.</li>
                  <li><strong>ResponseGrid:</strong> Requerimientos validados por equipos de rescate profesionales.</li>
                </ul>

                <h3 className="text-[16px] font-bold text-ap-primary font-outfit mt-4">
                  Mecanismos de Deduplicación y Consistencia
                </h3>
                <p>
                  La unificación de datos provenientes de múltiples plataformas genera redundancia de registros. Para asegurar un mapa limpio y evitar la duplicidad, el servidor aplica los siguientes controles:
                </p>
                <div className="space-y-3 mt-2">
                  <div className="border border-ap-border rounded-xl p-4 bg-ap-surface/40">
                    <strong className="text-ap-primary block">Exclusión selectiva de capas redundantes:</strong>
                    Se filtran e ignoran de forma preventiva los datos duplicados en el origen. Por ejemplo, se omiten los daños estructurales de la API de Venezuela Ayuda para priorizar la API directa de <em>terremotovenezuela.com</em>, y se limita la ingesta de ResponseGrid exclusivamente a las necesidades de insumos validadas.
                  </div>
                  <div className="border border-ap-border rounded-xl p-4 bg-ap-surface/40">
                    <strong className="text-ap-primary block">Detección de duplicados en contribuciones (/submissions):</strong>
                    Al sugerir un punto de apoyo, el backend realiza un análisis automático cruzando coordenadas geográficas (distancia menor a 100 metros mediante fórmula de Haversine) y similitud de texto en los nombres. Si coincide, la API retorna la advertencia <code>possible_duplicate: true</code> junto con el ID del punto original.
                  </div>
                </div>
              </div>
            </section>

            {/* Endpoints */}
            <section id="endpoints" className="scroll-mt-20 border-t border-ap-border pt-10">
              <h2 className="text-[20px] md:text-[24px] font-extrabold text-ap-primary font-outfit">
                Endpoints de la API
              </h2>
              <div className="text-[15px] text-ap-secondary mt-4 space-y-8 leading-relaxed">
                {/* Endpoint Puntos (unificado, destacado) */}
                <div className="border border-ap-primary/30 rounded-xl p-4 bg-ap-primary/[0.03]">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="text-[11px] font-extrabold bg-emerald-800 text-ap-surface px-2 py-0.5 rounded font-mono">GET</span>
                    <h3 className="text-[16px] font-bold text-ap-primary font-outfit font-mono">/puntos</h3>
                    <span className="text-[10px] font-extrabold text-ap-primary bg-ap-bg border border-ap-border px-2 py-0.5 rounded-full uppercase tracking-wider">Recomendado para apps y chatbots</span>
                  </div>
                  <p className="mt-2 text-[14px]">
                    <strong>Directorio de ayuda unificado en una sola llamada:</strong> centros de acopio, refugios, teléfonos de
                    emergencia y puntos de salud/hospitales. No incluye personas (PII). Cada punto trae su <code className="font-mono">fuente</code> y <code className="font-mono">fuente_url</code>.
                  </p>
                  <h4 className="text-[13px] font-bold text-ap-muted uppercase mt-3 tracking-wider">Parámetros</h4>
                  <ul className="mt-1.5 space-y-1 text-[13.5px]">
                    <li><code className="font-mono bg-ap-bg border border-ap-border px-1 py-0.5 rounded">tipo</code> — CSV: <code className="font-mono">acopio,refugio,salud,telefono</code></li>
                    <li><code className="font-mono bg-ap-bg border border-ap-border px-1 py-0.5 rounded">ciudad</code> / <code className="font-mono bg-ap-bg border border-ap-border px-1 py-0.5 rounded">pais</code> — coincidencia parcial, sin acentos</li>
                    <li><code className="font-mono bg-ap-bg border border-ap-border px-1 py-0.5 rounded">near</code> = <code className="font-mono">lat,lng</code> (+<code className="font-mono">radius</code> km) — ordena por cercanía</li>
                    <li><code className="font-mono bg-ap-bg border border-ap-border px-1 py-0.5 rounded">format</code> = <code className="font-mono">json|geojson|csv</code></li>
                  </ul>
                  <pre className="bg-ap-primary text-ap-surface-hover p-4 rounded-xl font-mono text-[12.5px] overflow-x-auto mt-3 leading-relaxed">
{`# Refugios más cercanos a un punto (ideal para un chatbot)
curl "https://api.acopiove.org/v1/puntos?tipo=refugio&near=10.6,-66.93&radius=10"

# Todo el directorio en GeoJSON para un mapa
curl "https://api.acopiove.org/v1/puntos?format=geojson"`}
                  </pre>
                </div>

                {/* Endpoint Centros */}
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="text-[11px] font-extrabold bg-emerald-800 text-ap-surface px-2 py-0.5 rounded font-mono">GET</span>
                    <h3 className="text-[16px] font-bold text-ap-primary font-outfit font-mono">/centros</h3>
                  </div>
                  <p className="mt-2 text-[14px]">
                    Devuelve el listado completo de centros de acopio y refugios activos. Soporta múltiples parámetros para filtrar la respuesta.
                  </p>
                  <h4 className="text-[13px] font-bold text-ap-muted uppercase mt-3 tracking-wider">Parámetros Query</h4>
                  <div className="border border-ap-border rounded-xl overflow-x-auto mt-2 bg-ap-surface/40">
                    <table className="w-full text-left border-collapse text-[13px] min-w-[500px]">
                      <thead>
                        <tr className="bg-ap-surface border-b border-ap-border font-bold text-ap-primary">
                          <th className="p-3">Parámetro</th>
                          <th className="p-3">Tipo</th>
                          <th className="p-3">Descripción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-ap-border">
                        <tr>
                          <td className="p-3 font-mono font-bold text-ap-primary">tipo</td>
                          <td className="p-3 font-mono">string</td>
                          <td className="p-3"><code className="bg-ap-bg border border-ap-border px-1 py-0.5 rounded font-mono">acopio</code> o <code className="bg-ap-bg border border-ap-border px-1 py-0.5 rounded font-mono">refugio</code>.</td>
                        </tr>
                        <tr>
                          <td className="p-3 font-mono font-bold text-ap-primary">estado</td>
                          <td className="p-3 font-mono">string</td>
                          <td className="p-3"><code className="bg-ap-bg border border-ap-border px-1 py-0.5 rounded font-mono">abierto</code>, <code className="bg-ap-bg border border-ap-border px-1 py-0.5 rounded font-mono">lleno</code> o <code className="bg-ap-bg border border-ap-border px-1 py-0.5 rounded font-mono">cerrado</code>.</td>
                        </tr>
                        <tr>
                          <td className="p-3 font-mono font-bold text-ap-primary">pais</td>
                          <td className="p-3 font-mono">string</td>
                          <td className="p-3">Filtro por país (búsqueda exacta e insensible a acentos).</td>
                        </tr>
                        <tr>
                          <td className="p-3 font-mono font-bold text-ap-primary">ciudad</td>
                          <td className="p-3 font-mono">string</td>
                          <td className="p-3">Filtro por ciudad (coincidencia parcial e insensible a acentos).</td>
                        </tr>
                        <tr>
                          <td className="p-3 font-mono font-bold text-ap-primary">recibe</td>
                          <td className="p-3 font-mono">string</td>
                          <td className="p-3">Lista separada por comas de categorías (ej: <code className="font-mono bg-ap-bg border border-ap-border px-1 py-0.5 rounded">agua,alimentos</code>).</td>
                        </tr>
                        <tr>
                          <td className="p-3 font-mono font-bold text-ap-primary">near</td>
                          <td className="p-3 font-mono">string</td>
                          <td className="p-3">Ubicación <code className="font-mono">lat,lng</code> (ej: <code className="font-mono">10.48,-66.90</code>). Ordena por cercanía.</td>
                        </tr>
                        <tr>
                          <td className="p-3 font-mono font-bold text-ap-primary">radius</td>
                          <td className="p-3 font-mono">number</td>
                          <td className="p-3">Radio máximo de búsqueda en kilómetros (requiere parámetro <code className="font-mono">near</code>).</td>
                        </tr>
                        <tr>
                          <td className="p-3 font-mono font-bold text-ap-primary">format</td>
                          <td className="p-3 font-mono">string</td>
                          <td className="p-3">Formato de respuesta: <code className="font-mono bg-ap-bg border border-ap-border px-1 py-0.5 rounded">json</code>, <code className="font-mono bg-ap-bg border border-ap-border px-1 py-0.5 rounded">geojson</code> o <code className="font-mono bg-ap-bg border border-ap-border px-1 py-0.5 rounded">csv</code> (ver sección de formatos).</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Endpoint Centro por ID */}
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="text-[11px] font-extrabold bg-emerald-800 text-ap-surface px-2 py-0.5 rounded font-mono">GET</span>
                    <h3 className="text-[16px] font-bold text-ap-primary font-outfit font-mono">/centros/{"{id}"}</h3>
                  </div>
                  <p className="mt-2 text-[14px]">
                    Obtiene el registro individual y detallado de un centro mediante su UUID.
                  </p>
                </div>

                {/* Endpoint Telefonos */}
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="text-[11px] font-extrabold bg-emerald-800 text-ap-surface px-2 py-0.5 rounded font-mono">GET</span>
                    <h3 className="text-[16px] font-bold text-ap-primary font-outfit font-mono">/telefonos</h3>
                  </div>
                  <p className="mt-2 text-[14px]">
                    Retorna el directorio completo de teléfonos de emergencia y primera respuesta indexados en la app, filtrables por <code className="font-mono">ciudad</code> y <code className="font-mono">pais</code>.
                  </p>
                </div>

                {/* Endpoint Meta */}
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="text-[11px] font-extrabold bg-emerald-800 text-ap-surface px-2 py-0.5 rounded font-mono">GET</span>
                    <h3 className="text-[16px] font-bold text-ap-primary font-outfit font-mono">/meta</h3>
                  </div>
                  <p className="mt-2 text-[14px]">
                    Retorna metadatos de la base de datos completa: conteo total de puntos, fecha y hora de la última actualización, términos de la licencia y atribución correspondiente.
                  </p>
                </div>
              </div>
            </section>

            {/* Boletín de noticias (sitio principal, no api.acopiove.org) */}
            <section id="boletin-noticias" className="scroll-mt-20 border-t border-ap-border pt-10">
              <h2 className="text-[20px] md:text-[24px] font-extrabold text-ap-primary font-outfit">
                Boletín de noticias (IA)
              </h2>
              <div className="text-[15px] text-ap-secondary mt-4 space-y-4 leading-relaxed">
                <p>
                  Además de la API de datos en <code className="font-mono">api.acopiove.org</code>, el sitio principal expone un
                  <strong> resumen periodístico en Markdown</strong> sobre la emergencia sísmica, generado a partir de fuentes RSS
                  verificadas (El País, DW, NYT, BBC Mundo, etc.). El texto se guarda en caché en disco y se puede reutilizar sin
                  volver a llamar al modelo de IA. Los artículos RSS se filtran por relevancia humanitaria (sismo, réplicas, refugios,
                  acopio, daños, ayuda) y geografía de las zonas afectadas — sin palabras clave políticas.
                </p>
                <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 text-[14px] text-sky-950">
                  <strong>Base URL:</strong>{' '}
                  <code className="font-mono">https://acopiove.org/api/news</code> — distinta del hub de datos{' '}
                  <code className="font-mono">https://api.acopiove.org/v1</code>.
                </div>

                <div className="border border-ap-border rounded-xl p-4 bg-ap-surface/40 space-y-4">
                  <div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="text-[11px] font-extrabold bg-emerald-800 text-ap-surface px-2 py-0.5 rounded font-mono">GET</span>
                      <h3 className="text-[16px] font-bold text-ap-primary font-outfit font-mono">/summary</h3>
                      <span className="text-[10px] font-extrabold text-ap-primary bg-ap-bg border border-ap-border px-2 py-0.5 rounded-full uppercase tracking-wider">Solo lectura de caché</span>
                    </div>
                    <p className="mt-2 text-[14px]">
                      Devuelve el último boletín ya generado para el conjunto de fuentes indicado. No consume créditos de IA ni
                      regenera el texto. Incluye el historial de boletines anteriores (hasta 30 entradas).
                    </p>
                    <ul className="mt-2 space-y-1 text-[13.5px]">
                      <li><code className="font-mono bg-ap-bg border border-ap-border px-1 py-0.5 rounded">sources</code> — CSV de IDs de fuente o <code className="font-mono">all</code> (default)</li>
                    </ul>
                    <pre className="bg-ap-primary text-ap-surface-hover p-4 rounded-xl font-mono text-[12.5px] overflow-x-auto mt-3 leading-relaxed">
{`curl "https://acopiove.org/api/news/summary?sources=all"

# → { "ok": true, "summary": "## Reporte Sísmico...", "cachedAt": "2026-07-02T...", "history": [...] }`}
                    </pre>
                  </div>

                  <div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="text-[11px] font-extrabold bg-amber-800 text-ap-surface px-2 py-0.5 rounded font-mono">POST</span>
                      <h3 className="text-[16px] font-bold text-ap-primary font-outfit font-mono">/summary</h3>
                    </div>
                    <p className="mt-2 text-[14px]">
                      Genera o refresca el boletín (con estrategia stale-while-revalidate: si la caché tiene menos de 1 h devuelve
                      al instante; si está vencida devuelve la versión anterior y regenera en segundo plano). Body JSON:
                    </p>
                    <pre className="bg-ap-primary text-ap-surface-hover p-4 rounded-xl font-mono text-[12.5px] overflow-x-auto mt-3 leading-relaxed">
{`curl -X POST "https://acopiove.org/api/news/summary" \\
  -H "Content-Type: application/json" \\
  -d '{"sources":["all"],"accountId":"mi-app"}'`}
                    </pre>
                    <p className="mt-2 text-[13px] text-ap-muted">
                      IDs de fuente: <code className="font-mono">elpais</code>, <code className="font-mono">dw</code>,{' '}
                      <code className="font-mono">nytimes</code>, <code className="font-mono">bbcmundo</code>,{' '}
                      <code className="font-mono">efectococuyo</code>, <code className="font-mono">elnacional</code>, etc.
                      Lista completa en el modal de noticias del mapa o en el código fuente (<code className="font-mono">RSS_FEEDS</code>).
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center gap-2.5">
                      <span className="text-[11px] font-extrabold bg-emerald-800 text-ap-surface px-2 py-0.5 rounded font-mono">GET</span>
                      <h3 className="text-[16px] font-bold text-ap-primary font-outfit font-mono">/stats</h3>
                    </div>
                    <p className="mt-2 text-[14px]">
                      Estadísticas de uso del servicio (peticiones, aciertos de caché RSS, llamadas al modelo).
                    </p>
                    <pre className="bg-ap-primary text-ap-surface-hover p-4 rounded-xl font-mono text-[12.5px] overflow-x-auto mt-3 leading-relaxed">
{`curl "https://acopiove.org/api/news/stats"`}
                    </pre>
                  </div>
                </div>
              </div>
            </section>

            {/* Búsqueda de personas */}
            <section id="personas" className="scroll-mt-20 border-t border-ap-border pt-10">
              <h2 className="text-[20px] md:text-[24px] font-extrabold text-ap-primary font-outfit">
                Búsqueda de personas (reunificación)
              </h2>
              <div className="text-[15px] text-ap-secondary mt-4 space-y-4 leading-relaxed">
                <p>
                  Permite que una app o chatbot responda <em>"¿está [nombre] reportado como desaparecido o localizado?"</em>.
                  Agrega los registros de <strong>SOS Venezuela</strong>, <strong>Localizados Venezuela</strong>, el hub
                  <strong> Venezuela Ayuda</strong> y <strong>ReportaVNZLA</strong> (búsqueda on-demand que incluye
                  desaparecidosterremotovenezuela.com y venezuelatebusca.com).
                </p>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-[14px] text-amber-950 flex gap-3">
                  <ShieldCheck className="text-amber-700 mt-0.5 shrink-0" size={18} />
                  <div>
                    <strong>PII-segura:</strong> la cédula se devuelve <strong>enmascarada</strong>; <strong>no</strong> se entregan teléfonos
                    ni coordenadas GPS; la ubicación de menores se omite. Es una <strong>búsqueda</strong> (requiere <code className="font-mono">q</code> o <code className="font-mono">cedula</code>), no un volcado del registro.
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="text-[11px] font-extrabold bg-emerald-800 text-ap-surface px-2 py-0.5 rounded font-mono">GET</span>
                    <h3 className="text-[16px] font-bold text-ap-primary font-outfit font-mono">/personas</h3>
                  </div>
                  <ul className="mt-2 space-y-1 text-[13.5px]">
                    <li><code className="font-mono bg-ap-bg border border-ap-border px-1 py-0.5 rounded">q</code> — nombre o parte del nombre (mín. 2 caracteres)</li>
                    <li><code className="font-mono bg-ap-bg border border-ap-border px-1 py-0.5 rounded">cedula</code> — cédula a buscar (mín. 3 dígitos; se devuelve enmascarada)</li>
                    <li><code className="font-mono bg-ap-bg border border-ap-border px-1 py-0.5 rounded">estado</code> — <code className="font-mono">desaparecido</code> | <code className="font-mono">localizado</code></li>
                  </ul>
                  <pre className="bg-ap-primary text-ap-surface-hover p-4 rounded-xl font-mono text-[12.5px] overflow-x-auto mt-3 leading-relaxed">
{`curl "https://api.acopiove.org/v1/personas?q=maria%20gonzalez"

# → { "data": [ { "nombre": "María González", "estado": "localizado",
#       "ubicacion_general": "Hospital ... (Caracas)", "foto": "...",
#       "cedula": "***123", "fuente": "Localizados Venezuela" } ], "meta": {...} }`}
                  </pre>
                </div>
              </div>
            </section>

            {/* Contribuir datos */}
            <section id="contribuir" className="scroll-mt-20 border-t border-ap-border pt-10">
              <h2 className="text-[20px] md:text-[24px] font-extrabold text-ap-primary font-outfit">
                Contribuir datos (otras plataformas)
              </h2>
              <div className="text-[15px] text-ap-secondary mt-4 space-y-4 leading-relaxed">
                <p>
                  Otras apps y plataformas pueden <strong>sugerir nuevos puntos de apoyo</strong> de forma programática. Las sugerencias
                  entran como <strong>pendientes</strong> y un administrador de AcopioVE las revisa antes de publicarlas como verificadas
                  — nunca se muestran directo sin moderación.
                </p>
                <div className="bg-emerald-50 border border-emerald-150 rounded-xl p-4 text-[14px] text-emerald-950 flex gap-3">
                  <ShieldCheck className="text-emerald-800 mt-0.5 shrink-0" size={18} />
                  <div>
                    <strong>Abierto, sin llave.</strong> Rate-limit de 10 sugerencias por IP cada 10 minutos. Enviá tu plataforma en el
                    campo <code className="font-mono">source</code> para la atribución.
                  </div>
                </div>

                {/* POST /submissions */}
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="text-[11px] font-extrabold bg-ap-primary text-ap-surface px-2 py-0.5 rounded font-mono">POST</span>
                    <h3 className="text-[16px] font-bold text-ap-primary font-outfit font-mono">/submissions</h3>
                  </div>
                  <p className="mt-2 text-[14px]">
                    Envía un punto sugerido. Devuelve un <code className="font-mono">id</code>, <code className="font-mono">status: "pending"</code> y
                    un indicador <code className="font-mono">possible_duplicate</code> si detectamos un punto cercano y parecido.
                  </p>
                  <pre className="bg-ap-primary text-ap-surface-hover p-4 rounded-xl font-mono text-[12.5px] overflow-x-auto mt-2 leading-relaxed">
{`curl -X POST https://api.acopiove.org/v1/submissions \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Centro de Acopio Plaza Bolívar",
    "tipo": "acopio",
    "latitude": 10.5061, "longitude": -66.9146,
    "ciudad": "Caracas", "pais": "Venezuela",
    "recibe": ["agua","alimentos"],
    "contacto": "0212-5550000",
    "source": "MiPlataforma"
  }'

# → 201 { "data": { "id": "…", "status": "pending",
#          "possible_duplicate": false },
#        "meta": { "status_url": "https://api.acopiove.org/v1/submissions/…" } }`}
                  </pre>
                </div>

                {/* GET /submissions/{id} */}
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="text-[11px] font-extrabold bg-emerald-800 text-ap-surface px-2 py-0.5 rounded font-mono">GET</span>
                    <h3 className="text-[16px] font-bold text-ap-primary font-outfit font-mono">/submissions/{"{id}"}</h3>
                  </div>
                  <p className="mt-2 text-[14px]">
                    Consulta el estado de tu sugerencia: <code className="font-mono">pending</code> (en revisión) o{' '}
                    <code className="font-mono">approved</code> (ya publicada y visible en <code className="font-mono">/centros</code>).
                    Devuelve <code className="font-mono">404</code> si fue rechazada.
                  </p>
                </div>
              </div>
            </section>

            {/* Integración con WhatsApp */}
            <section id="chatbot" className="scroll-mt-20 border-t border-ap-border pt-10">
              <h2 className="text-[20px] md:text-[24px] font-extrabold text-ap-primary font-outfit">
                Integración con WhatsApp y canales de mensajería
              </h2>
              <div className="text-[15px] text-ap-secondary mt-4 space-y-4 leading-relaxed">
                <p>
                  Con esta API podés construir integraciones y flujos de mensajería (por ejemplo, vía WhatsApp) que, desde cualquier teléfono y con poca señal,
                  ayuden a las personas afectadas a <strong>encontrar el refugio o centro de acopio más cercano</strong>,
                  obtener <strong>teléfonos de emergencia</strong> y <strong>buscar familiares</strong> reportados.
                </p>

                <h3 className="text-[16px] font-bold text-ap-primary font-outfit mt-2">Cómo armar tu integración con Kapso + esta API</h3>
                <p>
                  <a href="https://kapso.ai" target="_blank" rel="noopener noreferrer" className="font-bold text-ap-primary hover:underline">Kapso</a> es
                  una pasarela para WhatsApp (sobre la API oficial de Meta) que recibe los mensajes entrantes y te deja responder.
                  El patrón es: <strong>Kapso recibe el mensaje → tu servidor consulta esta API → respondés por Kapso.</strong>
                </p>
                <ol className="list-decimal pl-5 space-y-2">
                  <li><strong>Conectá tu número:</strong> creá una cuenta en Kapso y vinculá tu número de WhatsApp (vía WhatsApp Cloud API de Meta).</li>
                  <li><strong>Webhook:</strong> configurá en Kapso un webhook al evento <code className="font-mono">messages</code> apuntando a tu servidor (<code className="font-mono">POST /webhook</code>).</li>
                  <li><strong>Al recibir un mensaje,</strong> según lo que pida la persona, consultá esta API:
                    <ul className="list-disc pl-5 mt-1.5 space-y-1">
                      <li>Refugio/acopio cercano (la persona comparte su ubicación) → <code className="font-mono">/v1/puntos?tipo=refugio&amp;near=lat,lng&amp;radius=10</code></li>
                      <li>Teléfonos de emergencia → <code className="font-mono">/v1/puntos?tipo=telefono&amp;ciudad=Caracas</code></li>
                      <li>Buscar un familiar → <code className="font-mono">/v1/personas?q=nombre</code></li>
                    </ul>
                  </li>
                  <li><strong>Respondé por Kapso</strong> con el resultado (texto o botones). Recordá: dentro de la ventana de 24 h (la persona escribió primero) podés mandar texto libre; fuera de esa ventana, Meta exige una plantilla aprobada.</li>
                </ol>
                <p>Ejemplo del manejador (Node/JavaScript, simplificado):</p>
                <pre className="bg-ap-primary text-ap-surface-hover p-4 rounded-xl font-mono text-[12px] overflow-x-auto leading-relaxed">
{`// Webhook que Kapso llama con cada mensaje entrante
export async function POST(req) {
  const msg = await req.json();
  const from = msg.from;                 // teléfono del usuario
  const texto = (msg.text || '').toLowerCase();

  let respuesta;

  if (msg.location) {
    // La persona compartió su ubicación → 3 refugios más cercanos
    const { lat, lng } = msg.location;
    const r = await fetch(
      \`https://api.acopiove.org/v1/puntos?tipo=refugio&near=\${lat},\${lng}&radius=15&limit=3\`
    ).then(r => r.json());
    respuesta = r.data.length
      ? 'Refugios más cercanos:\\n' + r.data.map(p => \`• \${p.nombre} (\${p.ciudad})\`).join('\\n')
      : 'No encontré refugios cerca. Mira el mapa: acopiove.org';

  } else if (texto.includes('telefono') || texto.includes('emergencia')) {
    const r = await fetch('https://api.acopiove.org/v1/puntos?tipo=telefono&limit=5')
      .then(r => r.json());
    respuesta = 'Teléfonos de emergencia:\\n' +
      r.data.map(p => \`• \${p.nombre}: \${p.telefono}\`).join('\\n');

  } else if (texto.startsWith('buscar ')) {
    const nombre = texto.replace('buscar ', '');
    const r = await fetch(
      \`https://api.acopiove.org/v1/personas?q=\${encodeURIComponent(nombre)}\`
    ).then(r => r.json());
    respuesta = r.data.length
      ? r.data.map(p => \`\${p.nombre} — \${p.estado} (\${p.ubicacion_general || 's/d'})\`).join('\\n')
      : 'No encontré registros para ese nombre.';

  } else {
    respuesta = '👋 Soy el asistente de ayuda. Compartí tu ubicación para ver ' +
      'refugios cercanos, escribí "telefonos", o "buscar <nombre>" para un familiar.';
  }

  // Responder por la API de Kapso (texto libre dentro de la ventana de 24 h)
  await fetch('https://api.kapso.ai/.../messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + KAPSO_KEY },
    body: JSON.stringify({ to: from, type: 'text', text: { body: respuesta } }),
  });

  return new Response('ok');
}`}
                </pre>
                <p className="text-[13px] text-ap-muted">
                  Nota PII: <code className="font-mono">/v1/personas</code> ya devuelve datos seguros (cédula enmascarada, sin teléfono ni GPS,
                  ubicación de menores omitida), así que tu bot puede usarlos sin exponer información sensible.
                </p>
              </div>
            </section>

            {/* Formatos de salida */}
            <section id="formatos" className="scroll-mt-20 border-t border-ap-border pt-10">
              <h2 className="text-[20px] md:text-[24px] font-extrabold text-ap-primary font-outfit">
                Formatos de salida
              </h2>
              <div className="text-[15px] text-ap-secondary mt-4 space-y-4 leading-relaxed">
                <p>
                  Por defecto, la API devuelve datos formateados como JSON. Sin embargo, para facilitar el desarrollo rápido de integraciones, puedes cambiar el formato de respuesta mediante el parámetro de consulta <code className="font-mono bg-ap-bg border border-ap-border px-1.5 py-0.5 rounded">format</code> o el encabezado estándar de HTTP <code className="font-mono bg-ap-bg border border-ap-border px-1.5 py-0.5 rounded">Accept</code>:
                </p>
                <ul className="list-disc pl-5 space-y-2">
                  <li>
                    <strong>JSON:</strong> Por defecto o pasando <code className="font-mono">format=json</code>.
                  </li>
                  <li>
                    <strong>GeoJSON:</strong> Pasando <code className="font-mono">format=geojson</code> o la cabecera <code className="font-mono">Accept: application/geo+json</code>. Devuelve una estructura compatible con Leaflet, Mapbox y GIS (como un <code className="font-mono">FeatureCollection</code>).
                  </li>
                  <li>
                    <strong>CSV:</strong> Pasando <code className="font-mono">format=csv</code> o la cabecera <code className="font-mono">Accept: text/csv</code>. Útil para importar directo a Excel o Google Sheets.
                  </li>
                </ul>
              </div>
            </section>

            {/* Ejemplos */}
            <section id="ejemplos" className="scroll-mt-20 border-t border-ap-border pt-10">
              <h2 className="text-[20px] md:text-[24px] font-extrabold text-ap-primary font-outfit">
                Ejemplos de integración
              </h2>
              <div className="text-[15px] text-ap-secondary mt-4 space-y-6 leading-relaxed">
                <div>
                  <h3 className="text-[15px] font-bold text-ap-primary font-outfit">1. Obtener centros cercanos en JavaScript (Fetch API)</h3>
                  <pre className="bg-ap-primary text-ap-surface-hover p-4 rounded-xl font-mono text-[12.5px] overflow-x-auto mt-2 leading-relaxed">
{`const lat = 10.48; // Caracas
const lng = -66.90;
const url = \`https://api.acopiove.org/v1/centros?near=\${lat},\${lng}&limit=3\`;

fetch(url)
  .then(res => res.json())
  .then(body => {
    console.log(\`Se encontraron \${body.meta.count} centros cercanos:\`);
    body.data.forEach(centro => {
      console.log(\`- \${centro.name} (\${centro.necesita_ahora || 'Sin necesidades reportadas'})\`);
    });
  });`}
                  </pre>
                </div>

                <div>
                  <h3 className="text-[15px] font-bold text-ap-primary font-outfit">2. Cargar en Leaflet con GeoJSON</h3>
                  <pre className="bg-ap-primary text-ap-surface-hover p-4 rounded-xl font-mono text-[12.5px] overflow-x-auto mt-2 leading-relaxed">
{`// Inicializar mapa de Leaflet
const map = L.map('map').setView([10.48, -66.90], 12);

// Obtener datos directamente en formato GeoJSON
fetch('https://api.acopiove.org/v1/centros?format=geojson')
  .then(res => res.json())
  .then(geojsonData => {
    L.geoJSON(geojsonData, {
      onEachFeature: (feature, layer) => {
        layer.bindPopup(\`
          <b>\${feature.properties.name}</b><br/>
          Recibe: \${feature.properties.recibe.join(', ') || 'Todo tipo de ayuda'}
        \`);
      }
    }).addTo(map);
  });`}
                  </pre>
                </div>
              </div>
            </section>

            {/* Licencia */}
            <section id="licencia" className="scroll-mt-20 border-t border-ap-border pt-10">
              <h2 className="text-[20px] md:text-[24px] font-extrabold text-ap-primary font-outfit">
                Licencia y Atribución
              </h2>
              <div className="text-[15px] text-ap-secondary mt-4 space-y-4 leading-relaxed">
                <p>
                  La base de datos de AcopioVE es un esfuerzo colectivo impulsado por voluntarios, organizaciones sociales y ciudadanos independientes.
                </p>
                <div className="border border-ap-border rounded-xl p-5 bg-ap-surface/40">
                  <p className="text-[14px]">
                    Toda la información expuesta por esta API se encuentra distribuida bajo los términos de la licencia internacional{' '}
                    <a
                      href="https://creativecommons.org/licenses/by/4.0/deed.es"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-bold text-ap-primary hover:underline inline-flex items-center gap-0.5"
                    >
                      Creative Commons Atribución 4.0 (CC-BY-4.0)
                      <ExternalLink size={12} className="inline mt-0.5" />
                    </a>.
                  </p>
                  <p className="mt-3 text-[14px]">
                    <strong>Requisito de Atribución:</strong> Eres libre de copiar, redistribuir, alterar y crear derivados de estos datos para cualquier propósito, incluso comercial, siempre y cuando otorgues el crédito correspondiente de la siguiente manera:
                  </p>
                  <div className="mt-3 font-mono text-[13px] bg-ap-bg border border-ap-border p-3 rounded text-ap-primary select-all">
                    Datos provistos por AcopioVE (acopiove.org)
                  </div>
                </div>
              </div>
            </section>
          </article>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
