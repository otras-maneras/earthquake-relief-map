import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, Database, ShieldCheck, RefreshCw, Layers } from 'lucide-react';
import { SiteHeader, SiteFooter, Eyebrow, ES_NAV, BRAND_PALETTE } from '@/components/site/Chrome';

export const revalidate = 300;

const SITE_URL = 'https://acopiove.org';

export const metadata: Metadata = {
  title: 'Fuentes y APIs públicas que usamos - AcopioVE',
  description:
    'Catálogo de las APIs públicas y fuentes de datos abiertas que AcopioVE agrega automáticamente: personas, salud, daños estructurales, servicios, sismos y voluntarios (terremoto de Venezuela 2026).',
  alternates: { canonical: `${SITE_URL}/docs/fuentes` },
  openGraph: {
    type: 'website',
    locale: 'es_VE',
    url: `${SITE_URL}/docs/fuentes`,
    siteName: 'AcopioVE',
    title: 'Fuentes y APIs públicas que usamos - AcopioVE',
    description: 'Catálogo de las APIs públicas y fuentes de datos abiertas que AcopioVE agrega automáticamente.',
    images: [{ url: '/og-image-v2.png', width: 1200, height: 630, alt: 'AcopioVE Fuentes' }],
  },
};

type Source = {
  id: string;
  nombre: string;
  categoria: string;
  descripcion: string;
  base: string;
  metodo: string;
  auth: string;
  formato: string;
  alimenta: string;
  sitio?: string;
  docs?: string;
  endpoints?: { metodo: string; path: string; desc: string }[];
};

