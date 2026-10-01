import type { Metadata } from 'next';
import Link from 'next/link';
import { eq } from 'drizzle-orm';
import { ArrowRight } from 'lucide-react';
import { db } from '@/db';
import { centros, telefonos } from '@/db/schema';
import { SiteHeader, SiteFooter, Eyebrow, ES_NAV, BRAND_PALETTE } from '@/components/site/Chrome';

export const revalidate = 300;

const SITE_URL = 'https://acopiove.org';

export const metadata: Metadata = {
  title: 'Acerca de AcopioVE: qué es, qué datos reúne y fuentes',
  description:
    'Qué es AcopioVE, qué información reúne la plataforma sobre el terremoto de Venezuela 2026 (refugios, centros de acopio, teléfonos), cómo verificamos los datos y nuestras fuentes.',
  alternates: { canonical: `${SITE_URL}/acerca` },
  openGraph: {
    type: 'website',
    locale: 'es_VE',
    url: `${SITE_URL}/acerca`,
    siteName: 'AcopioVE',
    title: 'Acerca de AcopioVE',
    description: 'Qué es AcopioVE, qué datos reúne y cómo los verificamos.',
    images: [{ url: '/og-image-v2.png', width: 1200, height: 630, alt: 'AcopioVE' }],
  },
};

const SECCIONES: { label: string; desc: string; href: string }[] = [
  { label: 'Refugios', desc: 'Refugios y puntos de resguardo habilitados, por país y ciudad.', href: '/refugios' },
  { label: 'Centros de acopio', desc: 'Dónde llevar o enviar donaciones, por país y ciudad.', href: '/centros' },
  { label: 'Donar (internacional)', desc: 'Cómo ayudar desde el exterior, en inglés, francés y portugués.', href: '/donate' },
  { label: 'Blog', desc: 'Información verificada: qué pasó, seguridad ante réplicas y cómo ayudar.', href: '/blog' },
  { label: 'Voluntarios intérpretes', desc: 'Intérpretes y apoyo remoto para familias afectadas.', href: '/interpretes' },
];

const FUENTES: { title: string; body: string }[] = [
  { title: 'Centros, refugios y teléfonos', body: 'Recopilados de fuentes comunitarias públicas verificadas, cuentas y medios confiables, hojas colaborativas y reportes directos de organizaciones. Cada punto indica su fuente.' },
  { title: 'Datos sísmicos', body: 'Epicentros, mapa de intensidad (escala de Mercalli) y réplicas provienen del Servicio Geológico de EE. UU. (USGS), de dominio público.' },
  { title: 'Moderación', body: 'Las sugerencias del público entran como pendientes y se revisan antes de publicarse en el mapa.' },
];

