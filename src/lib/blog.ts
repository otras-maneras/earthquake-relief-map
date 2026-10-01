// Blog de AcopioVE: contenido informativo sobre el terremoto de Venezuela 2026.
// En español (mayor volumen de búsqueda para este evento). Contenido estático,
// renderizado en server para SEO. Datos verificados (USGS + prensa, al 27-06-2026).

export type BlogBlock =
  | { type: 'p'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'h3'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'callout'; text: string }
  | { type: 'quote'; text: string; cite?: string }
  // Destacado editorial (pull-quote) en serif grande.
  | { type: 'pullquote'; text: string; cite?: string }
  // Bloque de cifras (dato duro): pares valor/etiqueta.
  | { type: 'stats'; items: { value: string; label: string }[] }
  | { type: 'cta'; label: string; href: string };

export interface BlogPost {
  slug: string;
  title: string;
  subtitle?: string; // entradilla / standfirst editorial
  byline?: string; // firma (ej. "Redacción AcopioVE")
  location?: string; // lugar (ej. "Caracas")
  description: string; // meta description
  excerpt: string; // resumen en el índice
  date: string; // ISO
  updated?: string; // ISO
  readingMins: number;
  category: string;
  keywords: string[];
  blocks: BlogBlock[];
  faq?: { q: string; a: string }[];
  related: { label: string; href: string }[];
}

export const SITE_URL = 'https://acopiove.org';

