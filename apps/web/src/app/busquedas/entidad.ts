// Dominio de la vista unificada de /busquedas: el modelo `Entidad` que devuelve
// /api/busqueda-avanzada, las capas del mapa y el adaptador a los pines.
//
// Una sola taxonomía en dos ejes, porque filtran cosas distintas:
//   - facetas (GRUPOS): QUÉ es la ficha        -> chips de la barra superior
//   - capas   (CAPAS):  DE DÓNDE sale, o qué   -> panel lateral de capas
//                       overlay se dibuja
// Se cruzan con AND: "Personas" + "Localizados (Salud)" = personas de esa fuente.

import type { Entidad, OrigenCapa } from '@/lib/busqueda-avanzada/types';
import { normalizeSearchText } from '@/lib/text';

export type { Entidad, OrigenCapa };

// Tipos de pin que entiende PersonasMap.
export type PersonTipo =
  | 'localizado' | 'desaparecido' | 'reporte_ve' | 'insumos' | 'danos'
  | 'hub' | 'responsegrid' | 'ayudavenezuela' | 'redh' | 'demano'
  | 'acopio' | 'refugio' | 'salud';

export type Person = {
  id: string;
  nombre: string;
  cedula: string | null;
  status: string;
  lugar: string;
  observaciones: string | null;
  foto: string | null;
  fuente: string;
  fuentes?: string[];
  tipo: PersonTipo;
  category?: string;
  lat: number | null;
  lng: number | null;
  fecha: string | null;
};

// --- Facetas (chips) -------------------------------------------------------

export const GRUPOS: { key: string; label: string; color: string; match: (e: Entidad) => boolean }[] = [
  { key: 'persona',  label: 'Personas',  color: '#ef4444', match: (e) => e.clase === 'persona' },
  { key: 'acopio',   label: 'Acopios',   color: '#7c3aed', match: (e) => e.tipo === 'acopio' },
  { key: 'refugio',  label: 'Refugios',  color: '#0f766e', match: (e) => e.tipo === 'refugio' },
  { key: 'salud',    label: 'Salud',     color: '#0e7490', match: (e) => e.tipo === 'salud' },
  { key: 'telefono', label: 'Teléfonos', color: '#475569', match: (e) => e.tipo === 'telefono' },
  { key: 'dano',     label: 'Daños',     color: '#db2777', match: (e) => e.tipo === 'dano' },
  { key: 'servicio', label: 'Servicios', color: '#f59e0b', match: (e) => e.tipo === 'servicio' || e.tipo === 'necesidad' },
];

export function grupoDe(e: Entidad): string {
  for (const g of GRUPOS) if (g.match(e)) return g.key;
  return 'persona';
}

// --- Capas -----------------------------------------------------------------

export type CapaSeccion = 'Personas' | 'AcopioVE' | 'Ayuda y necesidades' | 'Daños' | 'Sismos' | 'Clima y alertas';

export type Capa = {
  key: string;
  seccion: CapaSeccion;
  title: string;
  sub?: string;
  color: string;
  /** Capa de datos: qué orígenes muestra. Sin esto es un overlay del mapa. */
  origen?: OrigenCapa[];
  on: boolean;
};

