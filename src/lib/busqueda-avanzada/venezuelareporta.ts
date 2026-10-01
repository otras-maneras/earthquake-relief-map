// Adaptador de Venezuela Reporta (venezuelareporta.org/api-abierta) como fuente
// de la vista consolidada. Lectura abierta (sin llave), atribución obligatoria,
// SIN datos de contacto por API (se enlaza a ficha_url). Tolerante a fallos.
//
// - /api/v1/sitios: acopio/clinica/hospital/refugio con lat/lng -> mapeable.
// - /api/v1/personas: registro consolidado (SIN coordenadas, ~50k). Se consulta
//   on-demand en modo búsqueda (por `q`), como ReportaVNZLA.

import type { Entidad, EntidadTipo } from './types';

const BASE = process.env.VENEZUELA_REPORTA_API_URL || 'https://venezuelareporta.org';
const FUENTE = 'Venezuela Reporta';
const FUENTE_URL = 'https://venezuelareporta.org';

function sitioTipo(t: string | null | undefined): EntidadTipo {
  switch ((t || '').toLowerCase()) {
    case 'refugio':
      return 'refugio';
    case 'clinica':
    case 'hospital':
    case 'salud':
      return 'salud';
    case 'acopio':
    default:
      return 'acopio';
  }
}

// Estado consolidado de personas -> status/tipo internos.
function personaStatus(s: string | null | undefined): { status: string; localizada: boolean } {
  switch ((s || '').toLowerCase()) {
    case 'a_salvo':
      return { status: 'A salvo', localizada: true };
    case 'encontrado':
      return { status: 'Localizado', localizada: true };
    case 'buscando':
    default:
      return { status: 'Desaparecido', localizada: false };
  }
}

export async function fetchVrSitios(limit = 2000): Promise<Entidad[]> {
  try {
    const res = await fetch(`${BASE}/api/v1/sitios?limit=${limit}`, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const body = await res.json();
    const rows: any[] = Array.isArray(body?.sitios) ? body.sitios : [];
    return rows.map((s) => {
      const tipo = sitioTipo(s.tipo);
      const necesidades = Array.isArray(s.necesidades) ? s.necesidades : [];
      return {
        id: `vr-sitio-${s.id}`,
        nombre: s.nombre || 'Sitio',
        tipo,
        clase: 'sitio',
        origen: 'vr_sitio',
        status: s.estado_operativo || null,
        lugar: s.municipio || null,
        observaciones:
          necesidades.length > 0 ? `Necesita: ${necesidades.join(', ')}` : s.nota || null,
        cedula: null,
        foto: null,
        categorias: necesidades,
        telefono: null,
        fuente: FUENTE,
        fuentes: [FUENTE],
        confianza: 1,
        fuente_url: FUENTE_URL,
        ficha_url: null,
        lat: typeof s.lat === 'number' ? s.lat : null,
        lng: typeof s.lng === 'number' ? s.lng : null,
        fecha: s.ultimo_reporte_at || null,
      } satisfies Entidad;
    });
  } catch (err) {
    console.error('Error fetching Venezuela Reporta sitios:', err);
    return [];
  }
}

// On-demand: solo en modo búsqueda. Sin coordenadas -> resultados de texto/lista.
export async function fetchVrPersonas(q: string, limit = 100): Promise<Entidad[]> {
  if (!q) return [];
  try {
    const url = `${BASE}/api/v1/personas?q=${encodeURIComponent(q)}&limit=${limit}`;
    const res = await fetch(url, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const body = await res.json();
    const rows: any[] = Array.isArray(body?.personas) ? body.personas : [];
    return rows.map((p) => {
      const { status, localizada } = personaStatus(p.status);
      const lugar = [p.zona, p.ciudad].filter(Boolean).join(' · ') || null;
      return {
        id: `vr-per-${p.id}`,
        nombre: p.nombre || 'Persona sin nombre',
        tipo: 'persona',
        clase: 'persona',
        origen: 'vr_persona',
        status,
        lugar,
        observaciones: p.descripcion || p.ultima_vez || null,
        cedula: p.cedula || null,
        foto: null, // foto_url de VR puede estar caída — se omite
        categorias: [],
        telefono: null,
        fuente: p.origen ? `${FUENTE} (${p.origen})` : FUENTE,
        fuentes: [FUENTE],
        confianza: 1,
        fuente_url: FUENTE_URL,
        ficha_url: p.ficha_url || null,
        lat: null,
        lng: null,
        fecha: p.created_at || null,
        category: localizada ? 'localizado' : 'desaparecido',
      } satisfies Entidad;
    });
  } catch (err) {
    console.error('Error fetching Venezuela Reporta personas:', err);
    return [];
  }
}
