// Endpoint consolidado de la vista /busqueda-avanzada. AISLADO: compone
// nuestra data core (buildPuntos), el agregador de personas existente
// (/api/personas, sin modificarlo) y Venezuela Reporta. Aplica aquí la
// conciliación (fusión + "confirmado por N fuentes"). NO toca /api/personas
// ni la API pública /v1.
//
// Carga inicial (mode=map): solo sitios con coordenadas — liviano para mapa.
// Conteos del índice completo (mode=stats): cacheados en servidor, sin enviar fichas.

import { NextResponse } from 'next/server';
import { blockedFor, hit, clientIp } from '@/lib/ratelimit';
import { normalizeSearchText } from '@/lib/text';
import { buildPuntos } from '@/lib/api/puntos';
import { fetchVrSitios, fetchVrPersonas } from '@/lib/busqueda-avanzada/venezuelareporta';
import type { Entidad, EntidadTipo, EntidadClase, OrigenCapa } from '@/lib/busqueda-avanzada/types';

export const dynamic = 'force-dynamic';

const BROWSE_TTL_MS = 60 * 1000;

type IndexMeta = {
  total: number;
  con_coordenadas: number;
  confirmados_multi_fuente: number;
  por_clase: Record<string, number>;
  por_tipo: Record<string, number>;
  por_origen: Record<string, number>;
  top_lugares: { lugar: string; n: number }[];
};

// El browse arma el índice entero (DB + 11 fuentes externas): caro en frío y el
// mismo para todos. Se comparte entre peticiones concurrentes y se refresca cada
// minuto, igual que el `revalidate` de las fuentes que consume.
let browseCache: { data: Entidad[]; expires: number } | null = null;
let browseInflight: Promise<Entidad[]> | null = null;

/** Evita loopback vía Cloudflare cuando `request.url` usa Host público (acopiove.org). */
function internalAppOrigin(): string {
  if (process.env.INTERNAL_APP_ORIGIN) return process.env.INTERNAL_APP_ORIGIN.replace(/\/$/, '');
  const port = process.env.PORT || '4100';
  return `http://127.0.0.1:${port}`;
}

const CORE_ORIGEN: Record<string, OrigenCapa> = {
  acopio: 'core_acopio',
  refugio: 'core_refugio',
  salud: 'core_salud',
  telefono: 'core_telefono',
};

// --- Mapeo de PuntoDTO (nuestra data core) a Entidad ---
function puntoToEntidad(p: any): Entidad {
  const tipo: EntidadTipo =
    p.tipo === 'refugio' ? 'refugio' : p.tipo === 'salud' ? 'salud' : p.tipo === 'telefono' ? 'telefono' : 'acopio';
  const clase: EntidadClase = 'sitio';
  const cats = Array.isArray(p.categorias) ? p.categorias : [];
  return {
    id: `core-${p.id}`,
    nombre: p.nombre,
    tipo,
    clase,
    origen: CORE_ORIGEN[tipo],
    status: p.estado || null,
    lugar: [p.ciudad, p.pais].filter(Boolean).join(', ') || null,
    observaciones: p.descripcion || (cats.length ? `Recibe: ${cats.join(', ')}` : null),
    cedula: null,
    foto: null,
    categorias: cats,
    telefono: p.telefono || null,
    fuente: p.fuente || 'AcopioVE',
    fuentes: [p.fuente || 'AcopioVE'],
    confianza: 1,
    fuente_url: p.fuente_url || null,
    ficha_url: null,
    lat: p.lat ?? null,
    lng: p.lng ?? null,
    fecha: p.actualizado_en || null,
  };
}

// --- Mapeo de un item de /api/personas a Entidad ---
function personItemToEntidad(p: any): Entidad {
  const t = p.tipo as string;
  let tipo: EntidadTipo;
  let clase: EntidadClase;
  if (t === 'reporte_ve') {
    tipo = 'servicio';
    clase = 'reporte';
  } else if (t === 'danos') {
    tipo = 'dano';
    clase = 'reporte';
  } else if (t === 'insumos' || t === 'demano') {
    tipo = 'necesidad';
    clase = 'reporte';
  } else if (t === 'hub' && (p.category === 'solicitud' || p.category === 'oferta')) {
    tipo = 'necesidad';
    clase = 'reporte';
  } else {
    tipo = 'persona';
    clase = 'persona';
  }
  const fuentes: string[] = Array.isArray(p.fuentes) && p.fuentes.length ? p.fuentes : [p.fuente];
  return {
    id: `per-${p.id}`,
    nombre: p.nombre,
    tipo,
    clase,
    origen: t as OrigenCapa,
    status: p.status || null,
    lugar: p.lugar || null,
    observaciones: p.observaciones || null,
    cedula: p.cedula || null,
    foto: null, // fotos Supabase (Venezuela Ayuda) con errores frecuentes — omitidas
    categorias: [],
    telefono: null,
    fuente: p.fuente,
    fuentes,
    confianza: fuentes.length,
    fuente_url: null,
    ficha_url: null,
    lat: p.lat ?? null,
    lng: p.lng ?? null,
    fecha: p.fecha || null,
    category: p.category || (tipo === 'persona' ? p.tipo : undefined),
  };
}