export const CAPAS: Capa[] = [
  { key: 'sos',         seccion: 'Personas', title: 'Se busca',              sub: 'Fuente: SOS Venezuela',            color: '#ef4444', origen: ['desaparecido'],   on: true },
  { key: 'localizados', seccion: 'Personas', title: 'Localizados (Salud)',   sub: 'Fuentes: LocVE / CIVIS',           color: '#059669', origen: ['localizado'],     on: true },
  { key: 'redh',        seccion: 'Personas', title: 'REDH AVAPRE',           sub: 'Hospitalizados y desaparecidos',   color: '#ea580c', origen: ['redh'],           on: true },
  { key: 'ayudavzla',   seccion: 'Personas', title: 'Terremoto Venezuela',   sub: 'Ingresos en hospitales (API)',     color: '#16a34a', origen: ['ayudavenezuela'], on: true },
  { key: 'vrpersonas',  seccion: 'Personas', title: 'Venezuela Reporta',     sub: 'Personas · aparecen al buscar',    color: '#6366f1', origen: ['vr_persona'],     on: true },

  { key: 'acopios',   seccion: 'AcopioVE', title: 'Centros de acopio', sub: 'Datos propios de AcopioVE',   color: '#7c3aed', origen: ['core_acopio'],   on: true },
  { key: 'refugios',  seccion: 'AcopioVE', title: 'Refugios',          sub: 'Datos propios de AcopioVE',   color: '#0f766e', origen: ['core_refugio'],  on: true },
  { key: 'salud',     seccion: 'AcopioVE', title: 'Centros de salud',  sub: 'Fuente: CIVIS Venezuela',     color: '#0e7490', origen: ['core_salud'],    on: true },
  { key: 'telefonos', seccion: 'AcopioVE', title: 'Teléfonos útiles',  sub: 'Sin ubicación: solo en lista', color: '#475569', origen: ['core_telefono'], on: true },
  { key: 'vrsitios',  seccion: 'AcopioVE', title: 'Venezuela Reporta', sub: 'Acopios, refugios y clínicas', color: '#4f46e5', origen: ['vr_sitio'],      on: true },

  { key: 'hub',     seccion: 'Ayuda y necesidades', title: 'Venezuela Ayuda',     sub: 'Hub: personas y solicitudes',      color: '#0891b2', origen: ['hub'],     on: false },
  { key: 'demano',  seccion: 'Ayuda y necesidades', title: 'De Mano en Mano',     sub: 'Necesidades de insumos por unidad', color: '#0d9488', origen: ['demano'],  on: true },
  { key: 'insumos', seccion: 'Ayuda y necesidades', title: 'Centros de Insumos',  sub: 'Fuente: Centros Insumos VE',       color: '#8b5cf6', origen: ['insumos'], on: false },

  { key: 'sar',     seccion: 'Daños', title: 'Daño Satelital (TerraVE)', sub: 'Fuente: Sentinel-1 / GEE',        color: '#06b6d4', on: true },
  { key: 'danos',   seccion: 'Daños', title: 'Daños Estructurales',      sub: 'Fuente: Mapa de Daños VE',        color: '#db2777', origen: ['danos'], on: true },
  { key: 'danosIA', seccion: 'Daños', title: 'Edificios Dañados (IA)',   sub: 'Catia La Mar · Microsoft AI for Good', color: '#b91c1c', on: false },

  { key: 'shakemap',  seccion: 'Sismos', title: 'ShakeMap 2026',    sub: 'Bandas de intensidad sentida (USGS)',   color: '#de2d26', on: false },
  { key: 'epicentros', seccion: 'Sismos', title: 'Epicentros 2026', sub: 'Doblete M7.2 y M7.5 + ruptura',         color: '#ef4444', on: false },
  { key: 'replicas',  seccion: 'Sismos', title: 'Réplicas 2026',    sub: 'Réplicas en vivo (USGS)',               color: '#f59e0b', on: false },
  { key: 'sismo1967', seccion: 'Sismos', title: 'Terremoto 1967',   sub: 'Intensidad y epicentro M6.6 (histórico)', color: '#7c3aed', on: false },

  { key: 'lluvia',    seccion: 'Clima y alertas', title: 'Lluvia (precipitación)',  sub: 'Tiles · OpenWeatherMap',           color: '#3b82f6', on: false },
  { key: 'clima',     seccion: 'Clima y alertas', title: 'Clima por ciudad',        sub: 'Temp / lluvia / viento · Open-Meteo', color: '#0f766e', on: false },
  { key: 'alertas',   seccion: 'Clima y alertas', title: 'Alertas de desastres',    sub: 'Nivel verde/naranja/rojo · GDACS',  color: '#dc2626', on: false },
  { key: 'reporteve', seccion: 'Clima y alertas', title: 'Servicios y Escasez',     sub: 'Fuente: Reporte VE',               color: '#f59e0b', origen: ['reporte_ve'], on: true },
];

