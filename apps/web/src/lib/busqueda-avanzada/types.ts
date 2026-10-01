// Modelo común "Entidad" para la vista consolidada /busqueda-avanzada.
// Superset del `Person` de /busquedas, ampliado para cubrir también nuestra
// data core (acopios, refugios, teléfonos, salud) y sitios de aliados.
// Vive SOLO en el endpoint nuevo /api/busqueda-avanzada — no toca /api/personas
// ni la API pública /v1.

export type EntidadTipo =
  | 'persona'
  | 'acopio'
  | 'refugio'
  | 'telefono'
  | 'salud'
  | 'dano'
  | 'servicio'
  | 'necesidad'
  | 'hub';

// Agrupación de alto nivel para las facetas del buscador transversal.
export type EntidadClase = 'persona' | 'sitio' | 'reporte';

// Capa de origen de la ficha. `tipo`/`clase` agrupan para las facetas y por eso
// colapsan detalle (p. ej. insumos, De Mano en Mano y una solicitud del hub caen
// las tres en `necesidad`); `origen` conserva la fuente exacta, que es lo que
// necesitan los toggles de capas del mapa, sus colores y las estadísticas por API.
// Los diez primeros son los `tipo` de /api/personas, uno a uno.
export type OrigenCapa =
  | 'localizado'
  | 'desaparecido'
  | 'reporte_ve'
  | 'insumos'
  | 'danos'
  | 'hub'
  | 'responsegrid'
  | 'ayudavenezuela'
  | 'redh'
  | 'demano'
  | 'core_acopio'
  | 'core_refugio'
  | 'core_salud'
  | 'core_telefono'
  | 'vr_sitio'
  | 'vr_persona';

export interface Entidad {
  id: string;
  nombre: string;
  tipo: EntidadTipo;
  clase: EntidadClase;
  origen: OrigenCapa;
  status: string | null;
  lugar: string | null;
  observaciones: string | null;
  cedula: string | null;
  foto: string | null;
  categorias: string[]; // qué recibe / necesita
  telefono: string | null;
  fuente: string; // legible; puede ser "A + B" tras fusión
  fuentes: string[]; // fuentes que confirman la ficha
  confianza: number; // = fuentes.length
  fuente_url: string | null;
  ficha_url: string | null; // enlace a la ficha original (ej. Venezuela Reporta)
  // Desglose por fuente para auditar la conciliación: qué aportó cada fuente y
  // su enlace propio. Se llena solo cuando hay fusión (varias fuentes). Para
  // fichas de una sola fuente, la UI lo deriva de { fuente, fuente_url, ficha_url }.
  fuentes_detalle?: { fuente: string; ficha_url: string | null; fuente_url: string | null }[];
  lat: number | null;
  lng: number | null;
  fecha: string | null;
  category?: string;
}

// Clases por tipo, para derivar la faceta.
export const TIPO_A_CLASE: Record<EntidadTipo, EntidadClase> = {
  persona: 'persona',
  acopio: 'sitio',
  refugio: 'sitio',
  telefono: 'sitio',
  salud: 'sitio',
  hub: 'persona',
  dano: 'reporte',
  servicio: 'reporte',
  necesidad: 'reporte',
};
