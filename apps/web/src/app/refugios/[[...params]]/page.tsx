import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { and, eq, desc } from 'drizzle-orm';
import { db } from '@/db';
import { centros } from '@/db/schema';
import { slugify } from '@/lib/centros';

export const revalidate = 300; // ISR: refresca en background cada 5 min

type Row = {
  name: string;
  address: string | null;
  estado: string;
  pais: string | null;
  ciudad: string | null;
};

interface PageProps {
  params: Promise<{ params?: string[] }>;
}

const onlyRefugios = and(eq(centros.active, true), eq(centros.tipo, 'refugio'));

// 1. METADATA DINÁMICA (SEO) — intención específica de refugios
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const pList = resolvedParams.params || [];

  const rows = (await db
    .select({ pais: centros.pais, ciudad: centros.ciudad })
    .from(centros)
    .where(onlyRefugios)) as { pais: string | null; ciudad: string | null }[];

  const defaultMeta: Metadata = {
    title: 'Refugios habilitados por ciudad',
    description:
      'Directorio de refugios habilitados y puntos de resguardo en Venezuela y la diáspora, organizados por ciudad. Encontrá dónde resguardarte tras la emergencia.',
    alternates: { canonical: 'https://acopiove.org/refugios' },
  };

  if (pList.length === 0) return defaultMeta;

  const paisSlug = pList[0];
  const matchedPaisRow = rows.find((r) => r.pais && slugify(r.pais) === paisSlug);
  if (!matchedPaisRow || !matchedPaisRow.pais) return { title: 'Página no encontrada' };
  const paisName = matchedPaisRow.pais;

  if (pList.length === 1) {
    return {
      title: `Refugios habilitados en ${paisName}`,
      description: `Listado actualizado de refugios habilitados y puntos de resguardo en ${paisName}. Dónde refugiarse y encontrar apoyo durante la emergencia.`,
      alternates: { canonical: `https://acopiove.org/refugios/${paisSlug}` },
    };
  }

  if (pList.length === 2) {
    const ciudadSlug = pList[1];
    const matchedCiudadRow = rows.find(
      (r) => r.pais && slugify(r.pais) === paisSlug && r.ciudad && slugify(r.ciudad) === ciudadSlug
    );
    if (!matchedCiudadRow || !matchedCiudadRow.ciudad) return { title: 'Página no encontrada' };
    const ciudadName = matchedCiudadRow.ciudad;

    return {
      title: `Refugios habilitados en ${ciudadName}, ${paisName}`,
      description: `Refugios habilitados y puntos de resguardo en ${ciudadName}, ${paisName}. Ubicaciones actualizadas para refugiarse durante la emergencia.`,
      alternates: { canonical: `https://acopiove.org/refugios/${paisSlug}/${ciudadSlug}` },
    };
  }

  return { title: 'Página no encontrada' };
}

