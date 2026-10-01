// Integración de "De Mano en Mano" (demanoenmanove.org): necesidades de insumos
// por unidad hospitalaria (suturas en UCI, medicinas en Emergencias, etc.) con
// cantidad pedida vs. cubierta y nivel de urgencia. Es dato complementario, no
// duplica nuestros acopios/refugios ni los reportes de personas.
//
// Su backend público es un Google Apps Script sobre Google Sheets (sin llave,
// sin CORS → se consume server-side, como el resto de nuestras fuentes).
// No expone lat/lng: solo `maps_url` (link corto de Google Maps). Resolvemos las
// coordenadas siguiendo el redirect (un solo salto 302) y parseando `!3d!4d`,
// con caché en memoria para no re-resolver en cada request.
//
// Resiliente: ante cualquier fallo de la fuente devuelve [] (la capa simplemente
// no aparece), igual que las capas Hub/ResponseGrid/REDH del agregador.

export interface DemanoNeed {
  id: string;
  item: string;
  categoria: string;
  unidad: string;
  cantidad_pedida: number;
  cantidad_cubierta: number;
  urgencia: number; // 1 (baja) .. 3 (alta)
}

export interface DemanoCentro {
  id: string;
  nombre: string;
  tipo: string;
  zona: string;
  estado: string;
  municipio: string;
  parroquia: string;
  sector: string;
  maps_url: string;
  whatsapp_publico: string;
  estado_centro: string;
  necesidades: DemanoNeed[];
}

// Item normalizado al modelo del agregador de /api/personas.
export interface DemanoItem {
  id: string;
  nombre: string;
  cedula: null;
  status: string;
  lugar: string;
  observaciones: string | null;
  foto: null;
  fuente: 'De Mano en Mano';
  tipo: 'demano';
  lat: number | null;
  lng: number | null;
  fecha: string | null;
}

const ENDPOINT =
  process.env.DEMANO_ENDPOINT ||
  'https://script.google.com/macros/s/AKfycbzX5pI5pnPazsDU8jPrrMbFpAxra149rNbjDWyYTwC_jhWTZORG_V3onD5LVd-fe8eY3g/exec';

// Caché en memoria de coords resueltas desde maps_url (vive en el proceso).
const coordCache = new Map<string, { lat: number; lng: number } | null>();

function parseCoords(url: string): { lat: number; lng: number } | null {
  // El marcador real va en !3d<lat>!4d<lng>; el centro de vista en @lat,lng.
  const m =
    url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) ||
    url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  return m ? { lat: parseFloat(m[1]), lng: parseFloat(m[2]) } : null;
}

async function resolveCoords(mapsUrl: string): Promise<{ lat: number; lng: number } | null> {
  if (!mapsUrl) return null;
  if (coordCache.has(mapsUrl)) return coordCache.get(mapsUrl)!;
  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 5000);
    // redirect:manual → leemos el Location del 302 sin descargar el mapa entero.
    const r = await fetch(mapsUrl, { redirect: 'manual', signal: ctrl.signal });
    clearTimeout(to);
    const loc = r.headers.get('location') || r.url || '';
    const coords = parseCoords(loc);
    coordCache.set(mapsUrl, coords);
    return coords;
  } catch {
    coordCache.set(mapsUrl, null);
    return null;
  }
}

function humanEstado(e: string): string {
  if (e === 'con_necesidades') return 'Con necesidades activas';
  if (e === 'cubierto') return 'Necesidades cubiertas';
  return e ? e.replace(/_/g, ' ') : 'Centro reportado';
}

function buildObservaciones(c: DemanoCentro): string | null {
  const partes: string[] = [];
  const needs = Array.isArray(c.necesidades) ? c.necesidades : [];
  if (needs.length) {
    const top = needs
      .slice()
      .sort((a, b) => (b.urgencia || 0) - (a.urgencia || 0))
      .slice(0, 6)
      .map((n) => {
        const cubierta = `${n.cantidad_cubierta ?? 0}/${n.cantidad_pedida ?? 0}`;
        const urg = n.urgencia >= 3 ? 'urgente' : n.urgencia === 2 ? 'media' : 'baja';
        return `${n.item} (${n.unidad}, ${cubierta}, urg. ${urg})`;
      });
    const extra = needs.length > 6 ? ` y ${needs.length - 6} más` : '';
    partes.push(`Necesidades (${needs.length}): ${top.join(' · ')}${extra}`);
  }
  if (c.whatsapp_publico) partes.push(`WhatsApp: ${c.whatsapp_publico}`);
  return partes.length ? partes.join(' — ') : null;
}

/**
 * Obtiene las necesidades de De Mano en Mano ya normalizadas y geolocalizadas,
 * listas para mezclarse en el agregador de /api/personas. Resiliente: [] si falla.
 */
export async function getDemanoItems(): Promise<DemanoItem[]> {
  let centros: DemanoCentro[] = [];
  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(ENDPOINT, { next: { revalidate: 300 }, signal: ctrl.signal });
    clearTimeout(to);
    if (!res.ok) return [];
    const data = await res.json();
    centros = Array.isArray(data?.centros) ? data.centros : [];
  } catch (err) {
    console.error('Error fetching De Mano en Mano:', err);
    return [];
  }

  const items = await Promise.all(
    centros.map(async (c): Promise<DemanoItem> => {
      const coords = await resolveCoords(c.maps_url);
      const lugar =
        [c.municipio, c.estado].filter(Boolean).join(', ') || c.zona || 'Venezuela';
      return {
        id: `demano-${c.id}`,
        nombre: c.nombre || 'Centro (De Mano en Mano)',
        cedula: null,
        status: humanEstado(c.estado_centro),
        lugar,
        observaciones: buildObservaciones(c),
        foto: null,
        fuente: 'De Mano en Mano',
        tipo: 'demano',
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
        fecha: null,
      };
    })
  );

  return items;
}