export const blogPosts: BlogPost[] = [
  {
    slug: 'suspension-clases-venezuela-terremoto',
    title: '¿Mañana hay clases en Venezuela? Suspensión y estado de las escuelas',
    subtitle:
      'Protección Civil y el Ministerio de Educación evalúan la infraestructura escolar en las zonas más afectadas por el sismo de 7.5 Mw. Conoce el estado oficial de las actividades escolares.',
    byline: 'Redacción AcopioVE',
    location: 'Caracas',
    description:
      '¿Mañana hay clases en Venezuela? Reporte actualizado sobre la suspensión de clases y la evaluación técnica de escuelas tras el terremoto de 2026.',
    excerpt:
      '¿Mañana hay clases en Venezuela? Reporte oficial de suspensión de actividades educativas y evaluación de la infraestructura escolar tras los sismos.',
    date: '2026-06-29',
    readingMins: 4,
    category: 'Servicio Público',
    keywords: [
      'mañana hay clases en venezuela',
      'suspensión de clases en venezuela',
      'terremoto venezuela',
      'terremoto en venezuela',
      'terremoto de venezuela',
      'portuguesa venezuela'
    ],
    blocks: [
      { type: 'p', text: 'Tras el fuerte doblete sísmico del 24 de junio de 2026 que afectó la región centro-norte de Venezuela, una de las preguntas más urgentes de las familias es si se mantendrá la suspensión de clases en el territorio nacional. Los ministerios competentes y los organismos de seguridad vial y civil (Protección Civil y Bomberos) continúan realizando evaluaciones estructurales profundas en planteles públicos y privados.' },
      { type: 'callout', text: 'Estado actual: Las clases presenciales continúan suspendidas en los estados Yaracuy, La Guaira y en sectores específicos de Caracas y Carabobo hasta que finalice la inspección física de las aulas.' },
      { type: 'h2', text: 'Zonas bajo suspensión escolar indefinida' },
      { type: 'p', text: 'Las autoridades educativas han establecido un protocolo de retorno progresivo. Los estados que sufrieron el mayor impacto por la sacudida principal de 7.5 Mw tienen prioridades diferenciadas:' },
      { type: 'ul', items: [
        'Yaracuy y Carabobo: Suspensión total en todos los niveles mientras se revisan grietas en muros y techos de las edificaciones escolares antiguas.',
        'La Guaira: Suspensión absoluta por colapsos estructurales en zonas costeras como Caraballeda y Catia La Mar, donde varios planteles se han habilitado como refugios de contingencia.',
        'Distrito Capital (Caracas): Suspensión focalizada. Las escuelas en zonas con reportes de daños moderados a severos siguen bajo evaluación de bomberos y no recibirán alumnos.'
      ] },
      { type: 'h2', text: '¿Qué ocurre en Portuguesa y otros estados?' },
      { type: 'p', text: 'En estados como Portuguesa, Cojedes y Lara, la sacudida se sintió de forma moderada pero continua debido a las réplicas. El reporte del Ministerio de Educación insta a los directores de zonas educativas locales a coordinar con Protección Civil inspecciones rápidas. Si no hay daños estructurales visibles, se espera un retorno gradual, aunque condicionado por el comportamiento de las réplicas en curso.' },
      { type: 'pullquote', text: 'La seguridad de los estudiantes es la prioridad. Ninguna escuela reabrirá sus puertas si presenta grietas estructurales significativas.' },
      { type: 'h2', text: 'Uso de escuelas como refugios temporales' },
      { type: 'p', text: 'Diversas escuelas y liceos públicos en La Guaira y el oeste de Caracas han sido habilitados temporalmente como albergues y centros de acopio para atender a las familias damnificadas. En estos puntos se concentra la distribución de agua potable, alimentos y medicamentos de primeros auxilios. Puedes consultar qué escuelas están operando en este momento en nuestro mapa interactivo.' },
      { type: 'cta', label: 'Ver mapa de refugios y centros de acopio', href: '/?tipo=refugio' },
      { type: 'h2', text: 'Recomendaciones para padres y representantes' },
      { type: 'ol', items: [
        'Mantente informado únicamente por canales oficiales del Ministerio de Educación y Protección Civil, evitando cadenas falsas en redes sociales.',
        'Verifica si el plantel de tus hijos ha sido designado como centro de acopio o refugio.',
        'Prepara el bolso de emergencia familiar en casa en caso de réplicas continuas.',
        'Reporta cualquier daño estructural visible en escuelas de tu comunidad para que sea inspeccionado por técnicos calificados.'
      ] }
    ],
    faq: [
      { q: '¿Mañana hay clases en Venezuela?', a: 'En los estados Yaracuy, La Guaira y sectores afectados de Caracas y Carabobo, las actividades siguen suspendidas de forma presencial por evaluaciones de seguridad estructural.' },
      { q: '¿Cómo sé si la escuela de mi hijo tiene daños?', a: 'Los equipos de Protección Civil están publicando reportes por municipio. No envíes a tus hijos a clase si el plantel tiene grietas significativas en columnas o paredes.' }
    ],
    related: [
      { label: 'Terremoto en Venezuela 2026: qué pasó', href: '/blog/terremoto-venezuela-2026-que-paso' },
      { label: 'Refugios habilitados en Caracas y La Guaira', href: '/blog/refugios-caracas-la-guaira' }
    ]
  },
  {
    slug: 'terremoto-venezuela-2026-que-paso',
    title: 'Terremoto en Venezuela 2026: qué pasó, magnitud y zonas afectadas',
    subtitle:
      'Dos sismos de magnitud 7,2 y 7,5 con epicentro en Yaracuy golpearon el centro-norte del país en menos de un minuto. La Guaira fue la región más castigada. Esto es lo que se sabe, verificado.',
    byline: 'Redacción AcopioVE',
    location: 'Caracas',
    description:
      'El 24 de junio de 2026 dos terremotos de magnitud 7,2 y 7,5 sacudieron Venezuela. Qué pasó, dónde fue el epicentro, las zonas más afectadas y dónde encontrar ayuda.',
    excerpt:
      'Dos sismos de magnitud 7,2 y 7,5 con epicentro en Yaracuy golpearon el centro-norte del país. Resumen claro de lo que ocurrió y dónde encontrar refugios y ayuda.',
    date: '2026-06-26',
    updated: '2026-06-27',
    readingMins: 5,
    category: 'Qué pasó',
    keywords: [
      'terremoto Venezuela 2026',
      'magnitud terremoto Venezuela',
      'sismo Caracas',
      'terremoto La Guaira',
      'epicentro Yaracuy',
      'réplicas Venezuela',
    ],
    blocks: [
      { type: 'p', text: 'El 24 de junio de 2026, Venezuela sufrió el terremoto más fuerte registrado en más de un siglo. En menos de un minuto, dos sismos de gran magnitud golpearon el centro-norte del país y se sintieron con fuerza en Caracas, La Guaira y buena parte de la región central. Este artículo resume, de forma clara y verificada, qué ocurrió y dónde encontrar ayuda.' },
      { type: 'stats', items: [
        { value: '7,5', label: 'Magnitud principal (Mw)' },
        { value: '39 s', label: 'Entre un sismo y otro' },
        { value: '10 km', label: 'Profundidad del segundo' },
        { value: 'La Guaira', label: 'Región más afectada' },
      ] },
      { type: 'h2', text: 'Un “doblete” sísmico: dos terremotos en 39 segundos' },
      { type: 'p', text: 'No fue un solo evento, sino dos terremotos consecutivos —lo que los sismólogos llaman un doblete—. El primero, de magnitud 7,2 (Mw), ocurrió a las 18:04 hora local, a unos 23 km de San Felipe, en el estado Yaracuy, a 20 km de profundidad. Apenas 39 segundos después, un segundo sismo de magnitud 7,5 (Mw) se produjo a unos 28 km al sureste de Yumare, a solo 10 km de profundidad. Esa poca profundidad del segundo evento explica buena parte de su poder destructivo.' },
      { type: 'callout', text: 'Magnitud principal: 7,5 Mw · Fecha: 24 de junio de 2026, 18:04–18:05 (hora local) · Epicentros: estado Yaracuy (San Felipe y Yumare).' },
      { type: 'h2', text: 'Zonas más afectadas' },
      { type: 'p', text: 'Aunque los epicentros estuvieron en Yaracuy, el estado La Guaira —en la costa, junto a Caracas— fue el más golpeado. Las localidades de Caraballeda y Catia La Mar concentraron el mayor número de colapsos: más de un centenar de edificaciones cayeron o quedaron inhabitables. En Caracas se reportaron daños en edificios residenciales, y el Aeropuerto Internacional de Maiquetía, el principal del país, también resultó afectado.' },
      { type: 'pullquote', text: 'La poca profundidad del segundo sismo —apenas 10 kilómetros— explica buena parte de su poder destructivo.' },
      { type: 'p', text: 'Se emitió además una alerta de tsunami para Aruba, Curazao y Bonaire en las horas posteriores al sismo principal.' },
      { type: 'h2', text: 'Intensidad: cómo se sintió' },
      { type: 'p', text: 'Los mapas de intensidad del Servicio Geológico de Estados Unidos (USGS) muestran sacudidas severas (grado VIII en la escala de Mercalli) en la zona del epicentro y a lo largo de la costa central, con intensidad fuerte a muy fuerte en el área metropolitana de Caracas. Puedes ver estas zonas dibujadas sobre el mapa interactivo de AcopioVE.' },
      { type: 'cta', label: 'Ver el mapa con las zonas de intensidad', href: '/' },
      { type: 'h2', text: 'Réplicas: por qué siguen los temblores' },
      { type: 'p', text: 'Tras un sismo de esta magnitud es normal que se produzcan decenas o cientos de réplicas durante días o semanas. En las primeras madrugadas se identificaron numerosas réplicas de magnitud entre 2,4 y 4,5. Son esperables y, aunque suelen ser menores, pueden derribar estructuras ya debilitadas, por lo que conviene extremar precauciones.' },
      { type: 'h2', text: 'El balance humano (cifras provisionales)' },
      { type: 'p', text: 'Las cifras oficiales y de prensa son provisionales y cambian a medida que avanzan las labores de rescate. Al 26 de junio se reportaban cientos de fallecidos y miles de heridos, además de un número aún indeterminado de personas atrapadas bajo escombros. Recomendamos seguir fuentes oficiales para los datos más recientes y evitar difundir cifras no confirmadas.' },
      { type: 'h2', text: 'Dónde encontrar ayuda ahora' },
      { type: 'p', text: 'AcopioVE mantiene un mapa en vivo y verificado de refugios habilitados, centros de acopio y teléfonos de emergencia. Si necesitas resguardo, llevar donaciones o contactar servicios de emergencia, empieza por ahí.' },
      { type: 'cta', label: 'Ver refugios habilitados', href: '/refugios' },
    ],
    faq: [
      { q: '¿De qué magnitud fue el terremoto de Venezuela de 2026?', a: 'Fueron dos terremotos consecutivos: uno de magnitud 7,2 y otro de 7,5 (Mw), ocurridos con 39 segundos de diferencia el 24 de junio de 2026, con epicentros en el estado Yaracuy.' },
      { q: '¿Cuál fue la zona más afectada?', a: 'El estado La Guaira, especialmente Caraballeda y Catia La Mar, donde colapsaron más de cien edificaciones. También hubo daños importantes en Caracas.' },
      { q: '¿Por qué siguen los temblores?', a: 'Son réplicas, habituales tras un gran sismo. Pueden continuar durante días o semanas y, aunque suelen ser menores, conviene mantener precauciones.' },
    ],
    related: [
      { label: 'Refugios habilitados en Caracas y La Guaira', href: '/blog/refugios-caracas-la-guaira' },
      { label: 'Qué hacer ante las réplicas', href: '/blog/que-hacer-replicas-seguridad-sismica' },
      { label: 'Cómo ayudar a los afectados', href: '/blog/como-ayudar-venezuela-terremoto' },
    ],
  },

  {
    slug: 'refugios-caracas-la-guaira',
    title: 'Refugios habilitados en Caracas y La Guaira tras el terremoto',
    subtitle:
      'Miles de familias necesitan dónde pasar la noche. Dónde están los refugios habilitados, cómo ubicarlos en el mapa en vivo y qué llevar.',
    byline: 'Redacción AcopioVE',
    location: 'Caracas · La Guaira',
    description:
      'Lista actualizada de refugios y puntos de resguardo habilitados en Caracas y La Guaira tras el terremoto de Venezuela 2026. Cómo encontrarlos en el mapa y qué llevar.',
    excerpt:
      'Dónde resguardarse: refugios oficiales y comunitarios habilitados en Caracas y La Guaira, cómo ubicarlos en el mapa en vivo y qué llevar.',
    date: '2026-06-26',
    updated: '2026-06-27',
    readingMins: 4,
    category: 'Refugios',
    keywords: [
      'refugios Caracas',
      'refugios La Guaira',
      'refugios terremoto Venezuela',
      'dónde refugiarse Caracas',
      'albergues terremoto',
    ],
    blocks: [
      { type: 'p', text: 'Tras los terremotos del 24 de junio de 2026, miles de familias cuyas viviendas quedaron dañadas o en zonas de riesgo necesitan un lugar seguro donde pasar la noche. Autoridades locales y la comunidad han habilitado refugios y puntos de resguardo temporal. Aquí te explicamos cómo encontrarlos.' },
      { type: 'callout', text: 'AcopioVE mantiene la lista de refugios actualizada y geolocalizada. Úsala para ver el más cercano y cómo llegar.' },
      { type: 'cta', label: 'Ver todos los refugios en el mapa', href: '/refugios' },
      { type: 'h2', text: 'Refugios en Caracas' },
      { type: 'p', text: 'La Alcaldía de Caracas habilitó centros de resguardo temporal para familias afectadas, e instituciones educativas, deportivas y culturales se sumaron como puntos de apoyo. Entre los espacios habilitados se encuentran complejos deportivos y culturales, estadios, escuelas y plazas en distintas parroquias del oeste, centro y este de la ciudad.' },
      { type: 'ul', items: [
        'Zona oeste y centro: espacios en San Juan, Quinta Crespo, El Paraíso, 23 de Enero, El Cementerio y alrededores.',
        'Zona este: parques y complejos en Petare y zonas aledañas.',
        'San Bernardino: complejo cultural y deportivo habilitado como refugio.',
      ] },
      { type: 'h2', text: 'Refugios en La Guaira' },
      { type: 'p', text: 'Por ser la zona más afectada, La Guaira concentra una parte importante de las necesidades de alojamiento de emergencia. Se han habilitado estadios y puntos de apoyo con servicios básicos como carga de teléfonos, acceso a internet y comida. La lista se actualiza a medida que se confirman nuevos espacios.' },
      { type: 'h2', text: 'Qué llevar a un refugio' },
      { type: 'p', text: 'Si vas a trasladarte a un refugio, en la medida de lo posible lleva contigo lo esencial:' },
      { type: 'ul', items: [
        'Documentos de identidad (cédula, partidas) en una bolsa impermeable.',
        'Agua, algo de comida no perecedera y medicamentos personales.',
        'Cargador y batería externa para el teléfono.',
        'Abrigo, una manta y muda de ropa.',
        'Artículos de higiene y, si aplica, insumos para bebés o adultos mayores.',
      ] },
      { type: 'callout', text: 'Importante: la disponibilidad y el estado de los refugios (abierto, lleno o cerrado) cambian rápido. Confirma en el mapa antes de trasladarte.' },
      { type: 'h2', text: 'Cómo encontrar el refugio más cercano' },
      { type: 'ol', items: [
        'Abre el mapa de AcopioVE y selecciona el filtro “Refugios”.',
        'Usa el botón de ubicación para centrar el mapa en tu posición.',
        'Toca el refugio para ver dirección, estado y cómo llegar.',
      ] },
      { type: 'cta', label: 'Buscar refugios cerca de mí', href: '/?tipo=refugio' },
    ],
    faq: [
      { q: '¿Dónde hay refugios habilitados en Caracas?', a: 'Hay espacios habilitados en distintas parroquias (San Juan, Quinta Crespo, El Paraíso, 23 de Enero, El Cementerio, San Bernardino y Petare, entre otras). La lista geolocalizada y actualizada está en el mapa de AcopioVE.' },
      { q: '¿Qué debo llevar a un refugio?', a: 'Documentos de identidad, agua y comida no perecedera, medicamentos personales, cargador de teléfono, abrigo, manta y artículos de higiene.' },
    ],
    related: [
      { label: 'Terremoto en Venezuela 2026: qué pasó', href: '/blog/terremoto-venezuela-2026-que-paso' },
      { label: 'Qué hacer ante las réplicas', href: '/blog/que-hacer-replicas-seguridad-sismica' },
    ],
  },

  {
    slug: 'que-hacer-replicas-seguridad-sismica',
    title: 'Réplicas y seguridad: qué hacer antes, durante y después de un sismo',
    subtitle:
      'Las réplicas pueden seguir días y derribar estructuras ya debilitadas. Guía clara de qué hacer antes, durante y después, y cómo armar un kit de emergencia.',
    byline: 'Redacción AcopioVE',
    location: 'Venezuela',
    description:
      'Guía práctica de seguridad sísmica: qué hacer durante un terremoto y sus réplicas, cómo proteger a tu familia y cómo preparar un kit de emergencia.',
    excerpt:
      'Las réplicas pueden seguir días. Guía clara de qué hacer antes, durante y después de un sismo, y cómo armar un kit de emergencia.',
    date: '2026-06-26',
    updated: '2026-06-27',
    readingMins: 6,
    category: 'Seguridad',
    keywords: [
      'qué hacer durante un terremoto',
      'qué hacer en una réplica',
      'seguridad sísmica',
      'kit de emergencia terremoto',
      'cómo protegerse de un sismo',
    ],
    blocks: [
      { type: 'p', text: 'Después de un gran terremoto, las réplicas pueden continuar durante días o semanas. Aunque suelen ser de menor magnitud, son peligrosas porque pueden derribar estructuras ya debilitadas. Esta guía resume las recomendaciones básicas de organismos de protección civil para protegerte a ti y a tu familia.' },
      { type: 'h2', text: 'Durante el sismo o una réplica' },
      { type: 'p', text: 'La recomendación internacional más extendida se resume en tres palabras: agáchate, cúbrete y sujétate.' },
      { type: 'ul', items: [
        'Agáchate al suelo antes de que el sismo te tire.',
        'Cúbrete la cabeza y el cuello; si puedes, métete bajo una mesa resistente.',
        'Sujétate de algo firme hasta que pare el movimiento.',
        'Aléjate de ventanas, vidrios, espejos y objetos que puedan caer.',
        'Si estás en cama, quédate y protege tu cabeza con una almohada.',
        'Si estás al aire libre, ve a un espacio abierto lejos de edificios, postes y cables.',
      ] },
      { type: 'callout', text: 'No uses ascensores. No corras hacia las escaleras durante el movimiento: la mayoría de las lesiones ocurren al intentar desplazarse mientras tiembla.' },
      { type: 'h2', text: 'Inmediatamente después' },
      { type: 'ol', items: [
        'Revisa si tú y quienes te rodean están heridos; presta primeros auxilios básicos.',
        'Si hay olor a gas, cierra la llave y no enciendas luces ni fósforos.',
        'Sal con calma a un espacio abierto; prepárate para nuevas réplicas.',
        'Usa calzado cerrado para evitar cortes con vidrios y escombros.',
        'No regreses a edificios dañados hasta que sean evaluados.',
      ] },
      { type: 'h2', text: 'Cuidado con las réplicas' },
      { type: 'p', text: 'Muchas personas resultan heridas al volver a sus casas entre un temblor y otro. Si tu vivienda muestra grietas grandes, columnas o paredes afectadas, o quedó inclinada, no entres: busca un refugio habilitado. Ante la duda, mejor pasar la noche en un espacio seguro.' },
      { type: 'cta', label: 'Buscar un refugio seguro cerca', href: '/refugios' },
      { type: 'h2', text: 'Kit de emergencia básico' },
      { type: 'p', text: 'Tener una mochila lista te ahorra tiempo crítico. Incluye, en lo posible:' },
      { type: 'ul', items: [
        'Agua potable y alimentos no perecederos para varios días.',
        'Linterna, pilas y un silbato para pedir ayuda.',
        'Botiquín de primeros auxilios y tus medicamentos.',
        'Cargador, batería externa y una radio si es posible.',
        'Copia de documentos, algo de efectivo y una manta.',
      ] },
      { type: 'h2', text: 'Teléfonos y contactos de emergencia' },
      { type: 'p', text: 'Ten a mano los números de emergencia y, si te separas de tu familia, acuerden un punto de encuentro. AcopioVE reúne teléfonos de emergencia y canales para el restablecimiento del contacto familiar.' },
      { type: 'cta', label: 'Ver teléfonos de emergencia', href: '/?modal=telefonos' },
    ],
    faq: [
      { q: '¿Qué hago durante una réplica?', a: 'Agáchate, cúbrete la cabeza y el cuello, y sujétate de algo firme. Aléjate de ventanas y objetos que puedan caer. No uses ascensores ni corras mientras tiembla.' },
      { q: '¿Puedo volver a mi casa entre réplicas?', a: 'Solo si no presenta daños estructurales (grietas grandes, columnas o paredes afectadas, inclinación). Ante la duda, busca un refugio habilitado.' },
      { q: '¿Qué debe tener un kit de emergencia?', a: 'Agua, comida no perecedera, linterna, pilas, botiquín, medicamentos, cargador/batería, copia de documentos, efectivo y una manta.' },
    ],
    related: [
      { label: 'Refugios habilitados en Caracas y La Guaira', href: '/blog/refugios-caracas-la-guaira' },
      { label: 'Terremoto en Venezuela 2026: qué pasó', href: '/blog/terremoto-venezuela-2026-que-paso' },
    ],
  },

  {
    slug: 'como-ayudar-venezuela-terremoto',
    title: 'Cómo ayudar a los afectados por el terremoto en Venezuela',
    subtitle:
      'Desde dentro del país o desde el exterior: qué donar, dónde llevarlo, cómo enviarlo a través de la diáspora y a qué organizaciones verificadas apoyar.',
    byline: 'Redacción AcopioVE',
    location: 'Venezuela',
    description:
      'Guía para ayudar tras el terremoto de Venezuela 2026: qué donar, dónde llevarlo, cómo enviar ayuda desde el exterior y a qué organizaciones verificadas apoyar.',
    excerpt:
      'Desde dentro o desde el exterior: qué donar, dónde llevarlo, cómo enviarlo a través de la diáspora y qué organizaciones verificadas apoyar.',
    date: '2026-06-26',
    updated: '2026-06-27',
    readingMins: 5,
    category: 'Cómo ayudar',
    keywords: [
      'cómo ayudar Venezuela terremoto',
      'donar Venezuela',
      'ayuda humanitaria Venezuela',
      'enviar ayuda Venezuela desde el exterior',
      'centros de acopio Venezuela',
    ],
    blocks: [
      { type: 'p', text: 'La solidaridad es enorme tras el terremoto, pero para que la ayuda sea efectiva conviene canalizarla bien: donar lo que realmente se necesita, llevarlo a puntos verificados y, si estás fuera del país, usar canales confiables. Aquí tienes una guía práctica, estés donde estés.' },
      { type: 'h2', text: 'Qué se necesita con más urgencia' },
      { type: 'ul', items: [
        'Agua potable embotellada.',
        'Alimentos no perecederos (arroz, pasta, granos, enlatados).',
        'Medicamentos básicos e insumos de primeros auxilios.',
        'Artículos de higiene personal y pañales (bebé y adulto).',
        'Mantas, cobijas y ropa en buen estado.',
        'Linternas, pilas y herramientas básicas para remoción de escombros.',
      ] },
      { type: 'callout', text: 'Evita donar ropa muy usada, medicamentos vencidos o alimentos perecederos: generan más trabajo del que ayudan. Ante la duda, consulta qué pide cada centro.' },
      { type: 'h2', text: 'Si estás en Venezuela: lleva tu donación a un centro de acopio' },
      { type: 'p', text: 'Los centros de acopio reciben y organizan las donaciones para hacerlas llegar a las zonas afectadas. En el mapa de AcopioVE puedes ver el centro más cercano, qué recibe y su estado actual.' },
      { type: 'cta', label: 'Ver centros de acopio en el mapa', href: '/centros' },
      { type: 'h2', text: 'Si estás en el exterior: envía a través de la diáspora' },
      { type: 'p', text: 'La diáspora venezolana organizada es uno de los canales más eficaces para hacer llegar ayuda. Hay coordinadores verificados en Estados Unidos, Europa y América Latina que agrupan donaciones y gestionan los envíos hacia Venezuela.' },
      { type: 'cta', label: 'Ver contactos de logística de la diáspora', href: '/?modal=coordinadores' },
      { type: 'h2', text: 'Donar a organizaciones verificadas' },
      { type: 'p', text: 'Si prefieres aportar económicamente, hazlo a organizaciones serias que estén respondiendo en el terreno. AcopioVE reúne canales oficiales de donación, como World Central Kitchen (comidas calientes) y Cáritas Venezuela (asistencia humanitaria).' },
      { type: 'cta', label: 'Ver canales oficiales de donación', href: '/?modal=donaciones' },
      { type: 'h2', text: 'Otras formas de ayudar' },
      { type: 'ul', items: [
        'Ofrecer alojamiento temporal (“techo solidario”) si tienes un espacio disponible.',
        'Sumarte como voluntario intérprete o apoyo remoto.',
        'Compartir información verificada y desmentir rumores.',
        'Reportar nuevos centros, refugios o necesidades en el mapa.',
      ] },
      { type: 'callout', text: 'Cuidado con las estafas: dona solo a través de canales y organizaciones verificadas. Desconfía de cuentas nuevas que piden transferencias urgentes.' },
      { type: 'cta', label: 'Quiero ayudar desde el exterior', href: '/donate' },
    ],
    faq: [
      { q: '¿Qué es lo más útil para donar?', a: 'Agua potable, alimentos no perecederos, medicamentos e insumos de primeros auxilios, artículos de higiene, pañales, mantas y ropa en buen estado.' },
      { q: '¿Cómo envío ayuda desde el exterior?', a: 'A través de los coordinadores de logística de la diáspora (en EE. UU., Europa y América Latina) o donando a organizaciones verificadas. Ambos canales están listados en AcopioVE.' },
      { q: '¿Cómo evito estafas al donar?', a: 'Dona solo a organizaciones y canales verificados. Desconfía de cuentas nuevas o mensajes que exigen transferencias urgentes a particulares.' },
    ],
    related: [
      { label: 'Refugios habilitados en Caracas y La Guaira', href: '/blog/refugios-caracas-la-guaira' },
      { label: 'Terremoto en Venezuela 2026: qué pasó', href: '/blog/terremoto-venezuela-2026-que-paso' },
    ],
  },
];

export function getPost(slug: string): BlogPost | undefined {
  return blogPosts.find((p) => p.slug === slug);
}
