// Consulta on-demand a ReportaVNZLA (incluye desaparecidosterremotovenezuela.com y aliados).
// Solo lookup por término — nunca volcado masivo. PII saneada en el mapper de salida.

export interface ReportaVnzlaSearchQuery {
  q?: string;
  cedula?: string;
  limit?: number;
}

export interface ReportaVnzlaPersona {
  id: string;
  nombre: string;
  estado: 'desaparecido' | 'localizado';
  edad: number | null;
  ubicacion: string | null;
  foto: string | null;
  cedulaMasked: string | null;
  cedulaDigits: string | null;
  fecha: string | null;
}

const BASE = process.env.REPORTAVNZLA_API_URL || 'https://reportavnzla.com/api/v1';
const SOURCE = process.env.REPORTAVNZLA_SOURCE_ID || 'acopiove.org';

export function maskCedulaPublic(raw: unknown): string | null {
  if (raw == null) return null;
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length < 3) return null;
  return `***${digits.slice(-3)}`;
}

function mapEstado(raw: unknown): 'desaparecido' | 'localizado' | null {
  const e = String(raw || '').toLowerCase();
  if (e === 'buscado') return 'desaparecido';
  if (e === 'encontrado' || e === 'en hospital' || e === 'en centro') return 'localizado';
  return null;
}

/** true si el input parece cédula (V-12345678 o ≥5 dígitos). */
export function looksLikeCedulaInput(raw: string): boolean {
  const t = raw.trim();
  if (/^[VEve]-?\d/.test(t)) return true;
  return t.replace(/\D/g, '').length >= 5;
}

export function digitsOnly(s: string): string {
  return String(s).replace(/\D/g, '');
}

export async function searchReportaVnzlaPersonas(
  query: ReportaVnzlaSearchQuery,
): Promise<ReportaVnzlaPersona[]> {
  if (process.env.PERSONAS_REPORTAVNZLA_ENABLED === '0') return [];
  if (!query.q && !query.cedula) return [];

  const params = new URLSearchParams();
  if (query.q) params.set('q', query.q);
  if (query.cedula) params.set('cedula', query.cedula);
  params.set('limit', String(Math.min(query.limit ?? 50, 50)));
  params.set('page', '0');

  try {
    const res = await fetch(`${BASE}/personas?${params}`, {
      next: { revalidate: 60 },
      headers: { 'X-Source': SOURCE },
    });
    if (!res.ok) return [];
    const payload = await res.json();
    const out: ReportaVnzlaPersona[] = [];

    for (const p of Array.isArray(payload?.data) ? payload.data : []) {
      const estado = mapEstado(p.estado);
      if (!estado) continue;

      const nombre = [p.nombre, p.apellido].filter(Boolean).join(' ').trim() || 'Sin nombre';
      const edad = typeof p.edad === 'number' ? p.edad : null;
      const ubicacion = p.ultimaUbicacion || p.ultima_ubicacion || null;
      const cedulaDigits = p.cedula != null ? digitsOnly(String(p.cedula)) : null;

      out.push({
        id: `rv-${p.id}`,
        nombre,
        estado,
        edad,
        ubicacion: edad != null && edad < 18 ? null : ubicacion,
        foto: p.fotoUrl || p.foto_url || null,
        cedulaMasked: maskCedulaPublic(p.cedula),
        cedulaDigits: cedulaDigits || null,
        fecha: p.updatedAt || p.updated_at || p.createdAt || p.created_at || null,
      });
    }

    return out;
  } catch {
    return [];
  }
}
