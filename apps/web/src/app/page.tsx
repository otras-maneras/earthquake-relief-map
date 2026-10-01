import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Database,
  FileText,
  Globe2,
  ArrowRight,
  HeartHandshake,
  CheckCircle2,
  ExternalLink,
  Presentation,
  Code2,
  Sparkles,
  ChevronRight,
  Download,
  BookOpen,
  Server,
  Shield,
} from 'lucide-react';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { centros, telefonos } from '@/db/schema';
import { SiteHeader, SiteFooter, Eyebrow, ES_NAV, BRAND_PALETTE } from '@/components/site/Chrome';

export const revalidate = 300;

const SITE_URL = 'https://acopiove.org';

export const metadata: Metadata = {
  title: 'AcopioVE + HelpMaps · Plataforma Humanitaria y Datos Abiertos',
  description:
    'Plataforma comunitaria de auxilio y datos abiertos ante el terremoto de Venezuela 2026, integrada a la red HelpMaps. Directorio de centros de acopio y refugios en 22 países, documentación técnica, resumen ejecutivo y datos abiertos bajo licencia CC-BY-4.0. Proyecto concluido en octubre de 2026.',
  keywords: [
    'acopiove',
    'helpmaps',
    'helpmaps venezuela',
    'centros de acopio venezuela',
    'terremoto venezuela 2026',
    'refugios venezuela',
    'donaciones venezuela',
    'ayuda humanitaria venezuela',
    'datos abiertos venezuela',
    'código abierto',
    'ocha hdx venezuela',
  ],
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    type: 'website',
    locale: 'es_VE',
    url: SITE_URL,
    siteName: 'AcopioVE · HelpMaps',
    title: 'AcopioVE + HelpMaps · Plataforma Humanitaria y Red de Datos Abiertos',
    description:
      'Coordinación humanitaria, directorio de centros de acopio y refugios, documentación de arquitectura, resumen ejecutivo y datos abiertos ante la emergencia en Venezuela.',
    images: [
      {
        url: '/og-image-v2.png',
        width: 1200,
        height: 630,
        alt: 'AcopioVE + HelpMaps — Plataforma Humanitaria de Emergencia',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AcopioVE + HelpMaps · Plataforma Humanitaria y Datos Abiertos',
    description:
      'Directorio de centros de acopio, documentación de arquitectura, resumen del proyecto y datos abiertos para la emergencia en Venezuela.',
    images: ['/og-image-v2.png'],
  },
};

const FAQS = [
  {
    q: '¿Qué es AcopioVE y qué información reúne la plataforma?',
    a: 'AcopioVE es una plataforma humanitaria y de datos abiertos desarrollada ante el terremoto de Venezuela de 2026. Centraliza información verificada sobre centros de acopio en 22 países, albergues de resguardo, líneas de emergencia y canales de ayuda internacional bajo licencia Creative Commons (CC-BY-4.0).',
    href: '/resumen',
    linkText: 'Conocer más del proyecto',
  },
  {
    q: '¿Qué representa la fusión con HelpMaps (helpmaps.net)?',
    a: 'AcopioVE y HelpMaps consolidaron sus plataformas bajo un modelo de autoridad federada: AcopioVE lidera la autoridad canónica de centros de acopio, refugios y teléfonos, mientras que HelpMaps gestiona la infraestructura hospitalaria y clínica, ofreciendo una sola red unificada de respuesta humanitaria.',
    href: 'https://helpmaps.net',
    linkText: 'Visitar HelpMaps Global',
  },
  {
    q: '¿El proyecto sigue activo? ¿Dónde están el código y los datos?',
    a: 'AcopioVE concluyó su operación en octubre de 2026. El código fuente (licencia MIT) y los datos finales de centros de acopio, refugios y teléfonos de emergencia (CC-BY-4.0, con corte a julio de 2026) son abiertos: los datos se descargan en /data y el código está en el repositorio earthquake-relief-map de GitHub. La API pública fue dada de baja.',
    href: '/data',
    linkText: 'Descargar los datos abiertos',
  },
  {
    q: '¿Dónde consultar el resumen ejecutivo del proyecto y su impacto?',
    a: 'El balance institucional completo, con métricas de atención, coordinación con la diáspora en 22 países, lecciones aprendidas y resultados técnicos, está disponible en formato interactivo en /resumen.',
    href: '/resumen',
    linkText: 'Ver resumen ejecutivo',
  },
  {
    q: '¿Cómo descargar los datasets completos de centros de acopio y refugios?',
    a: 'Puedes acceder al portal de datos abiertos en /data para descargar de forma directa los archivos consolidados en formato CSV, JSON y GeoJSON bajo licencia abierta CC-BY-4.0.',
    href: '/data',
    linkText: 'Descargar datos abiertos',
  },
];

// El campo `pais` llega sin normalizar ('USA', 'venezuela', ...): unifica alias y mayúsculas.
const PAIS_ALIAS: Record<string, string> = { usa: 'estados unidos', 'ee.uu.': 'estados unidos', 'ee. uu.': 'estados unidos', eeuu: 'estados unidos' };
function normPais(p: string | null): string {
  const k = (p ?? '').trim().toLowerCase();
  return PAIS_ALIAS[k] ?? k;
}

export default async function LandingPage() {
  // Obtención dinámica de métricas desde la base de datos
  const rows = await db
    .select({ pais: centros.pais, ciudad: centros.ciudad, tipo: centros.tipo })
    .from(centros)
    .where(eq(centros.active, true))
    .catch(() => []);

  const tels = await db
    .select({ id: telefonos.id })
    .from(telefonos)
    .where(eq(telefonos.active, true))
    .catch(() => []);

  const totalCentros = rows.length || 716;
  const acopiosCount = rows.filter((r) => r.tipo === 'acopio').length || 664;
  const refugiosCount = rows.filter((r) => r.tipo === 'refugio').length || 52;
  const paisesCount = new Set(rows.map((r) => normPais(r.pais)).filter(Boolean)).size || 22;
  const ciudadesCount = new Set(rows.filter((r) => r.ciudad).map((r) => `${r.pais}|${r.ciudad}`)).size || 110;
  const telefonosCount = tels.length || 78;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        url: SITE_URL,
        name: 'AcopioVE · HelpMaps',
        alternateName: ['AcopioVE', 'HelpMaps Venezuela', 'HelpMaps'],
        description:
          'Plataforma humanitaria y red de datos abiertos de emergencia ante el terremoto de Venezuela 2026, parte de HelpMaps.',
        inLanguage: 'es-VE',
      },
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#organization`,
        name: 'AcopioVE & HelpMaps Alliance',
        url: SITE_URL,
        logo: `${SITE_URL}/brand/logo-lockup.png`,
        sameAs: ['https://helpmaps.net', 'https://x.com/acopiove', 'https://instagram.com/acopiove', 'https://github.com/otras-maneras/earthquake-relief-map'],
        description:
          'Iniciativa humanitaria independiente para la respuesta coordinada, directorio de centros de acopio, refugios y datos abiertos ante el terremoto de Venezuela de 2026.',
        areaServed: { '@type': 'Country', name: 'Venezuela' },
      },
      {
        '@type': 'Dataset',
        '@id': `${SITE_URL}/#dataset`,
        name: 'Directorio de Centros de Acopio, Refugios y Líneas de Emergencia - Venezuela 2026',
        description:
          'Catálogo georreferenciado de centros de acopio, albergues y teléfonos de emergencia en Venezuela y 22 países de la diáspora. Datos abiertos bajo licencia CC-BY-4.0.',
        url: `${SITE_URL}/data`,
        license: 'https://creativecommons.org/licenses/by/4.0/',
        creator: { '@id': `${SITE_URL}/#organization` },
        distribution: [
          {
            '@type': 'DataDownload',
            encodingFormat: 'application/json',
            contentUrl: `${SITE_URL}/datos/centros.json`,
          },
          {
            '@type': 'DataDownload',
            encodingFormat: 'text/csv',
            contentUrl: `${SITE_URL}/datos/centros.csv`,
          },
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: FAQS.map((faq) => ({
          '@type': 'Question',
          name: faq.q,
          acceptedAnswer: {
            '@type': 'Answer',
            text: faq.a,
          },
        })),
      },
    ],
  };

  return (
    <main id="main-content" className="min-h-[100dvh] bg-ap-bg font-sans" style={BRAND_PALETTE}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SiteHeader nav={ES_NAV} active="/" />

      {/* Banner de anuncio de fusión */}
      <div className="bg-[#003D8F] text-white border-b border-blue-900/40">
        <div className="max-w-[1000px] mx-auto px-4 py-2 flex items-center justify-between gap-4 text-[12px] md:text-[13px]">
          <span className="font-medium text-blue-100 truncate">
            <strong className="text-white">AcopioVE</strong> se ha fusionado con la red de{' '}
            <strong className="text-white">HelpMaps</strong> para unificar la respuesta de emergencia. Proyecto concluido en octubre de 2026.
          </span>
          <div className="flex items-center gap-3 shrink-0 text-[12px]">
            <a
              href="https://helpmaps.net"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-bold text-white hover:text-blue-200 transition-colors underline underline-offset-2"
            >
              helpmaps.net <ExternalLink size={12} />
            </a>
            <span className="text-white/40">|</span>
            <Link href="/resumen" className="font-bold text-white hover:text-blue-200 transition-colors">
              Ver Resumen del Proyecto →
            </Link>
          </div>
        </div>
      </div>

      {/* HERO SECTION */}
      <section className="relative bg-ap-surface border-b border-ap-border overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(#003d8f_1px,transparent_1px)] [background-size:24px_24px] opacity-[0.03] pointer-events-none" />
        <div className="max-w-[1000px] mx-auto px-4 py-12 md:py-20 relative">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200/80 text-[#003D8F] text-[11.5px] font-bold tracking-wide uppercase mb-6">
            <Sparkles size={13} className="text-[#003D8F]" />
            Ecosistema de Respuesta · Terremoto Venezuela 2026
          </div>

          <h1 className="text-[32px] sm:text-[44px] md:text-[54px] font-extrabold text-ap-primary font-outfit leading-[1.05] tracking-tight max-w-4xl">
            Plataforma humanitaria, datos abiertos y arquitectura de respuesta.
          </h1>

          <p className="text-[16px] md:text-[19px] text-ap-secondary mt-5 max-w-3xl leading-relaxed">
            Buscamos eliminar la asimetría de información y conectar necesidades urgentes con recursos verificados.
            Directorio de centros de acopio y albergues en 22 países (datos con corte a julio de 2026), documentación
            técnica de arquitectura y código y datos abiertos para la comunidad humanitaria internacional.
          </p>

          {/* Botones de acción principal */}
          <div className="flex flex-wrap items-center gap-3 mt-8">
            <Link
              href="/resumen"
              className="inline-flex items-center justify-center gap-2.5 bg-[#003D8F] text-white hover:bg-[#002f6c] px-6 py-3.5 rounded-xl font-bold text-[14px] shadow-sm transition-all hover:shadow-md group"
            >
              <Presentation size={18} className="text-blue-200 group-hover:scale-110 transition-transform" />
              <span>Ver Resumen Ejecutivo</span>
            </Link>

            <Link
              href="/docs"
              className="inline-flex items-center justify-center gap-2 bg-white text-ap-primary hover:bg-slate-50 border border-ap-border px-5 py-3.5 rounded-xl font-bold text-[14px] transition-all shadow-agentos-sm"
            >
              <Code2 size={17} className="text-[#003D8F]" />
              <span>Documentación</span>
            </Link>

            <Link
              href="/data"
              className="inline-flex items-center justify-center gap-2 bg-slate-100/90 text-ap-secondary hover:bg-slate-200/80 border border-ap-border/70 px-4 py-3.5 rounded-xl font-semibold text-[13.5px] transition-all"
            >
              <Database size={16} className="text-[#003D8F]" />
              <span>Descarga de Datos (CC-BY-4.0)</span>
            </Link>

            <Link
              href="/centros"
              className="inline-flex items-center justify-center gap-2 text-ap-muted hover:text-ap-primary px-3 py-3.5 font-semibold text-[13.5px] transition-colors"
            >
              <FileText size={16} />
              <span>Directorio por Ciudad</span>
            </Link>
          </div>
        </div>
      </section>

      {/* MÉTRICAS CLAVE / IMPACT STRIP */}
      <section className="border-b border-ap-border bg-slate-50/50">
        <div className="max-w-[1000px] mx-auto px-4 py-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-6 gap-2">
            <div>
              <Eyebrow>Impacto y Métricas Clave</Eyebrow>
              <h2 className="text-[20px] md:text-[24px] font-extrabold text-ap-primary font-outfit mt-1">
                Datos verificados al servicio de la respuesta humanitaria
              </h2>
            </div>
            <p className="text-[12.5px] text-ap-muted">
              Bases canónicas consolidadas y conciliación de fuentes externas abiertas.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 border border-ap-border bg-ap-surface rounded-2xl divide-x divide-y sm:divide-y-0 divide-ap-border overflow-hidden shadow-sm">
            <div className="p-4 sm:p-5">
              <div className="text-[26px] sm:text-[32px] font-extrabold text-[#003D8F] font-outfit leading-none tabular-nums">
                {totalCentros}
              </div>
              <div className="text-[12px] text-ap-muted font-bold mt-2">Centros y Refugios</div>
              <div className="text-[11px] text-ap-secondary mt-0.5">
                {acopiosCount} acopios · {refugiosCount} albergues
              </div>
            </div>

            <div className="p-4 sm:p-5">
              <div className="text-[26px] sm:text-[32px] font-extrabold text-ap-primary font-outfit leading-none tabular-nums">
                {paisesCount}
              </div>
              <div className="text-[12px] text-ap-muted font-bold mt-2">Países Activos</div>
              <div className="text-[11px] text-ap-secondary mt-0.5">Venezuela y la diáspora</div>
            </div>

            <div className="p-4 sm:p-5">
              <div className="text-[26px] sm:text-[32px] font-extrabold text-ap-primary font-outfit leading-none tabular-nums">
                {telefonosCount}
              </div>
              <div className="text-[12px] text-ap-muted font-bold mt-2">Líneas de Auxilio</div>
              <div className="text-[11px] text-ap-secondary mt-0.5">Emergencias y brigadas</div>
            </div>

            <div className="p-4 sm:p-5">
              <div className="text-[26px] sm:text-[32px] font-extrabold text-ap-primary font-outfit leading-none tabular-nums">
                14+
              </div>
              <div className="text-[12px] text-ap-muted font-bold mt-2">Fuentes Abiertas</div>
              <div className="text-[11px] text-ap-secondary mt-0.5">Satelitales y civiles</div>
            </div>

            <div className="p-4 sm:p-5">
              <div className="text-[26px] sm:text-[32px] font-extrabold text-ap-primary font-outfit leading-none tabular-nums">
                1,878
              </div>
              <div className="text-[12px] text-ap-muted font-bold mt-2">Voluntarios Registrados</div>
              <div className="text-[11px] text-ap-secondary mt-0.5">Red de apoyo e intérpretes</div>
            </div>

            <div className="p-4 sm:p-5">
              <div className="text-[26px] sm:text-[32px] font-extrabold text-emerald-600 font-outfit leading-none">
                100%
              </div>
              <div className="text-[12px] text-ap-muted font-bold mt-2">Datos Abiertos</div>
              <div className="text-[11px] text-ap-secondary mt-0.5">Licencia CC-BY-4.0</div>
            </div>
          </div>
        </div>
      </section>

      {/* SECCIÓN FUSIÓN HELPMAPS */}
      <section className="max-w-[1000px] mx-auto px-4 py-14 md:py-18">
        <div className="border border-blue-200/80 bg-gradient-to-br from-blue-50/70 via-white to-slate-50 rounded-2xl p-6 sm:p-8 md:p-10 shadow-sm relative overflow-hidden">
          <div className="max-w-2xl relative z-10">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100/80 text-[#003D8F] text-[11px] font-bold uppercase tracking-wider mb-3">
              <HeartHandshake size={14} /> Fusión e Integración Operativa
            </div>
            <h2 className="text-[24px] sm:text-[30px] font-extrabold text-ap-primary font-outfit leading-tight">
              AcopioVE y HelpMaps: una sola red humanitaria unificada
            </h2>
            <p className="text-[14.5px] text-ap-secondary mt-3 leading-relaxed">
              Para maximizar la eficiencia y evitar la duplicidad de esfuerzos en el terreno, <strong>AcopioVE</strong> y{' '}
              <strong>HelpMaps (helpmaps.net)</strong> han consolidado sus plataformas bajo un modelo federado de autoridad
              por dominio.
            </p>

            <div className="grid sm:grid-cols-2 gap-4 mt-6">
              <div className="bg-white/85 border border-blue-100 rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-2 text-[13px] font-bold text-[#003D8F]">
                  <CheckCircle2 size={16} className="text-[#003D8F]" />
                  <span>Autoridad de AcopioVE</span>
                </div>
                <p className="text-[12.5px] text-ap-secondary mt-1.5 leading-relaxed">
                  Gestión canónica del directorio de centros de acopio, albergues de resguardo, semáforo de frescura y
                  líneas telefónicas de rescate.
                </p>
              </div>

              <div className="bg-white/85 border border-blue-100 rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-2 text-[13px] font-bold text-[#003D8F]">
                  <CheckCircle2 size={16} className="text-[#003D8F]" />
                  <span>Aporte de HelpMaps</span>
                </div>
                <p className="text-[12.5px] text-ap-secondary mt-1.5 leading-relaxed">
                  Infraestructura hospitalaria y despliegue global de respuesta humanitaria, creando un estándar técnico
                  común para catástrofes en la región.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 mt-7">
              <a
                href="https://helpmaps.net"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 bg-[#003D8F] text-white hover:bg-[#002f6c] px-4 py-2.5 rounded-lg text-[13px] font-bold shadow-sm transition-colors"
              >
                <span>Visitar HelpMaps Global</span>
                <ExternalLink size={13} />
              </a>

              <Link
                href="/docs"
                className="inline-flex items-center gap-1.5 bg-white border border-ap-border text-ap-secondary hover:text-ap-primary px-4 py-2.5 rounded-lg text-[13px] font-semibold transition-colors"
              >
                <span>Leer contrato de integración en Docs</span>
                <ArrowRight size={13} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* MÓDULOS DEL ECOSISTEMA */}
      <section className="border-t border-ap-border bg-ap-surface py-14 md:py-18">
        <div className="max-w-[1000px] mx-auto px-4">
          <div className="max-w-2xl mb-10">
            <Eyebrow>Herramientas y Recursos</Eyebrow>
            <h2 className="text-[26px] md:text-[32px] font-extrabold text-ap-primary font-outfit mt-2">
              Recursos del proyecto y documentación abierta
            </h2>
            <p className="text-[15px] text-ap-secondary mt-2 leading-relaxed">
              Explora los recursos institucionales, especificaciones técnicas y conjuntos de datos diseñados para la
              coordinación y el análisis de la emergencia.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Tarjeta 1: Documentación y Arquitectura */}
            <div className="border border-ap-border bg-slate-50/40 hover:bg-slate-50/80 transition-all rounded-2xl p-6 flex flex-col justify-between group shadow-sm hover:shadow-md">
              <div>
                <div className="w-11 h-11 rounded-xl bg-blue-100/70 text-[#003D8F] flex items-center justify-center mb-4">
                  <Code2 size={22} />
                </div>
                <h3 className="text-[17px] font-extrabold text-ap-primary font-outfit group-hover:text-[#003D8F] transition-colors">
                  Documentación & Arquitectura
                </h3>
                <p className="text-[13px] text-ap-secondary mt-2 leading-relaxed">
                  Especificaciones técnicas del sistema, modelo de integración federada con HelpMaps, bases de datos PostgreSQL
                  y protocolos de anonimización y salvaguardas de datos sensibles.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-ap-border/60">
                <Link
                  href="/docs"
                  className="inline-flex items-center gap-1.5 text-[13px] font-bold text-[#003D8F] group-hover:underline"
                >
                  Ver documentación técnica <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </div>

            {/* Tarjeta 2: Portal de Datos Abiertos */}
            <div className="border border-ap-border bg-slate-50/40 hover:bg-slate-50/80 transition-all rounded-2xl p-6 flex flex-col justify-between group shadow-sm hover:shadow-md">
              <div>
                <div className="w-11 h-11 rounded-xl bg-cyan-100/70 text-cyan-800 flex items-center justify-center mb-4">
                  <Database size={22} />
                </div>
                <h3 className="text-[17px] font-extrabold text-ap-primary font-outfit group-hover:text-cyan-800 transition-colors">
                  Portal de Datos Abiertos
                </h3>
                <p className="text-[13px] text-ap-secondary mt-2 leading-relaxed">
                  Bases de datos consolidadas de centros de acopio, refugios y teléfonos de auxilio, descargables en formatos
                  universales (JSON, CSV, GeoJSON) bajo licencia CC-BY-4.0.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-ap-border/60">
                <Link
                  href="/data"
                  className="inline-flex items-center gap-1.5 text-[13px] font-bold text-cyan-800 group-hover:underline"
                >
                  Descargar datasets <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </div>

            {/* Tarjeta 3: Resumen Ejecutivo */}
            <div className="border border-ap-border bg-slate-50/40 hover:bg-slate-50/80 transition-all rounded-2xl p-6 flex flex-col justify-between group shadow-sm hover:shadow-md">
              <div>
                <div className="w-11 h-11 rounded-xl bg-amber-100/70 text-amber-800 flex items-center justify-center mb-4">
                  <Presentation size={22} />
                </div>
                <h3 className="text-[17px] font-extrabold text-ap-primary font-outfit group-hover:text-amber-800 transition-colors">
                  Resumen Ejecutivo & Resultados
                </h3>
                <p className="text-[13px] text-ap-secondary mt-2 leading-relaxed">
                  Presentación y balance institucional del proyecto: volumen de datos manejados, impacto con la diáspora en 24
                  países, alianza con HelpMaps y lecciones aprendidas.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-ap-border/60">
                <Link
                  href="/resumen"
                  className="inline-flex items-center gap-1.5 text-[13px] font-bold text-amber-800 group-hover:underline"
                >
                  Ver presentación interactiva <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </div>

            {/* Tarjeta 4: Directorios Ligeros */}
            <div className="border border-ap-border bg-slate-50/40 hover:bg-slate-50/80 transition-all rounded-2xl p-6 flex flex-col justify-between group shadow-sm hover:shadow-md">
              <div>
                <div className="w-11 h-11 rounded-xl bg-emerald-100/70 text-emerald-800 flex items-center justify-center mb-4">
                  <FileText size={22} />
                </div>
                <h3 className="text-[17px] font-extrabold text-ap-primary font-outfit group-hover:text-emerald-800 transition-colors">
                  Directorios Ligeros por Ciudad
                </h3>
                <p className="text-[13px] text-ap-secondary mt-2 leading-relaxed">
                  Vistas SSR optimizadas para conexiones lentas y celulares de baja gama. Consulta centros de acopio y
                  refugios organizados por país y municipio.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-ap-border/60 flex items-center gap-3">
                <Link href="/refugios" className="text-[13px] font-bold text-emerald-800 hover:underline">
                  Refugios
                </Link>
                <span className="text-ap-muted">·</span>
                <Link href="/centros" className="text-[13px] font-bold text-emerald-800 hover:underline">
                  Centros de acopio
                </Link>
              </div>
            </div>

            {/* Tarjeta 5: Red de Voluntarios e Intérpretes */}
            <div className="border border-ap-border bg-slate-50/40 hover:bg-slate-50/80 transition-all rounded-2xl p-6 flex flex-col justify-between group shadow-sm hover:shadow-md">
              <div>
                <div className="w-11 h-11 rounded-xl bg-purple-100/70 text-purple-700 flex items-center justify-center mb-4">
                  <Globe2 size={22} />
                </div>
                <h3 className="text-[17px] font-extrabold text-ap-primary font-outfit group-hover:text-purple-700 transition-colors">
                  Red de Voluntarios e Intérpretes
                </h3>
                <p className="text-[13px] text-ap-secondary mt-2 leading-relaxed">
                  Directorio de 1,878 traductores e intérpretes voluntarios para asistir a familias damnificadas y
                  facilitar la comunicación con brigadas internacionales de rescate.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-ap-border/60">
                <Link
                  href="/interpretes"
                  className="inline-flex items-center gap-1.5 text-[13px] font-bold text-purple-700 group-hover:underline"
                >
                  Consultar red de intérpretes <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </div>

            {/* Tarjeta 6: Código y datos abiertos */}
            <div className="border border-ap-border bg-slate-50/40 hover:bg-slate-50/80 transition-all rounded-2xl p-6 flex flex-col justify-between group shadow-sm hover:shadow-md">
              <div>
                <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center mb-4">
                  <Server size={22} />
                </div>
                <h3 className="text-[17px] font-extrabold text-ap-primary font-outfit group-hover:text-slate-900 transition-colors">
                  Código y Datos Abiertos
                </h3>
                <p className="text-[13px] text-ap-secondary mt-2 leading-relaxed">
                  Código fuente bajo licencia MIT y datos finales de centros, refugios y teléfonos bajo CC-BY-4.0, listos
                  para reutilizar en futuras emergencias.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-ap-border/60 flex items-center gap-3">
                <Link href="/data" className="text-[13px] font-bold text-[#003D8F] hover:underline">
                  Descargar datos
                </Link>
                <span className="text-ap-muted">·</span>
                <Link href="/docs/fuentes" className="text-[13px] font-semibold text-ap-secondary hover:underline">
                  Fuentes de datos
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECCIÓN DOCUMENTACIÓN Y RESUMEN DESTACADOS */}
      <section className="max-w-[1000px] mx-auto px-4 py-14 md:py-18">
        <div className="grid md:grid-cols-2 gap-6">
          {/* Card Resumen */}
          <div className="border border-ap-border rounded-2xl p-7 bg-white shadow-sm flex flex-col justify-between">
            <div>
              <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#003D8F] uppercase tracking-wider bg-blue-50 px-2.5 py-1 rounded-md mb-4">
                <Presentation size={14} /> Balance Institucional
              </div>
              <h3 className="text-[20px] font-extrabold text-ap-primary font-outfit">
                Resumen Ejecutivo y Resultados del Proyecto
              </h3>
              <p className="text-[14px] text-ap-secondary mt-3 leading-relaxed">
                Accede a la presentación interactiva elaborada por el equipo con todo el desglose del proyecto: arquitectura,
                números de atención, coordinación con 22 países de la diáspora, neutralización de rumores con IA y la
                sinergia con HelpMaps.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-ap-border flex items-center justify-between">
              <Link
                href="/resumen"
                className="inline-flex items-center gap-2 bg-[#003D8F] text-white hover:bg-[#002f6c] px-4 py-2.5 rounded-lg text-[13px] font-bold transition-colors"
              >
                <span>Ver Presentación Interactiva</span>
                <ArrowRight size={14} />
              </Link>
              <Link href="/acerca" className="text-[13px] font-semibold text-ap-muted hover:text-ap-primary">
                Sobre AcopioVE
              </Link>
            </div>
          </div>

          {/* Card Documentación y Arquitectura */}
          <div className="border border-ap-border rounded-2xl p-7 bg-white shadow-sm flex flex-col justify-between">
            <div>
              <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-700 uppercase tracking-wider bg-slate-100 px-2.5 py-1 rounded-md mb-4">
                <Code2 size={14} /> Especificación Técnica
              </div>
              <h3 className="text-[20px] font-extrabold text-ap-primary font-outfit">
                Documentación Técnica del Proyecto
              </h3>
              <p className="text-[14px] text-ap-secondary mt-3 leading-relaxed">
                Guía completa sobre los contratos de datos, arquitectura, esquema de base de datos PostgreSQL, licencia abierta y políticas de privacidad.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-ap-border flex items-center justify-between">
              <Link
                href="/docs"
                className="inline-flex items-center gap-2 bg-slate-900 text-white hover:bg-slate-800 px-4 py-2.5 rounded-lg text-[13px] font-bold transition-colors"
              >
                <span>Ver Documentación Técnica</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FUENTES Y TRANSPARENCIA */}
      <section className="border-t border-ap-border bg-slate-50/60 py-12">
        <div className="max-w-[1000px] mx-auto px-4">
          <div className="text-center max-w-xl mx-auto mb-8">
            <Eyebrow>Transparencia y Colaboración</Eyebrow>
            <h2 className="text-[20px] md:text-[24px] font-extrabold text-ap-primary font-outfit mt-1">
              Fuentes oficiales, satelitales y comunitarias
            </h2>
            <p className="text-[13px] text-ap-muted mt-1.5">
              Datos verificados provenientes de agencias globales e iniciativas de la sociedad civil.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2.5 max-w-3xl mx-auto text-[12px] font-semibold text-ap-secondary">
            <span className="bg-white border border-ap-border px-3 py-1.5 rounded-lg shadow-2xs">USGS Earthquake Hazards</span>
            <span className="bg-white border border-ap-border px-3 py-1.5 rounded-lg shadow-2xs">Microsoft AI for Good</span>
            <span className="bg-white border border-ap-border px-3 py-1.5 rounded-lg shadow-2xs">UN OCHA HDX</span>
            <span className="bg-white border border-ap-border px-3 py-1.5 rounded-lg shadow-2xs">HelpMaps Global</span>
            <span className="bg-white border border-ap-border px-3 py-1.5 rounded-lg shadow-2xs">GDACS Alertas</span>
            <span className="bg-white border border-ap-border px-3 py-1.5 rounded-lg shadow-2xs">Open-Meteo</span>
            <span className="bg-white border border-ap-border px-3 py-1.5 rounded-lg shadow-2xs">Cruz Roja (RCF)</span>
            <span className="bg-white border border-ap-border px-3 py-1.5 rounded-lg shadow-2xs">Interp-Aid</span>
            <span className="bg-white border border-ap-border px-3 py-1.5 rounded-lg shadow-2xs">REDH AVAPRE</span>
          </div>
        </div>
      </section>

      {/* PREGUNTAS FRECUENTES (SEO & RICH SNIPPETS) */}
      <section className="border-t border-ap-border bg-ap-surface py-14 md:py-18">
        <div className="max-w-[1000px] mx-auto px-4">
          <div className="max-w-2xl mb-8">
            <Eyebrow>Preguntas Frecuentes</Eyebrow>
            <h2 className="text-[24px] md:text-[28px] font-extrabold text-ap-primary font-outfit mt-1">
              Preguntas frecuentes sobre AcopioVE y HelpMaps
            </h2>
          </div>

          <div className="grid gap-4 max-w-3xl">
            {FAQS.map((faq, i) => (
              <div key={i} className="border border-ap-border rounded-xl p-5 bg-slate-50/40">
                <h3 className="text-[15.5px] font-bold text-ap-primary font-outfit">{faq.q}</h3>
                <p className="text-[13.5px] text-ap-secondary mt-2 leading-relaxed">{faq.a}</p>
                <div className="mt-3">
                  <Link
                    href={faq.href}
                    className="inline-flex items-center gap-1 text-[12.5px] font-bold text-[#003D8F] hover:underline"
                  >
                    {faq.linkText} <ChevronRight size={13} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="border-t border-ap-border bg-[#003D8F] text-white py-14">
        <div className="max-w-[1000px] mx-auto px-4 text-center">
          <h2 className="text-[26px] sm:text-[34px] font-extrabold font-outfit leading-tight">
            Accede a la documentación, el resumen y los datos abiertos
          </h2>
          <p className="text-blue-100 text-[15px] mt-3 max-w-2xl mx-auto leading-relaxed">
            Consulta los resultados del despliegue humanitario y descarga los datasets abiertos en CC-BY-4.0 para
            reutilizarlos en tus proyectos.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
            <Link
              href="/resumen"
              className="inline-flex items-center gap-2 bg-white text-[#003D8F] hover:bg-blue-50 px-6 py-3.5 rounded-xl font-bold text-[14px] shadow-md transition-colors"
            >
              <Presentation size={18} />
              <span>Ver Resumen Ejecutivo</span>
            </Link>
            <Link
              href="/docs"
              className="inline-flex items-center gap-2 bg-blue-800/80 hover:bg-blue-800 border border-blue-400/40 text-white px-5 py-3.5 rounded-xl font-bold text-[14px] transition-colors"
            >
              <Code2 size={16} />
              <span>Documentación Técnica</span>
            </Link>
            <Link
              href="/data"
              className="inline-flex items-center gap-2 bg-transparent hover:bg-white/10 text-white px-4 py-3.5 rounded-xl font-semibold text-[13.5px] transition-colors"
            >
              <Database size={16} />
              <span>Portal de Datos Abiertos</span>
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