// Fuentes externas que AcopioVE consulta de forma automática.
// Mantener sincronizado con src/app/api/personas/route.ts y demás rutas /api.
const SOURCES: Source[] = [
  {
    id: 'sos-venezuela',
    nombre: 'SOS Venezuela',
    categoria: 'Personas',
    descripcion:
      'Registro comunitario de personas desaparecidas y localizadas tras el sismo. Aporta nombre, estado (desaparecida / hallada con vida), parroquia y hospital de referencia.',
    base: 'https://sosvenezuela2026.com/api',
    metodo: 'GET (offset, limit)',
    auth: 'Pública (sin clave)',
    formato: 'JSON',
    alimenta: 'Buscador de personas (/busquedas) · Bot de WhatsApp',
    sitio: 'https://sosvenezuela2026.com',
    endpoints: [
      { metodo: 'GET', path: '/persons/list?offset=&limit=', desc: 'Personas (id, status, cedula_masked, display_name, municipio, parroquia, hospital_name, photo_path, source_date). La que consumimos.' },
      { metodo: 'GET', path: '/persons/stats', desc: 'Conteos: missing, found, total, missing_minors, found_minors.' },
      { metodo: 'GET', path: '/reports?limit=', desc: 'Reportes de daños/recursos (category, severity rojo/naranja/amarillo/verde, verification, title, description).' },
      { metodo: 'GET', path: '/reports/summary', desc: 'Conteo de reportes por severidad.' },
      { metodo: 'GET', path: '/balance', desc: 'Tablero de situación (colapsados, dañados, afectados, réplicas + cifras oficiales).' },
      { metodo: 'GET', path: '/news?limit=', desc: 'Feed de noticias (Google News RSS).' },
    ],
  },
  {
    id: 'venezuela-reporta',
    nombre: 'Venezuela Reporta',
    categoria: 'Personas',
    descripcion:
      'API abierta con un registro consolidado de personas (se consulta on-demand al buscar por nombre; ~50k fichas, sin coordenadas) y un directorio de sitios (acopios, refugios y clínicas con lat/lng). Atribución obligatoria; sin datos de contacto por API (se enlaza a la ficha original).',
    base: 'https://venezuelareporta.org/api/v1',
    metodo: 'GET (q, limit)',
    auth: 'Pública (sin clave)',
    formato: 'JSON',
    alimenta: 'Buscador consolidado (/busquedas): fichas de personas al buscar + capa de sitios aliados',
    sitio: 'https://venezuelareporta.org',
    docs: 'https://venezuelareporta.org/api-abierta',
    endpoints: [
      { metodo: 'GET', path: '/personas?q=&limit=', desc: 'Registro consolidado de personas (status a_salvo/encontrado/buscando, zona, ciudad, ficha_url). Solo en modo búsqueda.' },
      { metodo: 'GET', path: '/sitios?limit=', desc: 'Sitios con coordenadas (acopio/clinica/hospital/refugio, estado operativo, necesidades).' },
    ],
  },
  {
    id: 'localizados-venezuela',
    nombre: 'Localizados Venezuela',
    categoria: 'Personas',
    descripcion:
      'Listado de personas localizadas en centros de salud y albergues, con observaciones clínicas y lugar de hallazgo.',
    base: 'https://localizadosvenezuela.com/api/v1/localizados',
    metodo: 'GET (page, limit)',
    auth: 'Pública (sin clave)',
    formato: 'JSON',
    alimenta: 'Buscador de personas (/busquedas) · Bot de WhatsApp',
    sitio: 'https://localizadosvenezuela.com',
  },
  {
    id: 'civis',
    nombre: 'CIVIS Venezuela',
    categoria: 'Salud y hospitales',
    descripcion:
      'Puntos de atención médica y salud verificados (hospitales, CDI, ambulatorios) y teléfonos de Protección Civil y Bomberos.',
    base: 'https://civisvenezuela.com/api/puntos',
    metodo: 'GET',
    auth: 'Pública (sin clave)',
    formato: 'JSON',
    alimenta: 'Capa "Localizados (Salud)" en /busquedas · Teléfonos de emergencia',
    sitio: 'https://civisvenezuela.com',
  },
  {
    id: 'mapa-danos',
    nombre: 'Mapa de Daños (terremotovenezuela.com)',
    categoria: 'Daños estructurales',
    descripcion:
      'Reportes geolocalizados de edificios con daños estructurales (parcial / total), nivel de revisión y si hay personas desaparecidas en el sitio. Servido vía Supabase REST.',
    base: 'https://jckifxsdlnsvbztxydes.supabase.co/rest/v1/buildings',
    metodo: 'GET (PostgREST)',
    auth: 'Clave publishable (server-side)',
    formato: 'JSON',
    alimenta: 'Capa "Daños Estructurales" en /busquedas',
    sitio: 'https://terremotovenezuela.com',
  },
  {
    id: 'danos-microsoft-ai',
    nombre: 'Edificios Dañados — Microsoft AI for Good (Catia La Mar)',
    categoria: 'Daños estructurales',
    descripcion:
      'Evaluación de daños por machine learning sobre imágenes satelitales Vantor (25-jun-2026) de Microsoft AI for Good Lab, publicada en OCHA HDX. 9.128 polígonos de edificios en Catia La Mar (La Guaira) con % de daño estimado a 0/10/20 metros. Cobertura acotada a esa zona; requiere verificación de campo. Snapshot estático guardado en /danos-catia-la-mar.json.',
    base: 'https://services8.arcgis.com/w0z3NDBGLWwOLx2y/arcgis/rest/services/Catia_La_Mar_3D_WFL1/FeatureServer/0',
    metodo: 'GET (Esri REST Query, paginado por resultOffset, máx. 2000/página)',
    auth: 'Pública (sin clave)',
    formato: 'GeoJSON / Esri JSON',
    alimenta: 'Capa "Edificios Dañados (IA)" en /busquedas',
    sitio: 'https://data.humdata.org/dataset/venezuela-earthquakes-catia-la-mar',
    docs: 'https://www.arcgis.com/home/webscene/viewer.html?webscene=c01ef4b6b74b4d25a39f7a1e4865be58',
    endpoints: [
      { metodo: 'GET', path: '/query?where=1=1&outFields=*&f=geojson', desc: 'Todos los polígonos (paginar con resultOffset/resultRecordCount, máx. 2000 por página).' },
      { metodo: 'GET', path: '/query?where=1=1&returnCountOnly=true&f=json', desc: 'Conteo total de registros.' },
    ],
  },
  {
    id: 'reporte-ve',
    nombre: 'Reporte VE',
    categoria: 'Servicios y escasez',
    descripcion:
      'Reportes de cortes y escasez de servicios (electricidad, agua, medicinas, alimentos, combustible, telecomunicaciones) por localidad.',
    base: '$REPORTE_VE_API_URL/api/reports?sinceHours=',
    metodo: 'GET (sinceHours)',
    auth: 'Configurable por entorno',
    formato: 'JSON',
    alimenta: 'Capa "Servicios y Escasez" en /busquedas',
  },
  {
    id: 'centros-insumos',
    nombre: 'Centros de Insumos VE',
    categoria: 'Servicios y escasez',
    descripcion:
      'Centros que reciben y administran insumos, con inventario declarado por ítem y cantidades.',
    base: '$INSU_CENTROS_API_URL/centros',
    metodo: 'GET',
    auth: 'Configurable por entorno',
    formato: 'JSON',
    alimenta: 'Capa "Centros de Insumos" en /busquedas',
  },
  {
    id: 'venezuela-ayuda',
    nombre: 'Terremoto Venezuela (Hub)',
    categoria: 'Hubs agregadores',
    descripcion:
      'Hub central que unifica reportes de varias plataformas (venezuela-ayuda.com, terremotovenezuela.app, venezuelatebusca.com): personas desaparecidas, check-ins a salvo, solicitudes y ofertas de ayuda, y daños. Sin datos personales sensibles.',
    base: 'https://terremoto.hazlohoy.org/api/v1/reports?type=',
    metodo: 'GET (type, since, limit, city)',
    auth: 'Pública (sin clave)',
    formato: 'JSON · paginado por cursor',
    alimenta: 'Capa "Venezuela Ayuda" en /busquedas (con sub-capa de ofertas)',
    sitio: 'https://terremoto.hazlohoy.org',
    docs: 'https://terremoto.hazlohoy.org/openapi.yaml',
    endpoints: [
      { metodo: 'GET', path: '/api/v1/reports?type=&since=&limit=&city=', desc: 'Reportes unificados sin PII. type = missing_person | checkin | help_request | help_offer | damaged_building. Paginado por cursor. La que consumimos.' },
      { metodo: 'GET', path: '/api/v1/reports/{id}', desc: 'Un reporte por id.' },
      { metodo: 'GET', path: '/api/v1/reports/{id}/history', desc: 'Audit trail (proyectado sin PII).' },
      { metodo: 'POST', path: '/api/v1/reports', desc: 'Crear reportes en el hub (push autenticado, batch).' },
      { metodo: 'PATCH', path: '/api/v1/reports/{id}', desc: 'Modificar parcialmente un reporte (autenticado).' },
    ],
  },
  {
    id: 'usgs',
    nombre: 'USGS Earthquake / ShakeMap',
    categoria: 'Sismología',
    descripcion:
      'Datos sísmicos oficiales del Servicio Geológico de EE. UU.: catálogo de sismos y réplicas en vivo y capa de intensidad (ShakeMap MMI).',
    base: 'https://earthquake.usgs.gov/fdsnws/event/1/query',
    metodo: 'GET (FDSN)',
    auth: 'Pública (sin clave)',
    formato: 'GeoJSON',
    alimenta: 'Capa de réplicas e intensidad sísmica (/api/sismos)',
    sitio: 'https://earthquake.usgs.gov',
    docs: 'https://earthquake.usgs.gov/fdsnws/event/1/',
  },
  {
    id: 'interp-aid',
    nombre: 'Interp-Aid',
    categoria: 'Voluntarios',
    descripcion:
      'Registro de voluntarios intérpretes (idiomas, disponibilidad) para apoyo a damnificados. Cacheado y respaldado en nuestra base de datos como respaldo si la fuente cae.',
    base: 'Supabase REST (clave en servidor)',
    metodo: 'GET (PostgREST)',
    auth: 'Clave en servidor',
    formato: 'JSON',
    alimenta: 'Landing de intérpretes (/interpretes) · /api/voluntarios',
  },
  {
    id: 'ayuda-venezuela',
    nombre: 'Venezuela Ayuda (REST API)',
    categoria: 'Personas',
    descripcion:
      'Directorio de pacientes ingresados en centros hospitalarios y estado de salud durante la emergencia. Se consulta mediante una llamada REST a la API de búsqueda de personas reportadas.',
    base: 'https://ayudavenezuela.online/api/v1/desaparecidos',
    metodo: 'GET (nombre, limit)',
    auth: 'Clave de Desarrollador (Header X-API-Key)',
    formato: 'JSON',
    alimenta: 'Capa "Terremoto Venezuela" en /busquedas y métricas en vivo',
    sitio: 'https://ayudavenezuela.online',
  },
  {
    id: 'reportavnzla',
    nombre: 'ReportaVNZLA',
    categoria: 'Personas',
    descripcion:
      'Agregador de personas desaparecidas y localizadas que incluye desaparecidosterremotovenezuela.com y venezuelatebusca.com (~61k registros). Se consulta on-demand por nombre o cédula (no se replica en volcado); cédula enmascarada y ubicación de menores omitida en la salida.',
    base: 'https://reportavnzla.com/api/v1/personas',
    metodo: 'GET (q, cedula, limit, page)',
    auth: 'Pública (sin clave); header X-Source de cortesía',
    formato: 'JSON',
    alimenta: 'Buscador de personas (/busquedas) · Bot de WhatsApp · /v1/personas',
    sitio: 'https://reportavnzla.com',
  },
  {
    id: 'redh-avapre',
    nombre: 'REDH AVAPRE',
    categoria: 'Salud y hospitales',
    descripcion:
      'Red de Ayuda Hospitalaria para el sismo. Unifica reportes de daños, centros de acopio y refugios, así como pacientes y desaparecidos.',
    base: 'https://api-redh.avapre.com/api/v1',
    metodo: 'GET',
    auth: 'Pública (sin clave)',
    formato: 'JSON',
    alimenta: 'Estadísticas de APIs y capa proyectada en /busquedas',
    sitio: 'https://redh.avapre.com',
  },
  {
    id: 'de-mano-en-mano',
    nombre: 'De Mano en Mano',
    categoria: 'Salud y hospitales',
    descripcion:
      'Tablero de necesidades de insumos por unidad hospitalaria (Emergencias, UCI, Quirófano, Farmacia, etc.): cada centro publica los ítems que requiere con cantidad pedida, cantidad ya cubierta y nivel de urgencia. Su backend es un Google Apps Script sobre Google Sheets. No expone coordenadas: resolvemos la ubicación siguiendo el enlace de Google Maps (maps_url) de cada centro.',
    base: 'https://script.google.com/macros/s/.../exec',
    metodo: 'GET',
    auth: 'Pública (sin clave)',
    formato: 'JSON',
    alimenta: 'Capa "De Mano en Mano" (necesidades de insumos) en /busquedas',
    sitio: 'https://www.demanoenmanove.org',
    endpoints: [
      { metodo: 'GET', path: '/exec', desc: 'Tablero completo: { ok, generado, unidades[], centros[] }. Cada centro trae nombre, tipo, geografía (estado/municipio/parroquia/sector), maps_url, whatsapp_publico, estado_centro y su lista de necesidades (item, categoria, unidad, cantidad_pedida, cantidad_cubierta, urgencia 1–3).' },
    ],
  },
  {
    id: 'terra-ve',
    nombre: 'TerraVE',
    categoria: 'Daños estructurales',
    descripcion:
      'Análisis de deformación y zonas de daño mediante radar de apertura sintética (SAR) usando Sentinel-1 GRD procesado en Google Earth Engine. Aporta polígonos de afectación física calculados en metros cuadrados (m²).',
    base: 'https://terra-ve.vercel.app/api/satelital',
    metodo: 'GET (lat_min, lat_max, lng_min, lng_max, limit)',
    auth: 'Pública (sin clave)',
    formato: 'JSON',
    alimenta: 'Capa "Daño Satelital (TerraVE)" en /busquedas',
    sitio: 'https://terra-ve.vercel.app',
  },
];