// Clave de conciliación de personas. La fusión solo debe ocurrir cuando hay
// evidencia FUERTE de que dos fichas son la misma persona; de lo contrario se
// mezclarían homónimos distintos (nombres venezolanos comunes) inflando el
// "confirmado por N fuentes" y juntando PII de personas distintas.
//   1) Cédula completa (>=6 dígitos, sin enmascarar): señal fuerte -> fusiona.
//   2) Nombre de 2+ tokens + lugar corroborante: fusiona solo si coinciden ambos.
//   3) Nombre solo / cédula parcial: NO fusiona (se mantiene como ficha separada).
function personaKey(e: Entidad): string | null {
  if (e.cedula && !e.cedula.includes('*')) {
    const c = e.cedula.replace(/[^0-9]/g, '');
    if (c.length >= 6) return `ced-${c}`;
  }
  const n = normalizeSearchText(e.nombre || '').replace(/[^a-z0-9 ]/g, ' ').trim();
  const tokens = n.split(/\s+/).filter((t) => t.length > 1);
  if (tokens.length >= 2 && e.lugar) {
    const lug = normalizeSearchText(e.lugar).replace(/[^a-z0-9]/g, '');
    if (lug.length >= 4) return `name-${tokens.join('')}-${lug.slice(0, 14)}`;
  }
  return null;
}

/** Semilla del desglose por fuente (idempotente) para auditar la conciliación. */
function seedDetalle(e: Entidad) {
  if (!e.fuentes_detalle) {
    e.fuentes_detalle = [{ fuente: e.fuente, ficha_url: e.ficha_url, fuente_url: e.fuente_url }];
  }
}
function pushDetalle(a: Entidad, b: Entidad) {
  seedDetalle(a);
  const entrada = { fuente: b.fuente, ficha_url: b.ficha_url, fuente_url: b.fuente_url };
  if (!a.fuentes_detalle!.some((d) => d.fuente === entrada.fuente && d.ficha_url === entrada.ficha_url)) {
    a.fuentes_detalle!.push(entrada);
  }
}

function mergePersona(a: Entidad, b: Entidad) {
  pushDetalle(a, b);
  for (const f of b.fuentes) if (!a.fuentes.includes(f)) a.fuentes.push(f);
  a.confianza = a.fuentes.length;
  a.fuente = a.fuentes.join(' + ');
  if (b.nombre && b.nombre.length > a.nombre.length) a.nombre = b.nombre;
  if (b.cedula && (!a.cedula || (a.cedula.includes('*') && !b.cedula.includes('*')))) a.cedula = b.cedula;
  if (!a.foto && b.foto) a.foto = b.foto;
  if (a.lat == null && b.lat != null) { a.lat = b.lat; a.lng = b.lng; }
  if (!a.ficha_url && b.ficha_url) a.ficha_url = b.ficha_url;
  if (b.observaciones && b.observaciones !== a.observaciones) {
    a.observaciones = [a.observaciones, `[${b.fuente}]: ${b.observaciones}`].filter(Boolean).join(' · ');
  }
  if (b.fecha && (!a.fecha || b.fecha > a.fecha)) a.fecha = b.fecha;
}

function sitioKey(e: Entidad): string {
  const n = normalizeSearchText(e.nombre || '').replace(/[^a-z0-9]/g, '');
  const la = e.lat != null ? e.lat.toFixed(3) : 'x';
  const ln = e.lng != null ? e.lng.toFixed(3) : 'x';
  return `${e.tipo}-${n}-${la}-${ln}`;
}

function mergeSitio(ex: Entidad, e: Entidad) {
  pushDetalle(ex, e);
  for (const f of e.fuentes) if (!ex.fuentes.includes(f)) ex.fuentes.push(f);
  ex.confianza = ex.fuentes.length;
  ex.fuente = ex.fuentes.join(' + ');
  if (!ex.foto && e.foto) ex.foto = e.foto;
  if (e.fecha && (!ex.fecha || e.fecha > ex.fecha)) ex.fecha = e.fecha;
}

function dedupSitios(items: Entidad[]): Entidad[] {
  const sitioMap = new Map<string, Entidad>();
  for (const e of items) {
    const k = sitioKey(e);
    const ex = sitioMap.get(k);
    if (ex) mergeSitio(ex, e);
    else sitioMap.set(k, e);
  }
  return [...sitioMap.values()];
}

