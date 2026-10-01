import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { centros, telefonos, contactLists, contacts } from '@/db/schema';
import { SiteHeader, SiteFooter, Eyebrow, ES_NAV, BRAND_PALETTE } from '@/components/site/Chrome';

export const revalidate = 300;

const SITE_URL = 'https://acopiove.org';

export const metadata: Metadata = {
  title: 'Documentacion y Preguntas del Proyecto - AcopioVE',
  description:
    'Documentacion tecnica y operativa de la plataforma AcopioVE para el terremoto de Venezuela de 2026. Respuestas sobre el estado del proyecto, bases de datos y propuestas logisticas de ayuda.',
  alternates: { canonical: `${SITE_URL}/docs` },
  openGraph: {
    type: 'website',
    locale: 'es_VE',
    url: `${SITE_URL}/docs`,
    siteName: 'AcopioVE',
    title: 'Documentacion y Preguntas del Proyecto - AcopioVE',
    description: 'Respuestas sobre el estado del proyecto, bases de datos y propuestas logisticas de ayuda.',
    images: [{ url: '/og-image-v2.png', width: 1200, height: 630, alt: 'AcopioVE' }],
  },
};

export default async function DocsPage() {
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

  const stats = {
    total,
    refugios,
    acopios,
    paises,
    ciudades,
    telefonos: tels.length,
  };

  const contactsData = await db
    .select({
      name: contactLists.name,
      count: sql<number>`count(${contacts.id})::int`,
    })
    .from(contactLists)
    .leftJoin(contacts, eq(contactLists.id, contacts.listId))
    .groupBy(contactLists.name);

  const contactStats = {
    interpretes: contactsData.find((c) => c.name === 'Voluntarios intérpretes')?.count || 0,
    acopios: contactsData.find((c) => c.name === 'Centros de acopio')?.count || 0,
  };

  const sections = [
    { id: 'venimos-haciendo', title: '1. ¿Que venimos haciendo?' },
    { id: 'informacion-contamos', title: '2. ¿Con que informacion contamos?' },
    { id: 'plataforma-cuenta', title: '3. ¿Con que cuenta la plataforma?' },
    { id: 'comunicacion-busqueda', title: '4. ¿Como funciona la busqueda y canales de comunicacion?' },
    { id: 'tecnologias-usamos', title: '5. ¿Que tecnologias usamos?' },
    { id: 'capacidad-actual', title: '6. ¿Que capacidad tiene la plataforma?' },
    { id: 'ampliar-capacidad', title: '7. ¿Que necesitamos para ampliar la capacidad?' },
    { id: 'venimos-trabajando', title: '8. ¿En que venimos trabajando?' },
    { id: 'grandes-retos', title: '9. Propuestas para los grandes retos actuales' },
  ];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: '¿Que venimos haciendo?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Desde el inicio de la emergencia provocada por el sismo de Venezuela de 2026, venimos centralizando e indexando informacion sobre centros de acopio y refugios activos en un mapa publico interactivo de geolocalizacion, ademas de ofrecer contactos de Restablecimiento del Contacto Familiar y telefonos de emergencia.',
        },
      },
      {
        '@type': 'Question',
        name: '¿Con que informacion contamos?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Contamos con una base de datos unificada que recopila ${stats.total} centros de asistencia activos, ${stats.refugios} refugios y ${stats.telefonos} telefonos de emergencia en ${stats.paises} paises y ${stats.ciudades} ciudades.`,
        },
      },
    ],
  };

  return (
    <main id="main-content" className="min-h-[100dvh] bg-ap-bg font-sans" style={BRAND_PALETTE}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SiteHeader nav={ES_NAV} active="/docs" />

      {/* Hero */}
      <section className="border-b border-ap-border bg-ap-surface">
        <div className="max-w-[1000px] mx-auto px-4 py-12 md:py-16">
          <Eyebrow>Documentacion general</Eyebrow>
          <h1 className="text-[32px] md:text-[42px] font-extrabold text-ap-primary font-outfit leading-[1.08] mt-3 max-w-3xl">
            Preguntas, Respuestas y Estado de la Plataforma
          </h1>
          <p className="text-[16px] text-ap-secondary mt-4 max-w-2xl leading-relaxed">
            Consulte los detalles operativos y de coordinacion de AcopioVE, las capacidades del sistema y las propuestas para sumar apoyos en la atencion de la emergencia.
          </p>
        </div>
      </section>

      {/* Layout de dos columnas */}
      <section className="max-w-[1000px] mx-auto px-4 py-12">
        <div className="flex flex-col md:flex-row gap-8 items-start">
          {/* Navegacion lateral (Sticky Sidebar) */}
          <aside className="w-full md:w-[260px] shrink-0 sticky top-20 hidden md:block border border-ap-border rounded-xl p-4 bg-ap-surface">
            <h2 className="text-[13px] font-bold text-ap-muted uppercase tracking-[0.08em] border-b border-ap-border pb-2 mb-3">
              En este documento
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

          {/* Contenido principal */}
          <article className="w-full md:flex-1 min-w-0 space-y-12">
            
            {/* Banner Fuentes y APIs públicas que usamos */}
            <div className="border border-ap-border rounded-xl p-5 bg-ap-surface flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
              <div>
                <span className="inline-block text-[10px] font-extrabold text-ap-primary bg-ap-bg border border-ap-border px-2 py-0.5 rounded-full uppercase tracking-wider">Transparencia</span>
                <h2 className="text-[16px] font-extrabold text-ap-primary font-outfit mt-1.5">Fuentes y APIs públicas que usamos</h2>
                <p className="text-[13.5px] text-ap-secondary mt-1 leading-relaxed">
                  Catálogo de todas las APIs públicas y plataformas aliadas que AcopioVE agrega automáticamente (personas, salud, daños, servicios, sismos y voluntarios).
                </p>
              </div>
              <Link
                href="/docs/fuentes"
                className="shrink-0 inline-flex items-center gap-1.5 border border-ap-border bg-ap-surface text-ap-primary hover:bg-ap-surface-hover transition-colors px-4 py-2.5 rounded-lg font-bold text-[13px]"
              >
                Ver fuentes
                <ArrowRight size={14} />
              </Link>
            </div>

            {/* Seccion 1 */}
            <section id="venimos-haciendo" className="scroll-mt-20">
              <h2 className="text-[20px] md:text-[24px] font-extrabold text-ap-primary font-outfit">
                1. ¿Que venimos haciendo?
              </h2>
              <div className="text-[15px] text-ap-secondary mt-4 space-y-3 leading-relaxed">
                <p>
                  Desde el inicio de la emergencia provocada por el sismo de Venezuela de 2026, nos enfocamos en resolver la fragmentacion y dispersion de la informacion util. Nuestro trabajo comprende:
                </p>
                <ul className="list-disc pl-5 space-y-2">
                  <li>
                    <strong>Centralizacion e indexacion:</strong> Unificamos la informacion sobre puntos de recepcion de ayuda humanitaria y resguardo temporal de forma verídica y estructurada.
                  </li>
                  <li>
                    <strong>Geolocalizacion y Mapas:</strong> Desplegamos una interfaz cartografica publica donde el ciudadano puede ver en tiempo real que centros estan activos, que insumos reciben prioritariamente y cuales estan llenos o cerrados.
                  </li>
                  <li>
                    <strong>Directorio y Comunicaciones:</strong> Sistematizamos un directorio completo de telefonos de emergencia por localidades y habilitamos los contactos oficiales del programa de Restablecimiento del Contacto Familiar (RCF) de la Cruz Roja.
                  </li>
                </ul>
              </div>
            </section>

            {/* Seccion 2 */}
            <section id="informacion-contamos" className="scroll-mt-20 border-t border-ap-border pt-10">
              <h2 className="text-[20px] md:text-[24px] font-extrabold text-ap-primary font-outfit">
                2. ¿Con que informacion contamos? (Bases de datos, centralizacion y fuentes)
              </h2>
              <div className="text-[15px] text-ap-secondary mt-4 space-y-3 leading-relaxed">
                <p>
                  Disponemos de un registro centralizado que actualmente incluye:
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 border border-ap-border rounded-xl gap-px bg-ap-border my-6 overflow-hidden">
                  <div className="p-4 bg-ap-surface">
                    <div className="text-[22px] font-extrabold text-ap-primary font-outfit tabular-nums">{stats.total}</div>
                    <div className="text-[11px] text-ap-muted font-bold uppercase mt-1">Puntos Activos</div>
                  </div>
                  <div className="p-4 bg-ap-surface">
                    <div className="text-[22px] font-extrabold text-ap-primary font-outfit tabular-nums">{stats.acopios}</div>
                    <div className="text-[11px] text-ap-muted font-bold uppercase mt-1">Centros de Acopio</div>
                  </div>
                  <div className="p-4 bg-ap-surface">
                    <div className="text-[22px] font-extrabold text-ap-primary font-outfit tabular-nums">{stats.refugios}</div>
                    <div className="text-[11px] text-ap-muted font-bold uppercase mt-1">Refugios</div>
                  </div>
                  <div className="p-4 bg-ap-surface">
                    <div className="text-[22px] font-extrabold text-ap-primary font-outfit tabular-nums">{stats.paises}</div>
                    <div className="text-[11px] text-ap-muted font-bold uppercase mt-1">Paises</div>
                  </div>
                  <div className="p-4 bg-ap-surface">
                    <div className="text-[22px] font-extrabold text-ap-primary font-outfit tabular-nums">{stats.ciudades}</div>
                    <div className="text-[11px] text-ap-muted font-bold uppercase mt-1">Ciudades</div>
                  </div>
                  <div className="p-4 bg-ap-surface">
                    <div className="text-[22px] font-extrabold text-ap-primary font-outfit tabular-nums">{stats.telefonos}</div>
                    <div className="text-[11px] text-ap-muted font-bold uppercase mt-1">Telefonos de Emergencia</div>
                  </div>
                </div>
                <details className="group border border-ap-border rounded-xl bg-ap-surface/40 overflow-hidden my-4">
                  <summary className="cursor-pointer list-none p-4 flex justify-between items-center select-none font-bold text-[14.5px] text-ap-primary hover:bg-ap-surface/60 transition-colors">
                    <span>Ver listado detallado de todas las fuentes de informacion</span>
                    <span className="text-[18px] text-ap-muted font-light transition-transform group-open:rotate-45">+</span>
                  </summary>
                  <div className="p-4 border-t border-ap-border bg-ap-surface/10 text-[13.5px] text-ap-secondary leading-relaxed">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      
                      {/* Columna 1: Sitios Web y Plataformas */}
                      <div>
                        <h4 className="font-bold text-ap-primary mb-2 border-b border-ap-border pb-1">Plataformas y Webs</h4>
                        <ul className="space-y-1.5">
                          <li><a href="https://centrosayudavenezuela.org" target="_blank" rel="noopener noreferrer" className="hover:underline font-semibold text-ap-primary">centrosayudavenezuela.org</a> (Centros de acopio)</li>
                          <li><a href="https://refugio-ve.vercel.app" target="_blank" rel="noopener noreferrer" className="hover:underline font-semibold text-ap-primary">RefugioVE</a> (Indexacion de refugios)</li>
                          <li><a href="https://ayudasismove.org" target="_blank" rel="noopener noreferrer" className="hover:underline font-semibold text-ap-primary">ayudasismove.org</a> (Venezuela Conecta)</li>
                          <li><a href="https://ayudavenezuela.help" target="_blank" rel="noopener noreferrer" className="hover:underline font-semibold text-ap-primary">ayudavenezuela.help</a> (Asistencia humanitaria)</li>
                          <li><a href="https://ayudahumanitariavenezuela.org" target="_blank" rel="noopener noreferrer" className="hover:underline font-semibold text-ap-primary">ayudahumanitariavenezuela.org</a> (Ayuda medica)</li>
                          <li><span className="font-semibold text-ap-primary">Interp-Aid</span> (Voluntarios interpretes)</li>
                          <li><a href="https://earthquake.usgs.gov" target="_blank" rel="noopener noreferrer" className="hover:underline font-semibold text-ap-primary">USGS</a> (Datos sismicos oficiales)</li>
                        </ul>
                      </div>

                      {/* Columna 2: Prensa y Radio */}
                      <div>
                        <h4 className="font-bold text-ap-primary mb-2 border-b border-ap-border pb-1">Prensa y Radio</h4>
                        <ul className="space-y-1.5">
                          <li><span className="font-semibold text-ap-primary">El Diario</span> (@Eldiario)</li>
                          <li><span className="font-semibold text-ap-primary">El Pais</span> (elpais.com)</li>
                          <li><span className="font-semibold text-ap-primary">La Mega y Circuito Exitos</span> (@exitos991 & @lamega967)</li>
                        </ul>
                      </div>

                      {/* Columna 3: Redes y Organizaciones */}
                      <div>
                        <h4 className="font-bold text-ap-primary mb-2 border-b border-ap-border pb-1">Redes y Organizaciones</h4>
                        <ul className="space-y-1.5">
                          <li><span className="font-semibold text-ap-primary">Coordinadores de apoyo:</span> @marielozadab, @nathaliesayago, @julietaosorior, @svenezolanista, @ecosistemag, @tonyfrangiem, @lole.zamudio.</li>
                          <li><span className="font-semibold text-ap-primary">ONGs y Brigadas:</span> @topos.mx, @fundacelismerida, @ceula_tachira, @distritojabana, @insiemeperilvenezuela, @asoevefas, @convzlaecuador.</li>
                          <li><span className="font-semibold text-ap-primary">Logistica:</span> wedenvios, Metabox Cargo (Houston).</li>
                        </ul>
                      </div>

                    </div>
                  </div>
                </details>
                <p>
                  <strong>Contactos por sectores para difusion y coordinacion:</strong> Ademas de los puntos de asistencia en el mapa, la plataforma cuenta con bases de datos de contactos para comunicaciones directas y alertas:
                </p>
                <ul className="list-disc pl-5 space-y-1 my-2">
                  <li><strong>Voluntarios interpretes registrados:</strong> {contactStats.interpretes} contactos.</li>
                  <li><strong>Representantes y contactos de centros de acopio:</strong> {contactStats.acopios} contactos.</li>
                </ul>
                <p>
                  <strong>Filtro de moderacion:</strong> Para evitar datos desactualizados, las sugerencias comunitarias ingresadas por el publico son revisadas y localizadas de forma manual antes de publicarse.
                </p>

                <div className="border border-ap-border rounded-xl bg-ap-surface/40 p-5 my-6">
                  <h3 className="text-[15px] font-bold text-ap-primary font-outfit mb-2">Verificacion cruzada de los centros</h3>
                  <p className="mb-3">
                    Para dar mayor garantia sobre la validez de cada punto, calculamos de forma automatica un nivel de verificacion que cruza <strong>cuantas fuentes independientes confirman un mismo centro</strong> y la completitud de sus datos (ubicacion precisa, contacto y horario). En el mapa y los listados, los centros se ordenan mostrando primero los mejor verificados, y cada uno lleva una insignia segun su nivel:
                  </p>
                  <ul className="space-y-2.5">
                    <li className="flex items-start gap-2.5">
                      <span className="shrink-0 w-[132px] mt-0.5">
                        <span className="inline-block text-[9px] font-extrabold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full whitespace-nowrap">★ Verificación Cruzada</span>
                      </span>
                      <span><strong>Confirmado por dos o mas fuentes independientes</strong> y con datos completos. Es el nivel de mayor confianza. El numero junto a la estrella indica cuantas fuentes coinciden.</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="shrink-0 w-[132px] mt-0.5">
                        <span className="inline-block text-[9px] font-bold text-sky-800 bg-sky-50 border border-sky-200 px-1.5 py-0.5 rounded-full whitespace-nowrap">✓ Verificado</span>
                      </span>
                      <span><strong>Confirmado por una fuente</strong> con datos suficientes (ubicacion precisa y/o contacto verificable).</span>
                    </li>
                  </ul>
                  <p className="mt-3 text-[13px] text-ap-muted">
                    El resto de los puntos se muestra como registro basico mientras se suman mas confirmaciones. Asi, mientras mas medios y miembros de la comunidad reportan un mismo centro, mayor es su nivel de verificacion.
                  </p>
                </div>
              </div>
            </section>

            {/* Seccion 4: Busqueda y Canales de Comunicacion */}
            <section id="comunicacion-busqueda" className="scroll-mt-20 border-t border-ap-border pt-10">
              <h2 className="text-[20px] md:text-[24px] font-extrabold text-ap-primary font-outfit">
                4. ¿Como funciona la busqueda consolidada y los canales de difusion?
              </h2>
              <div className="text-[15px] text-ap-secondary mt-4 space-y-3 leading-relaxed">
                <p>
                  AcopioVE integra canales de consulta web directa, directorios de emergencia y difusion automatizada para asegurar el acceso a informacion humanitaria en tiempo real:
                </p>
                <h3 className="font-bold text-ap-primary text-[15px] mt-4 font-outfit">Funcionalidades Principales</h3>
                <ul className="list-disc pl-5 space-y-2">
                  <li>
                    <strong>Buscador Consolidado de Personas (/busquedas):</strong> Cruza en memoria mas de 14 fuentes de personas desaparecidas, hospitalizadas y localizadas (SOS Venezuela, CIVIS, Venezuela Reporta, AVAPRE) sin almacenar datos sensibles en disco.
                  </li>
                  <li>
                    <strong>Geolocalizacion y Filtros por Insumo:</strong> Permite consultar acopios y refugios cercanos filtrando por lo que reciben prioritariamente (alimentos, agua, insumos medicos, ropa, herramientas).
                  </li>
                  <li>
                    <strong>Directorio Telefonico de Emergencia:</strong> 78 lineas directas con proteccion civil, Cruz Roja, bomberos y ambulancias organizadas por estado y region.
                  </li>
                  <li>
                    <strong>Canales de Difusion y Campañas:</strong> Sistema de difusion de avisos a coordinadores y voluntarios mediante plantillas verificadas (Kapso) y correo para alertas criticas.
                  </li>
                </ul>
                <h3 className="font-bold text-ap-primary text-[15px] mt-4 font-outfit">Privacidad y Salvaguardas de PII</h3>
                <p>
                  Para proteger la integridad de los afectados y colaboradores:
                </p>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li>Las cedulas de identidad se muestran siempre enmascaradas en todas las superficies publicas (ej: <code>V-12.***.***</code>).</li>
                  <li>Se omiten telefonos personales y coordenadas GPS exactas de personas vulnerables, y la ubicacion de menores de edad permanece suprimida por salvaguarda de proteccion.</li>
                  <li>Un gate anti-PII automatizado (<code>check:pii</code>) valida en cada despliegue que ninguna ruta exponga datos privados.</li>
                </ul>
              </div>
            </section>

            {/* Seccion 5 */}
            <section id="tecnologias-usamos" className="scroll-mt-20 border-t border-ap-border pt-10">
              <h2 className="text-[20px] md:text-[24px] font-extrabold text-ap-primary font-outfit">
                5. ¿Que tecnologias usamos? (Stack tecnologico)
              </h2>
              <div className="text-[15px] text-ap-secondary mt-4 space-y-3 leading-relaxed">
                <p>
                  La plataforma se rige por el uso de estandares web modernos y abiertos para garantizar solidez y velocidad:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-4">
                  <div className="border border-ap-border rounded-lg p-4 bg-ap-surface/20">
                    <h3 className="text-[14px] font-bold text-ap-primary font-outfit">Estructura Web</h3>
                    <p className="text-[13px] text-ap-secondary mt-1">
                      React y Next.js en su version mas reciente, configurado bajo TypeScript.
                    </p>
                  </div>
                  <div className="border border-ap-border rounded-lg p-4 bg-ap-surface/20">
                    <h3 className="text-[14px] font-bold text-ap-primary font-outfit">Base de Datos</h3>
                    <p className="text-[13px] text-ap-secondary mt-1">
                      PostgreSQL para el almacenamiento seguro y relacional de la informacion.
                    </p>
                  </div>
                  <div className="border border-ap-border rounded-lg p-4 bg-ap-surface/20">
                    <h3 className="text-[14px] font-bold text-ap-primary font-outfit">Diseno Visual</h3>
                    <p className="text-[13px] text-ap-secondary mt-1">
                      Tailwind CSS centrado en un diseno adaptativo de alta legibilidad.
                    </p>
                  </div>
                  <div className="border border-ap-border rounded-lg p-4 bg-ap-surface/20">
                    <h3 className="text-[14px] font-bold text-ap-primary font-outfit">Mapas</h3>
                    <p className="text-[13px] text-ap-secondary mt-1">
                      Visualizaciones cartograficas soportadas mediante Leaflet.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Seccion 6 */}
            <section id="capacidad-actual" className="scroll-mt-20 border-t border-ap-border pt-10">
              <h2 className="text-[20px] md:text-[24px] font-extrabold text-ap-primary font-outfit">
                6. ¿Que capacidad tiene la plataforma?
              </h2>
              <div className="text-[15px] text-ap-secondary mt-4 space-y-3 leading-relaxed">
                <ul className="list-disc pl-5 space-y-2">
                  <li>
                    <strong>Capacidad de Trafico:</strong> La aplicacion esta configurada para procesar mas de 1500 solicitudes concurrentes por segundo y sostener de forma fluida a mas de 90000 usuarios activos por hora gracias al almacenamiento de cache y optimizacion en la transferencia de datos.
                  </li>
                  <li>
                    <strong>Accesibilidad Universal:</strong> Cumplimos estrictamente las directrices de accesibilidad WCAG, asegurando el correcto funcionamiento con lectores de pantalla y navegacion por teclado.
                  </li>
                  <li>
                    <strong>Optimización de Carga:</strong> Reduccion activa del tamano de los scripts del navegador para acelerar la carga en conexiones mobiles lentas.
                  </li>
                </ul>
              </div>
            </section>

            {/* Seccion 7 */}
            <section id="ampliar-capacidad" className="scroll-mt-20 border-t border-ap-border pt-10">
              <h2 className="text-[20px] md:text-[24px] font-extrabold text-ap-primary font-outfit">
                7. ¿Que necesitamos para ampliar la capacidad?
              </h2>
              <div className="text-[15px] text-ap-secondary mt-4 space-y-3 leading-relaxed">
                <p>
                  Para escalar la operacion durante picos maximos de trafico e incrementar la cobertura de datos, los requisitos de escalabilidad de la plataforma contemplan:
                </p>
                <ol className="list-decimal pl-5 space-y-3">
                  <li>
                    <strong>Escalabilidad de Servidor e Infraestructura:</strong> Ampliacion de los recursos de hardware (nucleos de procesamiento y memoria RAM del servidor) junto con un mayor ancho de banda de red para procesar y servir mapas y consultas sin latencia.
                  </li>
                  <li>
                    <strong>Redes de Distribucion Global (CDN):</strong> Habilitacion de capas avanzadas de almacenamiento en cache distribuido (CDN Edge Caching) para absorber las consultas recurrentes de imagenes de mapas y solicitudes de APIs en servidores de borde, optimizando la velocidad del usuario final.
                  </li>
                  <li>
                    <strong>Optimizacion y Redundancia de Base de Datos:</strong> Configuracion de instancias de base de datos de alto rendimiento con limites de conexion simultanea expandidos y sistemas de replicas para garantizar la redundancia de los registros en tiempo real.
                  </li>
                </ol>
              </div>
            </section>

            {/* Seccion 8 */}
            <section id="venimos-trabajando" className="scroll-mt-20 border-t border-ap-border pt-10">
              <h2 className="text-[20px] md:text-[24px] font-extrabold text-ap-primary font-outfit">
                8. ¿En que venimos trabajando?
              </h2>
              <div className="text-[15px] text-ap-secondary mt-4 space-y-3 leading-relaxed">
                <ul className="list-disc pl-5 space-y-2">
                  <li>
                    <strong>Centralizacion y Recopilacion:</strong> Sistematizacion constante de reportes sobre el terreno cruzando multiples fuentes locales para mantener la veracidad de los datos.
                  </li>
                  <li>
                    <strong>Desarrollo de Medios de Comunicacion:</strong> Creacion de plantillas y formatos especificos de difusion adaptados para redes comunitarias.
                  </li>
                  <li>
                    <strong>Listas de Distribucion:</strong> Creacion de listas de alerta y notificacion rapida por canales de mensajeria instantanea y correo para coordinar y avisar a los equipos de apoyo sobre cambios de estado criticos.
                  </li>
                </ul>
              </div>
            </section>

            {/* Seccion 9 */}
            <section id="grandes-retos" className="scroll-mt-20 border-t border-ap-border pt-10">
              <h2 className="text-[20px] md:text-[24px] font-extrabold text-ap-primary font-outfit">
                9. Propuestas para los grandes retos actuales
              </h2>
              <div className="text-[15px] text-ap-secondary mt-4 space-y-6 leading-relaxed">
                
                <div className="border-l-4 border-ap-border pl-4">
                  <h3 className="text-[16px] font-bold text-ap-primary font-outfit">
                    Reto A: Distribucion de Ayuda Humanitaria y Canalizacion de Donaciones Financieras
                  </h3>
                  <p className="text-[14px] text-ap-secondary mt-2">
                    La ayuda fisica recolectada en centros de acopio nacionales e internacionales suele estancarse por falta de coordinacion de transporte hacia las regiones afectadas. Por otro lado, las donaciones monetarias a traves de canales complejos pueden tardar en procesarse, impidiendo la adquisicion inmediata de recursos vitales (agua, comida, herramientas) a nivel local de forma agil.
                  </p>
                </div>

                <div className="border-l-4 border-ap-border pl-4">
                  <h3 className="text-[16px] font-bold text-ap-primary font-outfit">
                    Reto B: Coordinacion Logistica de Maquinaria Pesada y Remocion de Escombros
                  </h3>
                  <p className="text-[14px] text-ap-secondary mt-2">
                    La remocion de escombros es una cuestion logistica critica para abrir paso a la ayuda humanitaria. Actualmente, no hay informacion publica sobre cuales lugares necesitan ayuda urgente con remocion, ni como conectar maquinarias y operadores disponibles con las necesidades en el terreno, asi como costear los gastos operativos y de combustible de estos servicios. Se necesitarian mecanismos que permitan desplegar esta logistica directamente en los lugares donde se necesiten.
                  </p>
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
