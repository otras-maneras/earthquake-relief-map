// Búsqueda PÚBLICA y PII-segura de personas reportadas (desaparecidas/localizadas)
// para reunificación — pensada para apps y chatbots.
// Fuentes: SOS Venezuela + Localizados Venezuela + hub Venezuela Ayuda
// + ReportaVNZLA (on-demand; incluye desaparecidosterremotovenezuela.com y aliados).
// Reglas PII (modelo redayudavenezuela.com):
//   - cédula SIEMPRE enmascarada (solo últimos dígitos)
//   - NUNCA teléfonos ni coordenadas GPS (solo ubicación general en texto)
//   - se protege la ubicación de menores (edad < 18) → se omite
//   - es un LOOKUP (requiere término de búsqueda), no un volcado masivo

import {
  maskCedulaPublic,
  searchReportaVnzlaPersonas,
} from '@/lib/api/reportavnzla-personas';

export interface PersonaPublicDTO {
  id: string;
  nombre: string;
  estado: 'desaparecido' | 'localizado';
  edad: number | null;
  ubicacion_general: string | null;
  foto: string | null;
  cedula: string | null; // enmascarada
  fuente: string;
  fecha: string | null;
}

function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
}

function digitsOnly(s: string): string {
  return String(s).replace(/\D/g, '');
}

async function fetchJson(url: string, fallback: any, init?: RequestInit): Promise<any> {
  try {
    const res = await fetch(url, { next: { revalidate: 60 }, ...init });
    return res.ok ? await res.json() : fallback;
  } catch {
    return fallback;
  }
}

function maskCedula(raw: unknown): string | null {
  return maskCedulaPublic(raw);
}

async function loadAllPersonas(): Promise<{ list: PersonaPublicDTO[]; rawCedulas: Map<string, string> }> {
  const HUB = process.env.HUB_AYUDA_API_URL || 'https://terremoto.hazlohoy.org';
  const [sos, loc, hubMissing, hubCheckin] = await Promise.all([
    fetchJson('https://sosvenezuela2026.com/api/persons/list?offset=0&limit=300', []),
    fetchJson('https://localizadosvenezuela.com/api/v1/localizados?page=1&limit=300', { data: [] }),
    fetchJson(`${HUB}/api/v1/reports?type=missing_person&limit=500`, { reports: [] }),
    fetchJson(`${HUB}/api/v1/reports?type=checkin&limit=500`, { reports: [] }),
  ]);

  const list: PersonaPublicDTO[] = [];
  const rawCedulas = new Map<string, string>();

  const push = (p: PersonaPublicDTO, rawCedula?: unknown) => {
    if (rawCedula != null) {
      const d = digitsOnly(String(rawCedula));
      if (d) rawCedulas.set(p.id, d);
    }
    list.push(p);
  };

  for (const p of Array.isArray(sos) ? sos : []) {
    push(
      {
        id: `sos-${p.id}`,
        nombre: p.display_name || 'Sin nombre',
        estado: p.status === 'found_alive' ? 'localizado' : 'desaparecido',
        edad: typeof p.age === 'number' ? p.age : null,
        ubicacion_general: p.parroquia || p.hospital_name || null,
        foto: p.photo_path || null,
        cedula: maskCedula(p.cedula_masked ?? p.cedula),
        fuente: 'SOS Venezuela',
        fecha: p.source_date || null,
      },
      p.cedula_masked ?? p.cedula,
    );
  }

  const locData = loc && Array.isArray(loc.data) ? loc.data : [];
  for (const p of locData) {
    push(
      {
        id: `loc-${p.slug}`,
        nombre: p.nombreCompleto || 'Sin nombre',
        estado: 'localizado',
        edad: typeof p.edad === 'number' ? p.edad : null,
        ubicacion_general: p.lugarNombre || null,
        foto: null,
        cedula: maskCedula(p.cedula),
        fuente: p.fuente?.nombre ? `Localizados (${p.fuente.nombre})` : 'Localizados Venezuela',
        fecha: p.publicadoEn || null,
      },
      p.cedula,
    );
  }

  for (const r of Array.isArray(hubMissing?.reports) ? hubMissing.reports : []) {
    push({
      id: `hub-mp-${r.id}`,
      nombre: r.name || 'Sin nombre',
      estado: 'desaparecido',
      edad: null,
      ubicacion_general: r.place_name || r.city || null,
      foto: r.photo_url || null,
      cedula: null,
      fuente: r.source ? `Venezuela Ayuda (${r.source})` : 'Venezuela Ayuda',
      fecha: r.created_at || null,
    });
  }
  for (const r of Array.isArray(hubCheckin?.reports) ? hubCheckin.reports : []) {
    push({
      id: `hub-ci-${r.id}`,
      nombre: r.name || 'Sin nombre',
      estado: 'localizado',
      edad: null,
      ubicacion_general: r.place_name || r.city || null,
      foto: r.photo_url || null,
      cedula: null,
      fuente: r.source ? `Venezuela Ayuda (${r.source})` : 'Venezuela Ayuda',
      fecha: r.created_at || null,
    });
  }

  return { list, rawCedulas };
}