/** Segmento principal del lugar (municipio/ciudad), para agrupar zonas. */
function zonaDe(lugar: string | null): string | null {
  if (!lugar) return null;
  const first = lugar.split(/[·,]/)[0].trim();
  return first.length >= 3 ? first : null;
}

function countMeta(all: Entidad[]): IndexMeta {
  const porClase: Record<string, number> = {};
  const porTipo: Record<string, number> = {};
  const porOrigen: Record<string, number> = {};
  const porZona = new Map<string, number>();
  for (const e of all) {
    porClase[e.clase] = (porClase[e.clase] || 0) + 1;
    porTipo[e.tipo] = (porTipo[e.tipo] || 0) + 1;
    porOrigen[e.origen] = (porOrigen[e.origen] || 0) + 1;
    const z = zonaDe(e.lugar);
    if (z) porZona.set(z, (porZona.get(z) || 0) + 1);
  }
  const top_lugares = [...porZona.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([lugar, n]) => ({ lugar, n }));
  return {
    total: all.length,
    con_coordenadas: all.filter((e) => e.lat != null && e.lng != null).length,
    confirmados_multi_fuente: all.filter((e) => e.confianza > 1).length,
    por_clase: porClase,
    por_tipo: porTipo,
    por_origen: porOrigen,
    top_lugares,
  };
}

/** Payload mínimo para el mapa inicial (sin textos largos ni fotos). */
function slimForMap(e: Entidad): Entidad {
  const obs = e.observaciones;
  return {
    id: e.id,
    nombre: e.nombre,
    tipo: e.tipo,
    clase: e.clase,
    origen: e.origen,
    status: e.status,
    lugar: e.lugar,
    observaciones: obs && obs.length > 140 ? `${obs.slice(0, 140)}…` : obs,
    // La cédula ya viene enmascarada de origen y la ficha de persona la muestra.
    cedula: e.clase === 'persona' ? e.cedula : null,
    foto: null,
    categorias: e.categorias.slice(0, 6),
    telefono: e.telefono,
    fuente: e.fuente,
    fuentes: e.fuentes,
    confianza: e.confianza,
    fuente_url: e.fuente_url,
    ficha_url: null,
    fuentes_detalle: e.fuentes_detalle,
    lat: e.lat,
    lng: e.lng,
    fecha: e.fecha,
  };
}