const CATEGORIES = [
  'Personas',
  'Salud y hospitales',
  'Daños estructurales',
  'Servicios y escasez',
  'Hubs agregadores',
  'Sismología',
  'Voluntarios',
];

export default function FuentesPage() {
  return (
    <main id="main-content" className="min-h-[100dvh] bg-ap-bg font-sans" style={BRAND_PALETTE}>
      <SiteHeader nav={ES_NAV} active="/docs" />

      {/* Hero */}
      <section className="border-b border-ap-border bg-ap-surface">
        <div className="max-w-[1000px] mx-auto px-4 py-12 md:py-16">
          <Link
            href="/docs"
            className="text-[13px] font-bold text-ap-muted hover:text-ap-primary flex items-center gap-1.5 transition-colors group w-fit"
          >
            <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
            Volver a Documentación
          </Link>
          <div className="mt-4">
            <Eyebrow>Transparencia de datos</Eyebrow>
          </div>
          <h1 className="text-[30px] md:text-[40px] font-extrabold text-ap-primary font-outfit leading-[1.08] mt-3 max-w-3xl">
            Fuentes y APIs públicas que usamos
          </h1>
          <p className="text-[16px] text-ap-secondary mt-4 max-w-2xl leading-relaxed">
            AcopioVE no carga la mayoría de su información a mano: la <strong>agrega automáticamente</strong> desde
            APIs públicas y plataformas aliadas, conservando siempre la atribución a su fuente original. Esta es la
            lista completa de esas fuentes y cómo las consultamos.
          </p>
        </div>
      </section>

      {/* Contenido */}
      <section className="max-w-[1000px] mx-auto px-4 py-12">
        <div className="flex flex-col md:flex-row gap-8 items-start">
          {/* Sidebar */}
          <aside className="w-full md:w-[260px] shrink-0 sticky top-20 hidden md:block border border-ap-border rounded-xl p-4 bg-ap-surface">
            <h2 className="text-[13px] font-bold text-ap-muted uppercase tracking-[0.08em] border-b border-ap-border pb-2 mb-3">
              En esta página
            </h2>
            <nav className="flex flex-col gap-1">
              <a href="#como-funciona" className="text-[13.5px] font-medium text-ap-secondary hover:text-ap-primary transition-colors py-1 leading-normal">
                Cómo lo hacemos
              </a>
              {SOURCES.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className="text-[13.5px] font-medium text-ap-secondary hover:text-ap-primary transition-colors py-1 leading-normal"
                >
                  {s.nombre}
                </a>
              ))}
              <a href="#licencia" className="text-[13.5px] font-medium text-ap-secondary hover:text-ap-primary transition-colors py-1 leading-normal">
                Atribución y licencias
              </a>
            </nav>
          </aside>

          {/* Artículo */}
          <article className="w-full md:flex-1 min-w-0 space-y-12">
            {/* Banner a la API propia */}
            <div className="border border-ap-border rounded-xl p-5 bg-ap-surface flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
              <div>
                <span className="inline-block text-[10px] font-extrabold text-ap-primary bg-ap-bg border border-ap-border px-2 py-0.5 rounded-full uppercase tracking-wider">
                  ¿Buscabas otra cosa?
                </span>
                <h3 className="text-[16px] font-extrabold text-ap-primary font-outfit mt-1.5">
                  Nuestra propia API pública (v1)
                </h3>
                <p className="text-[13.5px] text-ap-secondary mt-1 leading-relaxed">
                  Esta página lista las fuentes que <em>consumimos</em>. Si querés <em>consumir</em> los datos de
                  AcopioVE, mirá la documentación de nuestra API.
                </p>
              </div>
              <Link
                href="/docs/api"
                className="shrink-0 inline-flex items-center gap-1.5 bg-ap-primary text-ap-surface hover:opacity-90 transition-opacity px-4 py-2.5 rounded-lg font-bold text-[13px]"
              >
                Ver API de AcopioVE
                <ExternalLink size={14} />
              </Link>
            </div>

            {/* Cómo funciona */}
            <section id="como-funciona" className="scroll-mt-20">
              <h2 className="text-[20px] md:text-[24px] font-extrabold text-ap-primary font-outfit">
                Cómo agregamos estas fuentes
              </h2>
              <div className="text-[15px] text-ap-secondary mt-4 space-y-4 leading-relaxed">
                <p>
                  Cada fuente se consulta de forma automática desde el servidor de AcopioVE y se normaliza a un
                  formato común antes de mostrarse en el mapa, los buscadores y el bot de WhatsApp. Los principios:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="border border-ap-border rounded-xl p-4 bg-ap-surface/40">
                    <RefreshCw size={16} className="text-ap-primary" />
                    <h3 className="text-[14px] font-bold text-ap-primary font-outfit mt-2">Actualización automática</h3>
                    <p className="text-[13px] mt-1">Refrescamos los datos en intervalos cortos (caché de ~60s). Nadie carga esto a mano.</p>
                  </div>
                  <div className="border border-ap-border rounded-xl p-4 bg-ap-surface/40">
                    <Layers size={16} className="text-ap-primary" />
                    <h3 className="text-[14px] font-bold text-ap-primary font-outfit mt-2">Capas independientes</h3>
                    <p className="text-[13px] mt-1">Cada fuente es una capa que se puede activar o desactivar, sin mezclar orígenes.</p>
                  </div>
                  <div className="border border-ap-border rounded-xl p-4 bg-ap-surface/40">
                    <ShieldCheck size={16} className="text-ap-primary" />
                    <h3 className="text-[14px] font-bold text-ap-primary font-outfit mt-2">Sin duplicar ni exponer PII</h3>
                    <p className="text-[13px] mt-1">Evitamos duplicar datos que ya tenemos y respetamos que las fuentes entreguen información sin datos sensibles.</p>
                  </div>
                </div>
                <p className="text-[13px] text-ap-muted">
                  Nota: AcopioVE es la <strong>fuente de verdad</strong> de los centros de acopio, refugios y teléfonos
                  de emergencia propios; por eso esos no aparecen aquí (no los "bajamos" de un tercero, los gestionamos
                  nosotros).
                </p>
              </div>
            </section>

            {/* Fuentes agrupadas por categoría */}
            {CATEGORIES.map((cat) => {
              const items = SOURCES.filter((s) => s.categoria === cat);
              if (items.length === 0) return null;
              return (
                <section key={cat} className="scroll-mt-20 border-t border-ap-border pt-10">
                  <h2 className="text-[20px] md:text-[24px] font-extrabold text-ap-primary font-outfit flex items-center gap-2">
                    <Database size={20} className="text-ap-muted" />
                    {cat}
                  </h2>
                  <div className="mt-5 space-y-5">
                    {items.map((s) => (
                      <div
                        key={s.id}
                        id={s.id}
                        className="scroll-mt-20 border border-ap-border rounded-xl bg-ap-surface/40 overflow-hidden"
                      >
                        <div className="p-4 sm:p-5">
                          <div className="flex flex-wrap items-center gap-2.5 justify-between">
                            <h3 className="text-[16px] font-extrabold text-ap-primary font-outfit">{s.nombre}</h3>
                            <div className="flex items-center gap-2">
                              {s.sitio && (
                                <a
                                  href={s.sitio}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[12px] font-bold text-ap-secondary hover:text-ap-primary inline-flex items-center gap-1"
                                >
                                  Sitio <ExternalLink size={12} />
                                </a>
                              )}
                              {s.docs && (
                                <a
                                  href={s.docs}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[12px] font-bold text-ap-primary hover:underline inline-flex items-center gap-1"
                                >
                                  Docs <ExternalLink size={12} />
                                </a>
                              )}
                            </div>
                          </div>
                          <p className="text-[14px] text-ap-secondary mt-2 leading-relaxed">{s.descripcion}</p>
                          <div className="mt-3 font-mono text-[12.5px] bg-ap-bg border border-ap-border p-2.5 rounded select-all break-all text-ap-primary">
                            {s.base}
                          </div>
                          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 mt-3 text-[12.5px]">
                            <div>
                              <dt className="text-ap-muted font-bold uppercase text-[10px] tracking-wider">Método</dt>
                              <dd className="text-ap-secondary mt-0.5">{s.metodo}</dd>
                            </div>
                            <div>
                              <dt className="text-ap-muted font-bold uppercase text-[10px] tracking-wider">Acceso</dt>
                              <dd className="text-ap-secondary mt-0.5">{s.auth}</dd>
                            </div>
                            <div>
                              <dt className="text-ap-muted font-bold uppercase text-[10px] tracking-wider">Formato</dt>
                              <dd className="text-ap-secondary mt-0.5">{s.formato}</dd>
                            </div>
                            <div>
                              <dt className="text-ap-muted font-bold uppercase text-[10px] tracking-wider">Alimenta</dt>
                              <dd className="text-ap-secondary mt-0.5">{s.alimenta}</dd>
                            </div>
                          </dl>
                          {s.endpoints && s.endpoints.length > 0 && (
                            <details className="group mt-3 border-t border-ap-border/60 pt-3">
                              <summary className="cursor-pointer list-none flex items-center gap-1.5 text-[12px] font-bold text-ap-primary select-none">
                                <span className="text-ap-muted transition-transform group-open:rotate-45">+</span>
                                Endpoints ({s.endpoints.length})
                              </summary>
                              <div className="mt-2 space-y-1.5">
                                {s.endpoints.map((e) => (
                                  <div key={e.path} className="text-[12px] leading-snug">
                                    <span className="font-mono font-bold text-emerald-800">{e.metodo}</span>{' '}
                                    <span className="font-mono text-ap-primary break-all">{e.path}</span>
                                    <span className="text-ap-secondary"> — {e.desc}</span>
                                  </div>
                                ))}
                              </div>
                              <p className="mt-2 text-[11px] text-ap-muted">
                                API no oficial (sin OpenAPI); puede cambiar sin aviso.
                              </p>
                            </details>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}

            {/* Licencia */}
            <section id="licencia" className="scroll-mt-20 border-t border-ap-border pt-10">
              <h2 className="text-[20px] md:text-[24px] font-extrabold text-ap-primary font-outfit">
                Atribución y licencias
              </h2>
              <div className="text-[15px] text-ap-secondary mt-4 space-y-4 leading-relaxed">
                <p>
                  Cada fuente conserva la titularidad y los términos de su propia información. AcopioVE actúa como
                  agregador: mostramos los datos citando su origen (<code className="font-mono bg-ap-bg border border-ap-border px-1 py-0.5 rounded">source</code> y
                  enlace) y enlazamos a la plataforma original cuando está disponible.
                </p>
                <div className="bg-emerald-50 border border-emerald-150 rounded-xl p-4 text-[14px] text-emerald-950 flex gap-3">
                  <ShieldCheck className="text-emerald-800 mt-0.5 shrink-0" size={18} />
                  <div>
                    Si administrás una de estas fuentes y querés ajustar cómo te citamos, sumar o retirar tu API,
                    escribinos a <a href="mailto:info@acopiove.org" className="font-bold underline">info@acopiove.org</a>.
                  </div>
                </div>
                <p className="text-[13px] text-ap-muted">
                  Los datos propios de AcopioVE se publican bajo{' '}
                  <a
                    href="https://creativecommons.org/licenses/by/4.0/deed.es"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-ap-primary hover:underline"
                  >
                    CC-BY-4.0
                  </a>
                  ; esa licencia no cubre la información de terceros listada aquí.
                </p>
              </div>
            </section>
          </article>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
