import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq, desc } from 'drizzle-orm';
import { db } from '@/db';
import { centros } from '@/db/schema';
import { slugify } from '@/lib/centros';
import CentrosSearchClient from '../CentrosSearchClient';

export const revalidate = 60; // Refrescar caché en background cada 60 s (ISR)

type Row = {
  name: string;
  address: string | null;
  recibe: unknown;
  estado: string;
  tipo: string;
  pais: string | null;
  ciudad: string | null;
  latitude: string | null;
  longitude: string | null;
  contacto: string | null;
  horario: string | null;
  fuente: string | null;
};

function calculateVerification(c: any) {
  const fuentes = c.fuente || '';
  const sources = fuentes.split(/·|&|,/g).map((s: string) => s.trim()).filter(Boolean);
  const sourceCount = Math.max(1, sources.length);

  let score = 0;
  const isDefaultCaracas = (Math.abs(Number(c.latitude) - 10.4880) < 0.01 && Math.abs(Number(c.longitude) - -66.9350) < 0.01);
  if (c.latitude && c.longitude && !isDefaultCaracas) {
    score += 2;
  }
  if (c.contacto && c.contacto.length > 5 && !c.contacto.toLowerCase().includes('sin telefono')) {
    score += 1;
  }
  if (c.horario && !c.horario.toLowerCase().includes('contingencia')) {
    score += 1;
  }

  const finalScore = sourceCount * 2 + score;
  let tier: 'high' | 'medium' | 'basic' = 'basic';
  if (sourceCount >= 2 && finalScore >= 6) {
    tier = 'high';
  } else if (sourceCount >= 1 && finalScore >= 4) {
    tier = 'medium';
  }

  return { score: finalScore, tier, sourceCount };
}

interface PageProps {
  params: Promise<{ params?: string[] }>;
}

// 1. GENERACIÓN DINÁMICA DE METADATA (SEO)
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const pList = resolvedParams.params || [];

  const rows = (await db
    .select({ pais: centros.pais, ciudad: centros.ciudad })
    .from(centros)
    .where(eq(centros.active, true))) as { pais: string | null; ciudad: string | null }[];

  const defaultMeta = {
    title: 'Listado de centros de acopio por ciudad',
    description:
      'Directorio completo de centros de acopio y refugios en Venezuela y la diáspora, organizado por país y ciudad. Encontrá dónde donar alimentos, agua, medicinas y ropa.',
    alternates: { canonical: 'https://acopiove.org/centros' },
  };

  if (pList.length === 0) {
    return defaultMeta;
  }

  const paisSlug = pList[0];
  const matchedPaisRow = rows.find((r) => r.pais && slugify(r.pais) === paisSlug);
  if (!matchedPaisRow || !matchedPaisRow.pais) {
    return { title: 'Página no encontrada' };
  }

  const paisName = matchedPaisRow.pais;

  if (pList.length === 1) {
    return {
      title: `Centros de acopio en ${paisName}`,
      description: `Directorio completo de centros de acopio y refugios en ${paisName}. Encuentra los puntos de recolección para donar alimentos, agua, medicinas y ropa.`,
      alternates: { canonical: `https://acopiove.org/centros/${paisSlug}` },
    };
  }

  if (pList.length === 2) {
    const ciudadSlug = pList[1];
    const matchedCiudadRow = rows.find(
      (r) => r.pais && slugify(r.pais) === paisSlug && r.ciudad && slugify(r.ciudad) === ciudadSlug
    );
    if (!matchedCiudadRow || !matchedCiudadRow.ciudad) {
      return { title: 'Página no encontrada' };
    }
    const ciudadName = matchedCiudadRow.ciudad;

    return {
      title: `Centros de acopio en ${ciudadName}, ${paisName}`,
      description: `Lista actualizada de centros de acopio y refugios en ${ciudadName}, ${paisName}. Dónde llevar donaciones y ayuda para la emergencia de Venezuela.`,
      alternates: { canonical: `https://acopiove.org/centros/${paisSlug}/${ciudadSlug}` },
    };
  }

  return { title: 'Página no encontrada' };
}

// Componente para migas de pan (Breadcrumbs)
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

