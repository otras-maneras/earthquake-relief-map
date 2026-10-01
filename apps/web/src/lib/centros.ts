export interface Centro {
  id: string;
  name: string;
  address: string | null;
  latitude: string;
  longitude: string;
  recibe: string[];
  necesitaAhora: string | null;
  horario: string | null;
  contacto: string | null;
  estado: 'abierto' | 'lleno' | 'cerrado';
  tipo: 'acopio' | 'refugio' | 'alojamiento';
  responsable: string | null;
  fuente: string | null;
  pais: string | null;
  ciudad: string | null;
  updatedAt?: string | null;
  lastConfirmedAt?: string | null;
  confirmaciones?: number;
}

export const TIPO_LABEL: Record<string, string> = {
  acopio: 'Centros de acopio',
  refugio: 'Refugios oficiales',
  alojamiento: 'Techo solidario',
};

export const TIPO_LABEL_SHORT: Record<string, string> = {
  acopio: 'Acopios',
  refugio: 'Refugios',
  alojamiento: 'Techo',
};

export const ESTADO_COLOR: Record<string, string> = {
  abierto: '#16a34a', // verde
  lleno: '#eab308', // amarillo
  cerrado: '#9ca3af', // gris
};

export const ESTADO_LABEL: Record<string, string> = {
  abierto: 'Activo',
  lleno: 'Lleno',
  cerrado: 'Cerrado',
};

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}
