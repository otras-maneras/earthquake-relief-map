// Ingesta de pacientes VERIFICADOS de HelpMap Venezuela (helpmapvzla.net) como una
// fuente más de personas de /api/personas.
//
// APAGADA por defecto: sin `HELPMAP_PATIENTS_URL` configurada, no consulta nada (return []).
// Se enciende poniendo esa variable de entorno cuando el equipo de HelpMap confirme los
// términos. Ver docs/integracion-helpmap.md.
//
// Defaults conservadores (acordados como punto de partida, reversibles con flags):
//   • Cédula: se pasa cruda y el enmascarado CENTRAL de /api/personas la reduce a ***NNN
//     (y usa sus dígitos como llave de dedup). "MENOR"/"sin documento" → sin dígitos → null.
//   • Menores: sin ubicación (se omiten lat/lng aunque HelpMap las traiga).
//   • FALLECIDO: excluido salvo HELPMAP_INCLUDE_DECEASED=1.
//   • Fotos: nunca (la API de HelpMap ya las omite; acá se fuerza foto=null).
//   • Atribución: "HelpMap VE".
// Términos de HelpMap: uso humanitario, sin reidentificar/perfilar/targetear, sin conteos.

const BASE = (process.env.HELPMAP_PATIENTS_URL || '').replace(/\/$/, ''); // p.ej. https://www.helpmapvzla.net
const INCLUDE_DECEASED = process.env.HELPMAP_INCLUDE_DECEASED === '1';
const SOURCE = 'HelpMap VE';
const PAGE = 500;
const MAX_PAGES = 10; // tope de seguridad (~5000 filas)

export interface HelpmapPatient {
  id: string;
  apellidos?: string;
  nombres?: string;
  ci_display?: string;
  is_minor?: boolean;
  edad?: number | null;
  location_name?: string;
  location_type?: string;
  municipality?: string | null;
  state?: string | null;
  lat?: number | null;
  lng?: number | null;
  estatus?: string; // INGRESADO | ALTA | FALLECIDO
  verified?: boolean;
  updated_at?: string | null;
}

/** true si la integración está configurada (hay URL de la API de HelpMap). */
export function helpmapEnabled(): boolean {
  return !!BASE;
}

function mapPatient(p: HelpmapPatient): Record<string, unknown> | null {
  if (!p?.id) return null;
  const estatus = String(p.estatus || '').toUpperCase();
  if (estatus === 'FALLECIDO' && !INCLUDE_DECEASED) return null;

  const nombre = [p.nombres, p.apellidos].filter(Boolean).join(' ').trim() || 'Sin nombre';
  const minor = !!p.is_minor || (typeof p.edad === 'number' && p.edad < 18);
  const lugar = [p.location_name, p.municipality, p.state].filter(Boolean).join(' · ') || 'Venezuela';
  const status = estatus === 'ALTA' ? 'Alta médica' : estatus === 'FALLECIDO' ? 'Fallecido' : 'Hospitalizado';

  return {
    id: `helpmap-${p.id}`,
    nombre,
    cedula: p.ci_display || null, // cruda; el mask central la enmascara y la dedup usa sus dígitos
    status,
    lugar,
    observaciones: p.location_name ? `Hospital/centro: ${p.location_name}` : null,
    foto: null,
    fuente: SOURCE,
    tipo: 'localizado', // INGRESADO/ALTA = persona localizada; FALLECIDO ya viene excluido
    edad: typeof p.edad === 'number' ? p.edad : null,
    // Menores sin ubicación (defensa en profundidad sobre el mask central por edad).
    lat: minor ? null : (typeof p.lat === 'number' ? p.lat : null),
    lng: minor ? null : (typeof p.lng === 'number' ? p.lng : null),
    fecha: p.updated_at || null,
  };
}

/** Trae pacientes verificados de HelpMap ya mapeados al shape de persona de /api/personas. */
export async function getHelpmapPersonas(opts?: { q?: string; signal?: AbortSignal }): Promise<Record<string, unknown>[]> {
  if (!BASE) return [];
  const out: Record<string, unknown>[] = [];
  try {
    for (let page = 0; page < MAX_PAGES; page++) {
      const u = new URL(`${BASE}/api/v1/patients`);
      u.searchParams.set('limit', String(PAGE));
      u.searchParams.set('offset', String(page * PAGE));
      if (opts?.q) u.searchParams.set('q', opts.q);
      const res = await fetch(u.toString(), {
        next: { revalidate: 60 },
        headers: { accept: 'application/json' },
        signal: opts?.signal,
      });
      if (!res.ok) break;
      const body = await res.json();
      const rows: HelpmapPatient[] = Array.isArray(body?.data) ? body.data : [];
      for (const r of rows) {
        const m = mapPatient(r);
        if (m) out.push(m);
      }
      const count = typeof body?.count === 'number' ? body.count : out.length;
      if (rows.length < PAGE || (page + 1) * PAGE >= count) break;
    }
  } catch {
    return out; // best-effort: devolvemos lo que se haya juntado
  }
  return out;
}