// Browse inicial: el índice entero (sitios core + Venezuela Reporta + personas y
// reportes de /api/personas), con y sin coordenadas. Lo que tiene lat/lng va al
// mapa; el resto vive en la lista, como ya hacía /busquedas.
//
// Antes esto devolvía solo sitios y reportes geolocalizados y los conteos del
// índice viajaban aparte (`mode=stats`). Al unificar las dos vistas eso dejaba a
// la lista sin las personas —los pines de Localizados, Terremoto Venezuela y el
// hub de Venezuela Ayuda— y obligaba a estimar los conteos. El índice completo son
// ~700 fichas más que el payload geolocalizado y hace de única fuente de verdad
// para mapa, lista, facetas y estadísticas.
async function buildBrowse(): Promise<Entidad[]> {
  const personasUrl = new URL(`${internalAppOrigin()}/api/personas`);
  const [coreRes, personasRes, vrSitios] = await Promise.all([
    buildPuntos().catch((err) => {
      console.error('busqueda-avanzada core:', err);
      return [] as any[];
    }),
    fetch(personasUrl.toString(), { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .catch((err) => {
        console.error('busqueda-avanzada personas(map):', err);
        return { data: [] };
      }),
    fetchVrSitios(),
  ]);
  const core = Array.isArray(coreRes) ? coreRes.map(puntoToEntidad) : [];
  const personData = Array.isArray(personasRes?.data) ? personasRes.data : [];
  const personasYReportes: Entidad[] = personData.map(personItemToEntidad);
  const sitios = dedupSitios([...core, ...vrSitios]);
  return [...sitios, ...personasYReportes];
}

async function buildFullIndex(
  q: string,
  cedula: string,
  isSearch: boolean,
  lugar = '',
  estado = '',
): Promise<Entidad[]> {
  const qNorm = q ? normalizeSearchText(q) : '';
  const lugarNorm = lugar ? normalizeSearchText(lugar) : '';
  const personasUrl = new URL(`${internalAppOrigin()}/api/personas`);
  if (q) personasUrl.searchParams.set('q', q);
  if (cedula) personasUrl.searchParams.set('cedula', cedula);

  const [coreRes, personasRes, vrSitios, vrPersonas] = await Promise.all([
    buildPuntos().catch((err) => {
      console.error('busqueda-avanzada core:', err);
      return [] as any[];
    }),
    fetch(personasUrl.toString(), { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .catch((err) => {
        console.error('busqueda-avanzada personas:', err);
        return { data: [] };
      }),
    fetchVrSitios(),
    isSearch ? fetchVrPersonas(q, 100) : Promise.resolve([] as Entidad[]),
  ]);

  const core = Array.isArray(coreRes) ? coreRes.map(puntoToEntidad) : [];
  const personData = Array.isArray(personasRes?.data) ? personasRes.data : [];
  const personas: Entidad[] = personData.map(personItemToEntidad);

  const personaMap = new Map<string, Entidad>();
  const personasSinClave: Entidad[] = [];
  for (const e of [...personas, ...vrPersonas]) {
    if (e.clase !== 'persona') { personasSinClave.push(e); continue; }
    const k = personaKey(e);
    if (!k) { personasSinClave.push(e); continue; }
    const ex = personaMap.get(k);
    if (ex) mergePersona(ex, e);
    else personaMap.set(k, e);
  }
  const personasFinal = [...personaMap.values(), ...personasSinClave.filter((e: Entidad) => e.clase === 'persona')];
  const reportes = personas.filter((e: Entidad) => e.clase === 'reporte');
  const sitios = dedupSitios([...core, ...vrSitios]);

  let all: Entidad[] = [...personasFinal, ...sitios, ...reportes];

  if (isSearch) {
    const cd = cedula.replace(/\D/g, '');
    all = all.filter((e) => {
      // Filtros de exploración por zona/estado (compatibles con o sin texto).
      if (lugarNorm && !normalizeSearchText(e.lugar || '').includes(lugarNorm)) return false;
      if (estado && e.clase === 'persona') {
        const loc = e.category === 'localizado' || /localizad|salvo|encontrad|alta|hospitaliz/i.test(e.status || '');
        if (estado === 'localizado' && !loc) return false;
        if (estado === 'desaparecido' && loc) return false;
      }
      if (cd) {
        const rec = (e.cedula || '').replace(/\D/g, '');
        return rec.length >= 3 && (rec.endsWith(cd) || cd.endsWith(rec));
      }
      if (qNorm) {
        return (
          normalizeSearchText(e.nombre || '').includes(qNorm) ||
          normalizeSearchText(e.lugar || '').includes(qNorm) ||
          normalizeSearchText(e.observaciones || '').includes(qNorm) ||
          (e.cedula ? normalizeSearchText(e.cedula).includes(qNorm) : false)
        );
      }
      return true;
    });
  }

  return all;
}

async function getCachedBrowse(): Promise<Entidad[]> {
  if (browseCache && Date.now() < browseCache.expires) return browseCache.data;
  if (browseInflight) return browseInflight;

  browseInflight = (async () => {
    const all = await buildBrowse();
    browseCache = { data: all, expires: Date.now() + BROWSE_TTL_MS };
    return all;
  })().finally(() => {
    browseInflight = null;
  });

  return browseInflight;
}

export async function GET(request: Request) {
  const key = `busqueda-avanzada:${clientIp(request)}`;
  if (blockedFor(key) > 0) return NextResponse.json({ error: 'Demasiadas solicitudes.' }, { status: 429 });
  hit(key, 45, 60_000, 5 * 60_000);

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim();
  const cedula = (searchParams.get('cedula') || '').trim();
  const lugar = (searchParams.get('lugar') || '').trim();
  const estado = (searchParams.get('estado') || '').trim(); // 'localizado' | 'desaparecido'
  const isSearch = q.length > 0 || cedula.length > 0 || lugar.length > 0 || estado.length > 0;
  const mode = searchParams.get('mode') || (isSearch ? 'search' : 'browse');

  const atribucion = 'AcopioVE + fuentes comunitarias (incl. Venezuela Reporta)';

  // Búsqueda / exploración: índice completo filtrado por query, zona o estado.
  if (isSearch || mode === 'search') {
    const all = await buildFullIndex(q, cedula, true, lugar, estado);
    const claseFilter = (searchParams.get('clase') || '').split(',').map((s) => s.trim()).filter(Boolean);
    const tipoFilter = (searchParams.get('tipo') || '').split(',').map((s) => s.trim()).filter(Boolean);
    let filtered = all;
    if (claseFilter.length) filtered = filtered.filter((e) => claseFilter.includes(e.clase));
    if (tipoFilter.length) filtered = filtered.filter((e) => tipoFilter.includes(e.tipo));

    const meta = countMeta(filtered);
    return NextResponse.json({
      data: filtered,
      meta: {
        ...meta,
        search_mode: true,
        browse_mode: false,
        atribucion,
      },
    });
  }

  // Browse: índice completo (mapa + lista + facetas + estadísticas).
  const all = await getCachedBrowse();
  return NextResponse.json({
    data: all.map(slimForMap),
    meta: {
      ...countMeta(all),
      search_mode: false,
      browse_mode: true,
      atribucion,
    },
  });
}
