// Canales y organizaciones OFICIALES verificadas para donar.
// Fuente única usada por el modal de Donaciones (mapa, ES) y la landing /donate (intl).
// Se irán sumando a medida que se compartan fuentes confiables.

export interface Donacion {
  name: string;
  description: string; // ES (modal)
  url: string;
  category: string; // ES (modal)
  logo: string; // ruta local en /public/donantes
}

export const donaciones: Donacion[] = [
  {
    name: 'World Central Kitchen',
    description:
      'Comidas calientes para familias afectadas. Iniciativa del chef José Andrés, con equipo de respuesta desplegado para la emergencia en Venezuela.',
    url: 'https://donate.wck.org/team/835442',
    category: 'Internacional · Comida',
    logo: '/donantes/wck.png',
  },
  {
    name: 'Cáritas Venezuela',
    description:
      'Red humanitaria de la Iglesia Católica. Asiste a familias vulnerables en todo el país con salud, alimentación y respuesta a emergencias.',
    url: 'https://caritasvenezuela.org/donaciones/',
    category: 'Nacional · Humanitaria',
    logo: '/donantes/caritas.png',
  },
  {
    name: 'Yummy Rides',
    description:
      'Campaña “Dona con Yummy” de la app venezolana de movilidad, para canalizar ayuda directa a los afectados por el terremoto.',
    url: 'https://dona.yummyrides.com/',
    category: 'Nacional · App solidaria',
    logo: '/donantes/yummy.svg',
  },
];