// 2. COMPONENTE PRINCIPAL DE LA PÁGINA
export default async function CentrosPage({ params }: PageProps) {
  const resolvedParams = await params;
  const pList = resolvedParams.params || [];

  if (pList.length > 2) {
    notFound();
  }

  // Obtener todos los centros activos
  const rows = (await db
    .select({
      name: centros.name,
      address: centros.address,
      recibe: centros.recibe,
      estado: centros.estado,
      tipo: centros.tipo,
      pais: centros.pais,
      ciudad: centros.ciudad,
      latitude: centros.latitude,
      longitude: centros.longitude,
      contacto: centros.contacto,
      horario: centros.horario,
      fuente: centros.fuente,
    })
    .from(centros)
    .where(eq(centros.active, true))
    .orderBy(desc(centros.createdAt))) as Row[];

  // Agrupar datos en memoria para procesar slugs de forma robusta
  const mappedRows = rows.map((r) => ({
    ...r,
    paisName: r.pais || 'Otros',
    ciudadName: r.ciudad || 'Sin ciudad',
    paisSlug: r.pais ? slugify(r.pais) : 'otros',
    ciudadSlug: r.ciudad ? slugify(r.ciudad) : 'sin-ciudad',
    verification: calculateVerification(r),
  }));

  // --- CASO 0: LISTADO GENERAL (/centros) ---
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
            Centros de acopio por ciudad
          </h1>
          <p className="text-[14px] text-ap-secondary mt-2 max-w-2xl leading-relaxed">
            Directorio completo de <strong>{rows.length}</strong> centros de acopio y refugios organizados por ubicación geográfica. Selecciona una ciudad o país para ver la información detallada y explorarlos en el mapa interactivo.
          </p>

          <CentrosSearchClient
            tipoVista="general"
            byPais={byPais as any}
            paisesList={paises}
          />
        </div>
      </main>
    );
  }

  const paisSlug = pList[0];
  const matchedPais = mappedRows.find((r) => r.paisSlug === paisSlug);
  if (!matchedPais) {
    notFound();
  }
  const paisName = matchedPais.paisName;

  // --- CASO 1: VISTA DE PAÍS (/centros/[pais]) ---
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
          <Breadcrumbs
            items={[
              { label: 'Inicio', href: '/' },
              { label: 'Centros', href: '/centros' },
              { label: paisName },
            ]}
          />

          <h1 className="text-[26px] md:text-[32px] font-extrabold text-ap-primary font-outfit">
            Centros de acopio en {paisName}
          </h1>
          <p className="text-[14px] text-ap-secondary mt-2 mb-6 max-w-2xl leading-relaxed">
            Se encontraron <strong>{paisCenters.length}</strong> centros de acopio activos en {paisName} repartidos en {ciudades.length} ciudad(es).
          </p>

          {/* Banner de mapa interactivo */}
          <div className="bg-gradient-to-br from-ap-primary to-ap-secondary text-white p-5 rounded-2xl shadow-md mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-outfit font-extrabold text-[16px] md:text-[17px] flex items-center gap-1.5">
                ¿Prefieres verlos en el mapa?
              </h3>
              <p className="text-[12.5px] text-white/80 mt-1">
                Visualiza la ubicación geográfica exacta de todos los centros de {paisName}.
              </p>
            </div>
            <Link
              href={`/?pais=${encodeURIComponent(paisName)}`}
              className="bg-white text-ap-primary hover:bg-ap-surface-hover font-bold text-[12.5px] px-5 py-2.5 rounded-xl transition-all text-center shrink-0 active:scale-95 shadow-sm"
            >
              Explorar mapa de {paisName}
            </Link>
          </div>

          <CentrosSearchClient
            tipoVista="pais"
            paisSlug={paisSlug}
            paisName={paisName}
            byCiudad={byCiudad as any}
            ciudadesList={ciudades}
            totalCentrosPais={paisCenters.length}
          />
        </div>
      </main>
    );
  }

  const ciudadSlug = pList[1];
  const matchedCiudad = mappedRows.find(
    (r) => r.paisSlug === paisSlug && r.ciudadSlug === ciudadSlug
  );
  if (!matchedCiudad) {
    notFound();
  }
  const ciudadName = matchedCiudad.ciudadName;

  // --- CASO 2: VISTA DE CIUDAD (/centros/[pais]/[ciudad]) ---
  const ciudadCenters = mappedRows
    .filter((r) => r.paisSlug === paisSlug && r.ciudadSlug === ciudadSlug)
    .sort((a, b) => b.verification.score - a.verification.score);

  return (
    <main id="main-content" className="min-h-[100dvh] bg-ap-bg font-sans">
      <div className="max-w-[860px] mx-auto px-4 py-8">
        <Breadcrumbs
          items={[
            { label: 'Inicio', href: '/' },
            { label: 'Centros', href: '/centros' },
            { label: paisName, href: `/centros/${paisSlug}` },
            { label: ciudadName },
          ]}
        />

        <h1 className="text-[26px] md:text-[32px] font-extrabold text-ap-primary font-outfit">
          Centros de acopio en {ciudadName}
        </h1>
        <p className="text-[14px] text-ap-secondary mt-2 mb-6 max-w-2xl leading-relaxed">
          Lista actualizada de los <strong>{ciudadCenters.length}</strong> centros de acopio y ayuda humanitaria activos en {ciudadName}, {paisName}.
        </p>

        {/* Banner de mapa interactivo */}
        <div className="bg-gradient-to-br from-ap-primary to-ap-secondary text-white p-5 rounded-2xl shadow-md mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-outfit font-extrabold text-[16px] md:text-[17px] flex items-center gap-1.5">
              ¿Prefieres verlos en el mapa?
            </h3>
            <p className="text-[12.5px] text-white/80 mt-1">
              Mira exactamente dónde están ubicados estos centros y obtén indicaciones en el mapa en tiempo real.
            </p>
          </div>
          <Link
            href={`/?pais=${encodeURIComponent(paisName)}&ciudad=${encodeURIComponent(ciudadName)}`}
            className="bg-white text-ap-primary hover:bg-ap-surface-hover font-bold text-[12.5px] px-5 py-2.5 rounded-xl transition-all text-center shrink-0 active:scale-95 shadow-sm"
          >
            Ver en el mapa interactivo
          </Link>
        </div>

        <CentrosSearchClient
          tipoVista="ciudad"
          paisSlug={paisSlug}
          paisName={paisName}
          ciudadSlug={ciudadSlug}
          ciudadName={ciudadName}
          ciudadCenters={ciudadCenters as any}
        />
      </div>
    </main>
  );
}