export default async function AcercaPage() {
  const rows = await db
    .select({ pais: centros.pais, ciudad: centros.ciudad, tipo: centros.tipo })
    .from(centros)
    .where(eq(centros.active, true));
  const tels = await db.select({ id: telefonos.id }).from(telefonos).where(eq(telefonos.active, true));

  const total = rows.length;
  const refugios = rows.filter((r) => r.tipo === 'refugio').length;
  const acopios = rows.filter((r) => r.tipo === 'acopio').length;
  const paises = new Set(rows.map((r) => r.pais).filter(Boolean)).size;
  const ciudades = new Set(rows.filter((r) => r.ciudad).map((r) => `${r.pais}|${r.ciudad}`)).size;

  const stats = [
    { value: total, label: 'Puntos activos' },
    { value: acopios, label: 'Centros de acopio' },
    { value: refugios, label: 'Refugios' },
    { value: paises, label: 'Países' },
    { value: ciudades, label: 'Ciudades' },
    { value: tels.length, label: 'Teléfonos de emergencia' },
  ];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    name: 'Acerca de AcopioVE',
    url: `${SITE_URL}/acerca`,
    inLanguage: 'es',
    about: {
      '@type': 'Organization',
      name: 'AcopioVE',
      url: SITE_URL,
      description: 'Mapa y directorio de emergencia, comunitario e independiente, para el terremoto de Venezuela de 2026.',
    },
  };

  return (
    <main id="main-content" className="min-h-[100dvh] bg-ap-bg font-sans" style={BRAND_PALETTE}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SiteHeader nav={ES_NAV} active="/acerca" />

      {/* Hero */}
      <section className="border-b border-ap-border">
        <div className="max-w-[1000px] mx-auto px-4 py-12 md:py-16">
          <Eyebrow>Acerca de la plataforma</Eyebrow>
          <h1 className="text-[30px] md:text-[40px] font-extrabold text-ap-primary font-outfit leading-[1.08] mt-3 max-w-3xl">
            Qué es AcopioVE y qué datos reúne
          </h1>
          <p className="text-[16px] text-ap-secondary mt-4 max-w-2xl leading-relaxed">
            AcopioVE es un mapa y directorio de emergencia, comunitario e independiente, para la respuesta al terremoto de Venezuela de 2026. Reúne en un solo lugar refugios, centros de acopio, teléfonos de emergencia y canales de ayuda, verificados y actualizados de forma continua.
          </p>
        </div>
      </section>

      {/* Datos en vivo */}
      <section className="max-w-[1000px] mx-auto px-4 py-12">
        <h2 className="text-[20px] md:text-[24px] font-extrabold text-ap-primary font-outfit">Los datos de la plataforma</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 border border-ap-border rounded-xl divide-x divide-y divide-ap-border mt-6 overflow-hidden">
          {stats.map((s, i) => (
            <div key={i} className="p-5">
              <div className="text-[26px] md:text-[30px] font-extrabold text-ap-primary font-outfit leading-none tabular-nums">{s.value}</div>
              <div className="text-[12px] text-ap-muted font-semibold mt-1.5">{s.label}</div>
            </div>
          ))}
        </div>
        <p className="text-[12px] text-ap-muted mt-3">Cifras de la base de datos al cierre del proyecto (corte a julio de 2026).</p>
      </section>

      {/* Secciones */}
      <section className="border-y border-ap-border bg-ap-surface">
        <div className="max-w-[1000px] mx-auto px-4 py-12">
          <h2 className="text-[20px] md:text-[24px] font-extrabold text-ap-primary font-outfit">Todo lo que encontrás</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 mt-6 border-t border-ap-border">
            {SECCIONES.map((s, i) => (
              <Link key={i} href={s.href} className="group py-4 border-b border-ap-border flex items-start gap-3 hover:bg-ap-bg/50 transition-colors -mx-3 px-3">
                <div className="flex-1">
                  <h3 className="text-[15px] font-bold text-ap-primary font-outfit">{s.label}</h3>
                  <p className="text-[13px] text-ap-secondary mt-0.5 leading-relaxed">{s.desc}</p>
                </div>
                <ArrowRight size={16} className="text-ap-muted mt-0.5 shrink-0 group-hover:text-ap-primary group-hover:translate-x-0.5 transition-all" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Censos y Registro de Necesidades Especiales */}
      <section className="max-w-[1000px] mx-auto px-4 py-12 border-t border-ap-border">
        <h2 className="text-[20px] md:text-[24px] font-extrabold text-ap-primary font-outfit">Censos y Necesidades Especiales</h2>
        <p className="text-[14px] text-ap-secondary mt-3 max-w-2xl leading-relaxed">
          Para optimizar la logistica de distribucion de insumos especificos en los refugios y centros de acopio, apoyamos a organizaciones civiles en el registro de poblaciones con necesidades especiales:
        </p>
        <div className="mt-6 border border-ap-border rounded-xl p-5 max-w-2xl bg-ap-surface flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex-1">
            <h3 className="text-[15.5px] font-bold text-ap-primary font-outfit">Censo de Emergencia: Poblacion Celiaca y Sensible al Gluten</h3>
            <p className="text-[13px] text-ap-secondary mt-1 leading-relaxed">
              Iniciativa para censar y canalizar alimentos seguros sin gluten (sin TACC) para la poblacion celiaca y con sensibilidad al gluten no celiaca afectada por el sismo.
            </p>
          </div>
          <a
            href="https://docs.google.com/forms/d/e/1FAIpQLSeTfwwcg6pH4A2jdILcJJl-XLkPZZzx4EmqjF6mXz6yXZgT5g/viewform"
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 inline-flex items-center gap-1.5 bg-ap-primary text-white hover:opacity-90 transition-opacity px-4 py-2.5 rounded-lg font-bold text-[13px] whitespace-nowrap"
          >
            Completar Censo
            <ArrowRight size={14} />
          </a>
        </div>
      </section>

      {/* Fuentes y metodología */}
      <section className="max-w-[1000px] mx-auto px-4 py-12 border-t border-ap-border">
        <h2 className="text-[20px] md:text-[24px] font-extrabold text-ap-primary font-outfit">Fuentes y verificación</h2>
        <div className="mt-6 max-w-2xl space-y-5">
          {FUENTES.map((f, i) => (
            <div key={i}>
              <h3 className="text-[15px] font-bold text-ap-primary font-outfit">{f.title}</h3>
              <p className="text-[14px] text-ap-secondary mt-1 leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-8 border border-ap-border rounded-xl p-5 max-w-2xl">
          <p className="text-[13.5px] text-ap-secondary leading-relaxed">
            <strong className="text-ap-primary">AcopioVE es un proyecto comunitario e independiente.</strong> No es un sitio oficial ni gubernamental. Si encontrás un dato desactualizado o querés sumar un punto, podés sugerirlo desde el mapa o escribirnos a{' '}
            <a href="mailto:info@acopiove.org" className="font-bold text-ap-primary hover:underline">info@acopiove.org</a>.
          </p>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