function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav className="flex items-center gap-1.5 text-[12px] font-semibold text-ap-muted mb-5">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-ap-secondary/30">/</span>}
          {item.href ? (
            <Link href={item.href} className="hover:text-ap-primary transition-colors">
              {item.label}
            </Link>
          ) : (
            <span className="text-ap-secondary">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

function estadoColor(estado: string): string {
  return estado === 'abierto' ? '#059669' : estado === 'lleno' ? '#d97706' : '#ef4444';
}

// 2. PÁGINA
export default async function RefugiosPage({ params }: PageProps) {
  const resolvedParams = await params;
  const pList = resolvedParams.params || [];

  if (pList.length > 2) notFound();

  const rows = (await db
    .select({
      name: centros.name,
      address: centros.address,
      estado: centros.estado,
      pais: centros.pais,
      ciudad: centros.ciudad,
    })
    .from(centros)
    .where(onlyRefugios)
    .orderBy(desc(centros.createdAt))) as Row[];

  const mappedRows = rows.map((r) => ({
    ...r,
    paisName: r.pais || 'Otros',
    ciudadName: r.ciudad || 'Sin ciudad',
    paisSlug: r.pais ? slugify(r.pais) : 'otros',
    ciudadSlug: r.ciudad ? slugify(r.ciudad) : 'sin-ciudad',
  }));

  // --- CASO 0: LISTADO GENERAL (/refugios) ---
  if (pList.length === 0) {
    const byPais: Record<string, { slug: string; ciudades: Record<string, { slug: string; list: typeof mappedRows }> }> = {};
    for (const r of mappedRows) {
      const pGroup = (byPais[r.paisName] ||= { slug: r.paisSlug, ciudades: {} });
      const cGroup = (pGroup.ciudades[r.ciudadName] ||= { slug: r.ciudadSlug, list: [] });
      cGroup.list.push(r);
    }
    const paises = Object.keys(byPais).sort();

    return (
      <main id="main-content" className="min-h-[100dvh] bg-ap-bg font-sans">
        <div className="max-w-[860px] mx-auto px-4 py-8">
          <Link href="/acopio" className="text-[13px] font-semibold text-ap-secondary hover:underline">
            ← Volver al mapa
          </Link>
          <h1 className="text-[26px] md:text-[32px] font-extrabold text-ap-primary font-outfit mt-4">
            Refugios habilitados por ciudad
          </h1>
          <p className="text-[14px] text-ap-secondary mt-2 max-w-2xl leading-relaxed">
            Directorio de <strong>{rows.length}</strong> refugios habilitados y puntos de resguardo organizados por ubicación. Seleccioná una ciudad o país para ver el detalle y explorarlos en el mapa interactivo.
          </p>

          {rows.length === 0 && (
            <p className="text-[14px] text-ap-muted mt-8">Todavía no hay refugios cargados.</p>
          )}

          <div className="mt-8 space-y-6">
            {paises.map((pais) => {
              const pInfo = byPais[pais];
              const ciudades = Object.keys(pInfo.ciudades).sort();
              const totalPais = ciudades.reduce((acc, c) => acc + pInfo.ciudades[c].list.length, 0);
              return (
                <section key={pais} className="bg-ap-surface border border-ap-border rounded-2xl p-5 shadow-sm">
                  <h2 className="text-[18px] font-extrabold text-ap-primary font-outfit border-b border-ap-border/50 pb-2 flex justify-between items-center">
                    <span>{pais}</span>
                    <Link href={`/refugios/${pInfo.slug}`} className="text-[12px] font-semibold text-ap-secondary hover:text-ap-primary hover:underline">
                      Ver todo el país ({totalPais})
                    </Link>
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mt-4">
                    {ciudades.map((ciudad) => {
                      const cInfo = pInfo.ciudades[ciudad];
                      return (
                        <Link
                          key={ciudad}
                          href={`/refugios/${pInfo.slug}/${cInfo.slug}`}
                          className="flex items-center justify-between p-3 rounded-xl border border-ap-border hover:border-ap-muted bg-ap-bg/30 hover:bg-ap-surface-hover transition-all"
                        >
                          <span className="text-[13px] font-bold text-ap-secondary">{ciudad}</span>
                          <span className="text-[11px] font-semibold text-ap-muted bg-ap-bg px-2 py-0.5 rounded-full">
                            {cInfo.list.length}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      </main>
    );
  }

  const paisSlug = pList[0];
  const matchedPais = mappedRows.find((r) => r.paisSlug === paisSlug);
  if (!matchedPais) notFound();
  const paisName = matchedPais.paisName;

  // --- CASO 1: VISTA DE PAÍS ---
  if (pList.length === 1) {
    const paisCenters = mappedRows.filter((r) => r.paisSlug === paisSlug);
    const byCiudad: Record<string, { slug: string; list: typeof mappedRows }> = {};
    for (const r of paisCenters) {
      const cGroup = (byCiudad[r.ciudadName] ||= { slug: r.ciudadSlug, list: [] });
      cGroup.list.push(r);
    }
    const ciudades = Object.keys(byCiudad).sort();

    return (
      <main id="main-content" className="min-h-[100dvh] bg-ap-bg font-sans">
        <div className="max-w-[860px] mx-auto px-4 py-8">
          <Breadcrumbs items={[{ label: 'Inicio', href: '/' }, { label: 'Refugios', href: '/refugios' }, { label: paisName }]} />

          <h1 className="text-[26px] md:text-[32px] font-extrabold text-ap-primary font-outfit">
            Refugios habilitados en {paisName}
          </h1>
          <p className="text-[14px] text-ap-secondary mt-2 mb-6 max-w-2xl leading-relaxed">
            Se encontraron <strong>{paisCenters.length}</strong> refugios habilitados en {paisName} repartidos en {ciudades.length} ciudad(es).
          </p>

          <div className="bg-gradient-to-br from-ap-primary to-ap-secondary text-white p-5 rounded-2xl shadow-md mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-outfit font-extrabold text-[16px] md:text-[17px]">¿Preferís verlos en el mapa?</h3>
              <p className="text-[12.5px] text-white/80 mt-1">Visualizá la ubicación exacta de los refugios de {paisName}.</p>
            </div>
            <Link
              href={`/?tipo=refugio&pais=${encodeURIComponent(paisName)}`}
              className="bg-white text-ap-primary hover:bg-ap-surface-hover font-bold text-[12.5px] px-5 py-2.5 rounded-xl transition-all text-center shrink-0 active:scale-95 shadow-sm"
            >
              Explorar mapa de refugios
            </Link>
          </div>

          <div className="space-y-6">
            {ciudades.map((ciudad) => {
              const cInfo = byCiudad[ciudad];
              return (
                <section key={ciudad} className="bg-ap-surface border border-ap-border rounded-2xl p-5 shadow-sm">
                  <h2 className="text-[16px] font-extrabold text-ap-primary font-outfit border-b border-ap-border/50 pb-2 flex justify-between items-center">
                    <span>{ciudad}</span>
                    <Link href={`/refugios/${paisSlug}/${cInfo.slug}`} className="text-[11.5px] font-bold text-ap-primary/80 hover:text-ap-primary hover:underline">
                      Ver solo {ciudad} ({cInfo.list.length})
                    </Link>
                  </h2>
                  <ul className="mt-4 divide-y divide-ap-border/50">
                    {cInfo.list.map((c, i) => (
                      <li key={i} className="py-3 text-[13px] first:pt-0 last:pb-0">
                        <div className="flex items-start justify-between gap-3">
                          <span className="font-bold text-ap-primary">{c.name}</span>
                          <span className="shrink-0 inline-flex items-center gap-1.5 text-[11px] font-bold capitalize" style={{ color: estadoColor(c.estado) }}>
                            <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: estadoColor(c.estado) }} />
                            {c.estado}
                          </span>
                        </div>
                        {c.address && <p className="text-ap-secondary mt-0.5 text-[12.5px]">{c.address}</p>}
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        </div>
      </main>
    );
  }

  const ciudadSlug = pList[1];
  const matchedCiudad = mappedRows.find((r) => r.paisSlug === paisSlug && r.ciudadSlug === ciudadSlug);
  if (!matchedCiudad) notFound();
  const ciudadName = matchedCiudad.ciudadName;

  // --- CASO 2: VISTA DE CIUDAD ---
  const ciudadCenters = mappedRows.filter((r) => r.paisSlug === paisSlug && r.ciudadSlug === ciudadSlug);

  return (
    <main id="main-content" className="min-h-[100dvh] bg-ap-bg font-sans">
      <div className="max-w-[860px] mx-auto px-4 py-8">
        <Breadcrumbs
          items={[
            { label: 'Inicio', href: '/' },
            { label: 'Refugios', href: '/refugios' },
            { label: paisName, href: `/refugios/${paisSlug}` },
            { label: ciudadName },
          ]}
        />

        <h1 className="text-[26px] md:text-[32px] font-extrabold text-ap-primary font-outfit">
          Refugios habilitados en {ciudadName}
        </h1>
        <p className="text-[14px] text-ap-secondary mt-2 mb-6 max-w-2xl leading-relaxed">
          Listado actualizado de los <strong>{ciudadCenters.length}</strong> refugios habilitados y puntos de resguardo en {ciudadName}, {paisName}.
        </p>

        <div className="bg-gradient-to-br from-ap-primary to-ap-secondary text-white p-5 rounded-2xl shadow-md mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-outfit font-extrabold text-[16px] md:text-[17px]">¿Preferís verlos en el mapa?</h3>
            <p className="text-[12.5px] text-white/80 mt-1">Mirá exactamente dónde están estos refugios y cómo llegar.</p>
          </div>
          <Link
            href={`/?tipo=refugio&pais=${encodeURIComponent(paisName)}&ciudad=${encodeURIComponent(ciudadName)}`}
            className="bg-white text-ap-primary hover:bg-ap-surface-hover font-bold text-[12.5px] px-5 py-2.5 rounded-xl transition-all text-center shrink-0 active:scale-95 shadow-sm"
          >
            Ver en el mapa interactivo
          </Link>
        </div>

        <div className="space-y-4">
          {ciudadCenters.map((c, i) => (
            <div key={i} className="bg-ap-surface border border-ap-border rounded-2xl p-5 shadow-sm hover:border-ap-muted transition-colors">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-[16px] font-bold text-ap-primary font-outfit leading-snug">{c.name}</h2>
                <span className="shrink-0 inline-flex items-center gap-1.5 text-[11px] font-extrabold capitalize" style={{ color: estadoColor(c.estado) }}>
                  <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: estadoColor(c.estado) }} />
                  {c.estado}
                </span>
              </div>
              {c.address && <p className="text-[13px] text-ap-secondary mt-1">{c.address}</p>}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