async function loadReportaVnzla(q: PersonasSearchQuery): Promise<{
  list: PersonaPublicDTO[];
  rawCedulas: Map<string, string>;
}> {
  const rows = await searchReportaVnzlaPersonas({
    q: q.q,
    cedula: q.cedula,
    limit: q.limit,
  });
  const list: PersonaPublicDTO[] = [];
  const rawCedulas = new Map<string, string>();

  for (const p of rows) {
    if (q.estado && p.estado !== q.estado) continue;
    list.push({
      id: p.id,
      nombre: p.nombre,
      estado: p.estado,
      edad: p.edad,
      ubicacion_general: p.ubicacion,
      foto: p.foto,
      cedula: p.cedulaMasked,
      fuente: 'ReportaVNZLA',
      fecha: p.fecha,
    });
    if (p.cedulaDigits) rawCedulas.set(p.id, p.cedulaDigits);
  }

  return { list, rawCedulas };
}

export interface PersonasSearchQuery {
  q?: string;
  cedula?: string;
  estado?: 'desaparecido' | 'localizado';
  limit: number;
}

export function parsePersonasQuery(p: URLSearchParams): PersonasSearchQuery {
  const estadoRaw = (p.get('estado') || '').toLowerCase();
  return {
    q: p.get('q')?.trim() || undefined,
    cedula: p.get('cedula')?.trim() || undefined,
    estado: estadoRaw === 'desaparecido' || estadoRaw === 'localizado' ? estadoRaw : undefined,
    limit: Math.min(Math.max(Number(p.get('limit')) || 25, 1), 50),
  };
}

export async function searchPersonas(
  q: PersonasSearchQuery,
): Promise<{ rows: PersonaPublicDTO[]; total: number }> {
  const [{ list, rawCedulas }, reporta] = await Promise.all([
    loadAllPersonas(),
    loadReportaVnzla(q),
  ]);

  const merged = [...list, ...reporta.list];
  const mergedCedulas = new Map([...rawCedulas, ...reporta.rawCedulas]);

  const qn = q.q ? norm(q.q) : null;
  const cd = q.cedula ? digitsOnly(q.cedula) : null;

  let filtered = merged.filter((p) => {
    if (q.estado && p.estado !== q.estado) return false;
    if (p.id.startsWith('rv-')) return true;
    let match = true;
    if (qn) match = norm(p.nombre).includes(qn);
    if (match && cd) {
      const rec = mergedCedulas.get(p.id) || '';
      match = !!rec && (rec.endsWith(cd) || cd.endsWith(rec));
    }
    return match;
  });

  filtered = filtered.map((p) => (p.edad != null && p.edad < 18 ? { ...p, ubicacion_general: null } : p));

  const total = filtered.length;
  return { rows: filtered.slice(0, q.limit), total };
}