export const SECCIONES: CapaSeccion[] = ['Personas', 'AcopioVE', 'Ayuda y necesidades', 'Daños', 'Sismos', 'Clima y alertas'];

export type CapasState = Record<string, boolean>;

export const CAPAS_INICIALES: CapasState = Object.fromEntries(CAPAS.map((c) => [c.key, c.on]));

/** Orígenes visibles según el estado de las capas de datos. */
export function origenesActivos(capas: CapasState): Set<OrigenCapa> {
  const s = new Set<OrigenCapa>();
  for (const c of CAPAS) {
    if (!c.origen || !capas[c.key]) continue;
    for (const o of c.origen) s.add(o);
  }
  return s;
}

// --- Adaptador Entidad -> pin del mapa -------------------------------------

// Los sitios se pintan por `tipo` (un sitio de Venezuela Reporta y uno nuestro
// son el mismo objeto en el mapa); el resto por `origen`, que es lo que define
// color e ícono de cada fuente.
const PIN_POR_ORIGEN: Record<OrigenCapa, PersonTipo> = {
  localizado: 'localizado',
  desaparecido: 'desaparecido',
  reporte_ve: 'reporte_ve',
  insumos: 'insumos',
  danos: 'danos',
  hub: 'hub',
  responsegrid: 'responsegrid',
  ayudavenezuela: 'ayudavenezuela',
  redh: 'redh',
  demano: 'demano',
  core_acopio: 'acopio',
  core_refugio: 'refugio',
  core_salud: 'salud',
  core_telefono: 'acopio',
  vr_sitio: 'acopio',
  vr_persona: 'desaparecido',
};

export function pinDe(e: Entidad): PersonTipo {
  if (e.clase === 'sitio') {
    return e.tipo === 'refugio' ? 'refugio' : e.tipo === 'salud' ? 'salud' : 'acopio';
  }
  if (e.origen === 'vr_persona') {
    return e.category === 'localizado' ? 'localizado' : 'desaparecido';
  }
  return PIN_POR_ORIGEN[e.origen] ?? 'desaparecido';
}

export function toPerson(e: Entidad): Person {
  return {
    id: e.id,
    nombre: e.nombre,
    cedula: e.cedula,
    status: e.status || '',
    lugar: e.lugar || '',
    observaciones: e.observaciones,
    foto: e.foto,
    fuente: e.fuente,
    fuentes: e.fuentes,
    tipo: pinDe(e),
    category: e.category,
    lat: e.lat,
    lng: e.lng,
    fecha: e.fecha,
  };
}

// --- Estado operativo de sitios --------------------------------------------

// Cada fuente usa su vocabulario (core: abierto/lleno/cerrado; Venezuela
// Reporta: operativo/saturado/...). Se normaliza para el filtro y el badge.
export type EstadoOp = 'abierto' | 'lleno' | 'cerrado' | null;

export function estadoDe(e: Entidad): EstadoOp {
  if (e.clase !== 'sitio') return null;
  const s = normalizeSearchText(e.status || '');
  if (!s) return null;
  if (/cerr|inactiv|no oper/.test(s)) return 'cerrado';
  if (/llen|satur|complet|copad/.test(s)) return 'lleno';
  if (/abier|oper|activ|disponible/.test(s)) return 'abierto';
  return null;
}

export const ESTADO_STYLE: Record<'abierto' | 'lleno' | 'cerrado', { label: string; cls: string }> = {
  abierto: { label: 'Abierto', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  lleno:   { label: 'Lleno',   cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  cerrado: { label: 'Cerrado', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
};

export function fmtFecha(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' });
}

export type BrowseMeta = {
  total: number;
  con_coordenadas: number;
  confirmados_multi_fuente: number;
  por_clase: Record<string, number>;
  por_tipo: Record<string, number>;
  por_origen: Record<string, number>;
  top_lugares?: { lugar: string; n: number }[];
  search_mode: boolean;
  browse_mode?: boolean;
};
