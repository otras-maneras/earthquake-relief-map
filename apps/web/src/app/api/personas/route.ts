import { NextResponse } from 'next/server';
import { blockedFor, hit, clientIp } from '@/lib/ratelimit';
import { getDemanoItems } from '@/lib/demano';
import {
  isPersonasLookupActive,
  parsePersonasLookupInput,
} from '@/lib/api/personas-search-input';
import { searchReportaVnzlaPersonas, maskCedulaPublic } from '@/lib/api/reportavnzla-personas';
import { getHelpmapPersonas } from '@/lib/api/helpmap-personas';
import { normalizeSearchText } from '@/lib/text';

export const dynamic = 'force-dynamic';

// Los datos simulados (mocks) son solo para desarrollo/visualización local. En
// producción NUNCA se sirven: si una fuente externa cae, se muestra vacío, no ficción.
const ALLOW_MOCKS = process.env.NODE_ENV !== 'production';

// Placeholder de ubicación para menores de edad (salvaguarda de PII: "menores sin
// ubicación"). Reemplaza el lugar textual y se omiten sus coordenadas.
const UBICACION_MENOR = 'Ubicación reservada (menor de edad)';

/** Dígitos crudos de una cédula, o '' si no hay al menos 3. Uso INTERNO (dedup/búsqueda). */
function cedulaDigits(raw: unknown): string {
  const d = raw != null ? String(raw).replace(/\D/g, '') : '';
  return d.length >= 3 ? d : '';
}


// Coordenadas aproximadas de hospitales y lugares de referencia
const HOSPITAL_COORDS: Record<string, { lat: number; lng: number }> = {
  'hospital-domingo-luciani': { lat: 10.4828, lng: -66.8123 },
  'hospital-perez-carreno': { lat: 10.4721, lng: -66.9634 },
  'hospital-vargas-de-caracas': { lat: 10.5147, lng: -66.9142 },
  'hospital-jose-maria-vargas-la-guaira': { lat: 10.6015, lng: -66.9322 },
  'clinica-el-avila': { lat: 10.4975, lng: -66.8488 },
  'periferico-de-catia': { lat: 10.5218, lng: -66.9367 },
  'alcaldia-de-chacao': { lat: 10.4906, lng: -66.8525 },
  'campo-de-golf-caribe-sobrevivientes-playa-los-cocos': { lat: 10.6138, lng: -66.8776 },
};

// Coordenadas de centroide para parroquias/zonas de La Guaira y Caracas
const PARROQUIA_COORDS = [
  { key: 'caraballeda', lat: 10.6103, lng: -66.8547 },
  { key: 'catia la mar', lat: 10.5986, lng: -67.0267 },
  { key: 'macuto', lat: 10.5925, lng: -66.9036 },
  { key: 'naiguata', lat: 10.6083, lng: -66.7386 },
  { key: 'maiquetia', lat: 10.5997, lng: -66.9531 },
  { key: 'la guaira', lat: 10.6012, lng: -66.9308 },
  { key: 'caracas', lat: 10.4806, lng: -66.9036 },
  { key: 'chacao', lat: 10.4906, lng: -66.8525 },
  { key: 'el valle', lat: 10.4578, lng: -66.9092 },
  { key: 'altamira', lat: 10.4961, lng: -66.8475 },
];

const CATEGORY_LABELS: Record<string, string> = {
  electricity: 'Corte de Electricidad',
  water: 'Falta de Agua',
  medicine: 'Escasez de Medicinas',
  food: 'Falta de Alimentos',
  fuel: 'Escasez de Combustible',
  telecoms: 'Falla de Telecomunicaciones',
  other: 'Otro Reporte de Servicio',
};

function categoryLabel(cat: string | null | undefined): string {
  if (!cat) return 'Reporte de Servicio';
  return CATEGORY_LABELS[cat] || cat;
}

// Etiquetas legibles para categorías de ayuda del hub Venezuela Ayuda
const HUB_CATEGORY_LABELS: Record<string, string> = {
  rescue: 'Rescate',
  medical: 'Atención Médica',
  medicine: 'Medicinas',
  food: 'Alimentos',
  water: 'Agua',
  shelter: 'Refugio',
  transport: 'Transporte',
  transportation: 'Transporte',
  translation: 'Traducción',
  clothing: 'Ropa',
  fuel: 'Combustible',
  volunteer: 'Voluntariado',
  other: 'Otro',
};

function hubCategoryLabel(cat: string | null | undefined): string {
  if (!cat) return 'General';
  return HUB_CATEGORY_LABELS[cat] || cat;
}

function geocodeHospitalName(name: string | null | undefined): { lat: number; lng: number } | null {
  if (!name) return null;
  const n = name.toLowerCase();
  if (n.includes('luciani')) return HOSPITAL_COORDS['hospital-domingo-luciani'];
  if (n.includes('perez') || n.includes('carreño') || n.includes('carreno') || n.includes('pérez')) return HOSPITAL_COORDS['hospital-perez-carreno'];
  if (n.includes('vargas') && (n.includes('la guaira') || n.includes('guaira') || n.includes('vargas-la-guaira'))) return HOSPITAL_COORDS['hospital-jose-maria-vargas-la-guaira'];
  if (n.includes('vargas')) return HOSPITAL_COORDS['hospital-vargas-de-caracas'];
  if (n.includes('catia') || n.includes('periferico') || n.includes('periférico')) return HOSPITAL_COORDS['periferico-de-catia'];
  if (n.includes('avila') || n.includes('ávila')) return HOSPITAL_COORDS['clinica-el-avila'];
  if (n.includes('caribia')) return { lat: 10.4750, lng: -66.9700 };
  if (n.includes('pariata')) return { lat: 10.6020, lng: -66.9680 };
  return null;
}

function geocodePerson(tipo: 'localizado' | 'desaparecido', lugarSlug: string, lugarNombre: string, parroquiaText: string) {
  if (tipo === 'localizado' && lugarSlug) {
    const slug = lugarSlug.toLowerCase();
    if (HOSPITAL_COORDS[slug]) {
      return HOSPITAL_COORDS[slug];
    }
    // Búsqueda por palabra clave en el slug del lugar
    for (const [key, coords] of Object.entries(HOSPITAL_COORDS)) {
      if (slug.includes(key) || key.includes(slug)) {
        return coords;
      }
    }
  }

  // Búsqueda por texto en lugarNombre o parroquiaText
  const text = `${lugarNombre} ${parroquiaText}`.toLowerCase();
  for (const p of PARROQUIA_COORDS) {
    if (text.includes(p.key)) {
      return { lat: p.lat, lng: p.lng };
    }
  }

  // Fallback si contiene "la guaira"
  if (text.includes('guaira')) {
    return { lat: 10.6012, lng: -66.9308 };
  }
  // Fallback general Caracas
  if (text.includes('caracas') || text.includes('capital') || text.includes('chacao') || text.includes('baruta')) {
    return { lat: 10.4806, lng: -66.9036 };
  }

  return null;
}

export async function GET(request: Request) {
  const key = `get-personas:${clientIp(request)}`;
  if (blockedFor(key) > 0) return NextResponse.json({ error: 'Demasiadas solicitudes.' }, { status: 429 });
  hit(key, 45, 60_000, 5 * 60_000); // 45/min por IP → bloqueo 5 min

  const { searchParams } = new URL(request.url);
  const qParam = (searchParams.get('q') || '').trim();
  const cedulaParam = (searchParams.get('cedula') || '').trim();
  const lookup = cedulaParam
    ? { cedula: cedulaParam.replace(/\D/g, '') }
    : parsePersonasLookupInput(qParam);
  const isSearch = isPersonasLookupActive(lookup);
  const qFilter = lookup.q ? normalizeSearchText(lookup.q) : '';

  // Llamadas en paralelo: en modo búsqueda solo fuentes de personas (+ ReportaVNZLA on-demand).
  const [sosResult, locResult, repResult, insuResult, danosResult, civisResult, hubResult, , ayudaVzlaResult, redhResult, demanoResult, reportaVnzlaResult, helpmapResult] = await Promise.all([
    fetch('https://sosvenezuela2026.com/api/persons/list?offset=0&limit=3000', {
      next: { revalidate: 60 },
    })
      .then((res) => (res.ok ? res.json() : []))
      .catch((err) => {
        console.error('Error fetching SOS Venezuela:', err);
        return [];
      }),
    fetch('https://localizadosvenezuela.com/api/v1/localizados?page=1&limit=3000', {
      next: { revalidate: 60 },
    })
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .catch((err) => {
        console.error('Error fetching Localizados:', err);
        return { data: [] };
      }),
    (async () => {
      if (isSearch) return null;
      const apiUrl = process.env.REPORTE_VE_API_URL;
      if (!apiUrl) return null;
      try {
        const res = await fetch(`${apiUrl}/api/reports?sinceHours=336`, {
          next: { revalidate: 60 },
        });
        return res.ok ? await res.json() : null;
      } catch (err) {
        console.error('Error fetching Reporte VE:', err);
        return null;
      }
    })(),
    (async () => {
      if (isSearch) return null;
      const apiUrl = process.env.INSU_CENTROS_API_URL;
      if (!apiUrl) return null;
      try {
        const res = await fetch(`${apiUrl}/centros`, {
          next: { revalidate: 60 },
        });
        return res.ok ? await res.json() : null;
      } catch (err) {
        console.error('Error fetching VnzlCentrosDeInsumos:', err);
        return null;
      }
    })(),
    (async () => {
      if (isSearch) return null;
      const apiUrl = process.env.DANOS_EDIFICIOS_API_URL;
      const apiKey = process.env.DANOS_EDIFICIOS_API_KEY;
      if (!apiUrl || !apiKey) return null; // sin credencial configurada: se degrada (sin capa de daños)
      try {
        const res = await fetch(`${apiUrl}?select=id,name,address,city,zone,lat,lng,damage_level,status,main_photo_url,media_urls,last_updated_at,has_missing_persons&order=last_updated_at.desc`, {
          headers: { apikey: apiKey },
          next: { revalidate: 60 },
        });
        return res.ok ? await res.json() : null;
      } catch (err) {
        console.error('Error fetching Mapa de Daños:', err);
        return null;
      }
    })(),
    isSearch
      ? Promise.resolve({ puntos: [] })
      : fetch('https://civisvenezuela.com/api/puntos', {
          next: { revalidate: 60 },
        })
          .then((res) => (res.ok ? res.json() : { puntos: [] }))
          .catch((err) => {
            console.error('Error fetching CIVIS puntos:', err);
            return { puntos: [] };
          }),
    // Hub central "Venezuela Ayuda" (terremoto.hazlohoy.org). Se excluye
    // 'damaged_building' porque esos daños ya se integran directo desde
    // terremotovenezuela.com (fuente #5) y se duplicarían en el mapa.
    (async () => {
      const base = process.env.HUB_AYUDA_API_URL || 'https://terremoto.hazlohoy.org';
      const types = (isSearch
        ? ['missing_person', 'checkin']
        : ['missing_person', 'checkin', 'help_request', 'help_offer']) as readonly (
        | 'missing_person'
        | 'checkin'
        | 'help_request'
        | 'help_offer'
      )[];
      try {
        const results = await Promise.all(
          types.map(async (t) => {
            try {
              const res = await fetch(`${base}/api/v1/reports?type=${t}&limit=3000`, {
                next: { revalidate: 60 },
              });
              if (!res.ok) return [t, []] as const;
              const body = await res.json();
              return [t, Array.isArray(body?.reports) ? body.reports : []] as const;
            } catch {
              return [t, []] as const;
            }
          })
        );
        return Object.fromEntries(results) as Record<string, any[]>;
      } catch (err) {
        console.error('Error fetching Hub Venezuela Ayuda:', err);
        return null;
      }
    })(),
    // ResponseGrid REMOVIDO: su API responde pero las 'needs' vienen vacías (0),
    // no aporta data. Se deja como null (sin llamar la API) para conservar el
    // orden posicional del Promise.all.
    (async () => null)(),
    // 9. Ayuda Venezuela (API HTTP con Key de Desarrollador)
    (async () => {
      const apiKey = process.env.AYUDA_VENEZUELA_API_KEY;
      if (!apiKey) return null; // sin credencial configurada: se degrada (sin esta fuente)
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);
        const url =
          isSearch && lookup.q
            ? `https://ayudavenezuela.online/api/v1/desaparecidos?nombre=${encodeURIComponent(lookup.q)}&limit=100`
            : isSearch
              ? 'https://ayudavenezuela.online/api/v1/desaparecidos?limit=50'
              : 'https://ayudavenezuela.online/api/v1/desaparecidos?limit=100';

        const res = await fetch(url, {
          headers: {
            'X-API-Key': apiKey,
          },
          signal: controller.signal,
          next: { revalidate: 60 },
        });
        clearTimeout(timeoutId);
        if (!res.ok) return null;
        const data = await res.json();
        return data?.items || [];
      } catch (err) {
        console.error('Error fetching Ayuda Venezuela developer API:', err);
        return null;
      }
    })(),
    // 10. REDH AVAPRE (Red de Ayuda Hospitalaria)
    fetch('https://api-redh.avapre.com/api/v1/public/missing-persons?limit=3000', {
      next: { revalidate: 60 },
    })
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .catch((err) => {
        console.error('Error fetching REDH AVAPRE:', err);
        return { data: [] };
      }),
    // 11. De Mano en Mano (necesidades de insumos por unidad hospitalaria)
    isSearch
      ? Promise.resolve([])
      : getDemanoItems().catch((err) => {
          console.error('Error fetching De Mano en Mano:', err);
          return [];
        }),
    isSearch
      ? searchReportaVnzlaPersonas({ q: lookup.q, cedula: lookup.cedula, limit: 50 })
      : Promise.resolve([]),
    // HelpMap Venezuela (pacientes verificados de hospitales). APAGADA salvo que
    // HELPMAP_PATIENTS_URL esté configurada — devuelve [] si no. En búsqueda filtra
    // server-side con q; en browse trae el conjunto (acotado).
    getHelpmapPersonas(isSearch ? { q: lookup.q || cedulaParam || undefined } : undefined).catch((err) => {
      console.error('Error fetching HelpMap:', err);
      return [] as Record<string, unknown>[];
    }),
  ]);

  const persons: any[] = [];

  // 1. Procesar SOS Venezuela (desaparecidos/localizados reportados)
  const sosData = Array.isArray(sosResult) ? sosResult : [];
  for (const p of sosData) {
    const coords = geocodePerson('desaparecido', '', '', p.parroquia || '');
    persons.push({
      id: p.id,
      nombre: p.display_name,
      cedula: p.cedula_masked || null,
      status: p.status === 'found_alive' ? 'Localizado' : 'Desaparecido',
      lugar: p.parroquia || p.hospital_name || 'Desconocido',
      observaciones: p.hospital_name ? `Hospital: ${p.hospital_name}` : null,
      foto: p.photo_path || null,
      fuente: 'SOS Venezuela',
      tipo: p.status === 'found_alive' ? 'localizado' : 'desaparecido',
      edad: typeof p.age === 'number' ? p.age : null,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
      fecha: p.source_date || null,
    });
  }

  // 2. Procesar Localizados
  const locData = locResult && Array.isArray(locResult.data) ? locResult.data : [];
  for (const p of locData) {
    const coords = geocodePerson('localizado', p.lugarSlug || '', p.lugarNombre || '', p.direccion || '');
    persons.push({
      id: p.slug,
      nombre: p.nombreCompleto,
      cedula: p.cedula || null,
      status: 'Localizado',
      lugar: p.lugarNombre || 'Desconocido',
      observaciones: p.observaciones || null,
      foto: null,
      fuente: p.fuente?.nombre ? `Localizados (${p.fuente.nombre})` : 'Localizados Venezuela',
      tipo: 'localizado',
      edad: typeof p.edad === 'number' ? p.edad : null,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
      fecha: p.publicadoEn || null,
    });
  }

  // 3. Procesar Reporte VE (Servicios/Outages)
  const reportsData = repResult && Array.isArray(repResult.data) ? repResult.data : [];
  if (reportsData.length > 0) {
    for (const r of reportsData) {
      persons.push({
        id: `rep-${r.id}`,
        nombre: `[${categoryLabel(r.category)}] - ${r.parroquia || r.municipio || r.estado}`,
        cedula: null,
        status: categoryLabel(r.category),
        lugar: `${r.estado || ''} ${r.municipio ? `· ${r.municipio}` : ''} ${r.parroquia ? `· ${r.parroquia}` : ''}`.trim() || 'Venezuela',
        observaciones: r.summary || null,
        foto: (r.media && r.media[0]) || null,
        fuente: 'Reporte VE',
        tipo: 'reporte_ve',
        category: r.category || 'other',
        lat: r.lat ?? null,
        lng: r.lng ?? null,
        fecha: r.publishedAt || r.createdAt || null,
      });
    }
  } else {
    // Si no está configurada la API o devuelve vacío, cargamos reportes simulados (mocks) para pruebas locales
    if (!isSearch && ALLOW_MOCKS) {
    const mockReports = [
      {
        id: 'mock-1',
        category: 'electricity',
        summary: 'Falla total del servicio eléctrico tras réplica fuerte. Sin luz desde hace 18 horas.',
        lugar: 'La Guaira · Caraballeda',
        lat: 10.6120,
        lng: -66.8530,
        fecha: new Date().toISOString(),
      },
      {
        id: 'mock-2',
        category: 'water',
        summary: 'Tubería principal de aducción fracturada en Playa Grande. Sin suministro de agua potable.',
        lugar: 'La Guaira · Catia La Mar',
        lat: 10.6010,
        lng: -67.0220,
        fecha: new Date().toISOString(),
      },
      {
        id: 'mock-3',
        category: 'medicine',
        summary: 'CDI Naiguatá reporta escasez crítica de analgésicos, gasas y material de sutura para atender heridos.',
        lugar: 'La Guaira · Naiguatá',
        lat: 10.6090,
        lng: -66.7410,
        fecha: new Date().toISOString(),
      },
      {
        id: 'mock-4',
        category: 'food',
        summary: 'Albergue en escuela local requiere víveres secos, agua embotellada y pañales desechables.',
        lugar: 'La Guaira · Maiquetía',
        lat: 10.5980,
        lng: -66.9510,
        fecha: new Date().toISOString(),
      },
      {
        id: 'mock-5',
        category: 'telecoms',
        summary: 'Señal de telefonía móvil caída (Movilnet/Digitel) en la zona alta de El Valle.',
        lugar: 'Distrito Capital · Caracas · El Valle',
        lat: 10.4590,
        lng: -66.9080,
        fecha: new Date().toISOString(),
      },
    ];
    for (const r of mockReports) {
      persons.push({
        id: r.id,
        nombre: `[${categoryLabel(r.category)}] - ${r.lugar}`,
        cedula: null,
        status: categoryLabel(r.category),
        lugar: r.lugar,
        observaciones: r.summary,
        foto: null,
        fuente: 'Reporte VE (Simulado)',
        tipo: 'reporte_ve',
        category: r.category,
        lat: r.lat,
        lng: r.lng,
        fecha: r.fecha,
      });
    }
    }
  }

  // 4. Procesar Centros de Insumos (VnzlCentrosDeInsumos)
  const insuData = Array.isArray(insuResult) ? insuResult : [];
  if (insuData.length > 0) {
    for (const c of insuData) {
      const insumosStr = Array.isArray(c.insumos) && c.insumos.length > 0
        ? `Insumos: ${c.insumos.map((i: any) => `${i.nombre} (${i.cantidadTotal})`).join(', ')}`
        : 'Sin insumos registrados aún.';
      persons.push({
        id: `insu-${c.id}`,
        nombre: c.nombre,
        cedula: null,
        status: 'Centro de Insumos',
        lugar: `${c.estado || ''} ${c.ciudad ? `· ${c.ciudad}` : ''} ${c.direccion ? `· ${c.direccion}` : ''}`.trim(),
        observaciones: insumosStr,
        foto: null,
        fuente: 'Centros de Insumos (API)',
        tipo: 'insumos', // Se categoriza como 'insumos' para capa independiente
        lat: c.latitud ?? null,
        lng: c.longitud ?? null,
        fecha: c.creadoEn || null,
      });
    }
  } else if (!isSearch && ALLOW_MOCKS) {
    // Si no está configurada la API, inyectamos un mock para visualización y verificación
    persons.push({
      id: 'insu-mock-1',
      nombre: 'Centro de Insumos - Cruz Roja La Guaira',
      cedula: null,
      status: 'Centro de Insumos',
      lugar: 'La Guaira · Macuto · Av. Intercomunal',
      observaciones: 'Insumos disponibles: Kits de primeros auxilios (150), Mantas (300), Agua mineral (800)',
      foto: null,
      fuente: 'Centros de Insumos (Simulado)',
      tipo: 'insumos',
      lat: 10.5910,
      lng: -66.8850,
      fecha: new Date().toISOString(),
    });
  }

  // 5. Procesar Mapa de Daños de Edificios (terremotovenezuela.com)
  const danosData = Array.isArray(danosResult) ? danosResult : [];
  if (danosData.length > 0) {
    for (const b of danosData) {
      persons.push({
        id: `danos-${b.id}`,
        nombre: `[Daño Edificio: ${b.damage_level === 'total' ? 'Total' : b.damage_level === 'parcial' ? 'Parcial' : b.damage_level || 'Reportado'}] - ${b.name}`,
        cedula: null,
        status: b.damage_level === 'total' ? 'Daño Total' : 'Daño Estructural',
        lugar: `${b.city || ''} ${b.zone ? `· ${b.zone}` : ''} ${b.address ? `· ${b.address}` : ''}`.trim(),
        observaciones: `Revisión: ${b.status || 'Pendiente'}. Desaparecidos reportados en el sitio: ${b.has_missing_persons ? 'Sí' : 'No'}.`,
        foto: b.main_photo_url || null,
        fuente: 'Mapa de Daños Venezuela',
        tipo: 'danos', // Categoría propia independiente 'danos'
        category: 'other',
        lat: b.lat ?? null,
        lng: b.lng ?? null,
        fecha: b.last_updated_at || null,
      });
    }
  } else if (!isSearch && ALLOW_MOCKS) {
    // Mock de fallback
    persons.push({
      id: 'danos-mock-1',
      nombre: '[Daño Edificio: Total] - Residencias Aquarium',
      cedula: null,
      status: 'Daño Total',
      lugar: 'Catia La Mar · Av. La Atlántida, La Guaira',
      observaciones: 'Revisión: En revisión. Desaparecidos en el sitio: No.',
      foto: 'https://jckifxsdlnsvbztxydes.supabase.co/storage/v1/object/public/damage-media/reports/4d9f6042-310e-47ec-ab94-27e87bdb542d.jpeg',
      fuente: 'Mapa de Daños (Simulado)',
      tipo: 'danos',
      category: 'other',
      lat: 10.6093,
      lng: -67.0314,
      fecha: new Date().toISOString(),
    });
  }

  // 6. Procesar Puntos de Salud y Atención de CIVIS Venezuela (civisvenezuela.com)
  const civisData = Array.isArray(civisResult?.puntos) ? civisResult.puntos : [];
  for (const p of civisData) {
    persons.push({
      id: `civis-${p.id}`,
      nombre: p.nombre,
      cedula: null,
      status: p.estado === 'abierto' ? 'Abierto' : 'Punto de Atención',
      lugar: p.direccion || 'Venezuela',
      observaciones: p.detalle || 'Centro de atención médica verificado.',
      foto: null,
      fuente: 'CIVIS Venezuela',
      tipo: 'localizado', // Agrupado bajo Localizados (Salud)
      lat: p.ubicacion?.lat ?? null,
      lng: p.ubicacion?.lng ?? null,
      fecha: p.actualizadoEn || null,
    });
  }

  // 7. Procesar Hub central "Venezuela Ayuda" (terremoto.hazlohoy.org)
  //    Capa propia 'hub'. Sub-categoría 'oferta' para help_offer (sub-toggle en el cliente).
  if (hubResult) {
    // 7a. Personas desaparecidas reportadas en el hub (venezuelatebusca.com, etc.)
    for (const r of hubResult.missing_person || []) {
      persons.push({
        id: `hub-mp-${r.id}`,
        nombre: r.name || 'Persona sin nombre',
        cedula: null,
        status: 'Desaparecido',
        lugar: r.place_name || r.city || 'Venezuela',
        observaciones: r.message || null,
        foto: r.photo_url || null,
        fuente: r.source ? `Venezuela Ayuda (${r.source})` : 'Venezuela Ayuda',
        tipo: 'hub',
        category: 'desaparecido',
        lat: r.latitude ?? null,
        lng: r.longitude ?? null,
        fecha: r.created_at || null,
      });
    }
    // 7b. Check-ins de personas a salvo
    for (const r of hubResult.checkin || []) {
      persons.push({
        id: `hub-ci-${r.id}`,
        nombre: r.name || 'Persona a salvo',
        cedula: null,
        status: r.status === 'SAFE' ? 'A salvo' : (r.status || 'Reporte'),
        lugar: r.place_name || r.city || 'Venezuela',
        observaciones: r.message || null,
        foto: r.photo_url || null,
        fuente: r.source ? `Venezuela Ayuda (${r.source})` : 'Venezuela Ayuda',
        tipo: 'hub',
        category: 'checkin',
        lat: r.latitude ?? null,
        lng: r.longitude ?? null,
        fecha: r.created_at || null,
      });
    }
    // 7c. Solicitudes de ayuda (necesidades)
    for (const r of hubResult.help_request || []) {
      persons.push({
        id: `hub-hr-${r.id}`,
        nombre: `[Solicita: ${hubCategoryLabel(r.category)}] - ${r.place_name || r.city || 'Venezuela'}`,
        cedula: null,
        status: r.urgency === 'CRITICAL' ? 'Solicitud Crítica' : 'Solicitud de Ayuda',
        lugar: r.place_name || r.city || 'Venezuela',
        observaciones: r.description || null,
        foto: null,
        fuente: r.source ? `Venezuela Ayuda (${r.source})` : 'Venezuela Ayuda',
        tipo: 'hub',
        category: 'solicitud',
        lat: r.latitude ?? null,
        lng: r.longitude ?? null,
        fecha: r.created_at || null,
      });
    }
    // 7d. Ofertas de ayuda (sub-categoría 'oferta', controlable con sub-toggle)
    for (const r of hubResult.help_offer || []) {
      persons.push({
        id: `hub-ho-${r.id}`,
        nombre: `[Ofrece: ${hubCategoryLabel(r.category)}] - ${r.city || 'Venezuela'}`,
        cedula: null,
        status: 'Oferta de Ayuda',
        lugar: r.city || 'Venezuela',
        observaciones: r.description || r.availability || null,
        foto: null,
        fuente: r.source ? `Venezuela Ayuda (${r.source})` : 'Venezuela Ayuda',
        tipo: 'hub',
        category: 'oferta',
        lat: r.latitude ?? null,
        lng: r.longitude ?? null,
        fecha: r.created_at || null,
      });
    }
  }

  // ResponseGrid removido (su API no devolvía necesidades; venían vacías).

  // 9. Procesar Terremoto Venezuela (API Hospitalizados)
  let ayudaVzlaData: any[] = [];
  if (ayudaVzlaResult && Array.isArray(ayudaVzlaResult) && ayudaVzlaResult.length > 0) {
    ayudaVzlaData = ayudaVzlaResult.map((p: any) => {
      // Intentar geocodificar por hospital si está hospitalizado, o por última ubicación conocida
      let coords: { lat: number; lng: number } | null = null;
      if (p.estado === 'hospitalizado' && p.hospital) {
        coords = geocodeHospitalName(p.hospital);
      }
      if (!coords && p.ultima_ubicacion_conocida) {
        coords = geocodePerson(
          p.estado === 'localizado' ? 'localizado' : 'desaparecido',
          '',
          '',
          p.ultima_ubicacion_conocida
        );
      }

      // Si no logramos geocodificar, dar un fallback según sector
      if (!coords && p.sector) {
        coords = geocodePerson('desaparecido', '', '', p.sector);
      }

      // URL absoluta de la foto
      const foto = p.foto_url
        ? (p.foto_url.startsWith('http')
          ? p.foto_url
          : `https://ayudavenezuela.online${p.foto_url}`)
        : null;

      // Estado unificado
      let mappedStatus = 'Reportado';
      if (p.estado === 'hospitalizado') mappedStatus = 'Hospitalizado';
      else if (p.estado === 'localizado') mappedStatus = 'Localizado';
      else if (p.estado === 'activo') mappedStatus = 'Desaparecido';

      // Lugar unificado
      let lugarStr = p.hospital || p.ultima_ubicacion_conocida || p.sector || 'Desconocido';

      // Construcción de observaciones enriquecidas
      const obsParts: string[] = [];
      if (p.edad_aproximada) obsParts.push(`Edad aprox: ${p.edad_aproximada}`);
      if (p.hospital && p.estado !== 'hospitalizado') obsParts.push(`Ubicación: ${p.hospital}`);
      if (p.nombre_contacto && p.nombre_contacto !== 'No especificado') {
        obsParts.push(`Contacto: ${p.nombre_contacto}`);
      }
      if (p.telefono_contacto && p.telefono_contacto !== 'No especificado') {
        obsParts.push(`Telf: ${p.telefono_contacto}`);
      }
      const observaciones = obsParts.length > 0 ? obsParts.join(' | ') : null;

      return {
        id: `ayudavzla-${p.id}`,
        nombre: p.nombre_completo,
        cedula: p.cedula || null,
        status: mappedStatus,
        lugar: lugarStr,
        observaciones: observaciones,
        fuente: 'Terremoto Venezuela (API)',
        tipo: 'ayudavenezuela',
        foto: foto,
        edad: (() => { const m = String(p.edad_aproximada ?? '').match(/\d+/); return m ? Number(m[0]) : null; })(),
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
        fecha: p.fecha_actualizacion || p.fecha_reporte || null,
      };
    });
  } else if (!isSearch && ALLOW_MOCKS) {
    // Mock local si no hay resultados o la API falló (para pruebas y visualización)
    ayudaVzlaData = [
      {
        id: 'ayudavzla-1',
        nombre: 'Ricardo Altuve',
        cedula: 'V-15.421.***',
        status: 'Ingresado',
        lugar: 'Hospital José María Vargas (La Guaira)',
        observaciones: 'Condición estable. Traumatismo menor. Ingresado en Sala C.',
        fuente: 'Terremoto Venezuela (Simulado)',
        tipo: 'ayudavenezuela',
        foto: null,
        lat: 10.6015,
        lng: -66.9322,
        fecha: new Date().toISOString(),
      },
      {
        id: 'ayudavzla-2',
        nombre: 'Elena De Freitas',
        cedula: 'V-12.890.***',
        status: 'Alta Médica',
        lugar: 'Hospital de Clínicas Caracas',
        observaciones: 'Recibió alta el 27-Jun tras observación por contusiones.',
        fuente: 'Terremoto Venezuela (Simulado)',
        tipo: 'ayudavenezuela',
        foto: null,
        lat: 10.4806,
        lng: -66.9036,
        fecha: new Date().toISOString(),
      }
    ];
  }

  for (const p of ayudaVzlaData) {
    persons.push({
      id: p.id || `ayudavzla-${Math.random()}`,
      nombre: p.nombre,
      cedula: p.cedula || null,
      status: p.status || 'Ingresado',
      lugar: p.lugar || 'Desconocido',
      observaciones: p.observaciones || null,
      foto: p.foto || null,
      fuente: p.fuente || 'Terremoto Venezuela (API)',
      tipo: 'ayudavenezuela',
      edad: p.edad ?? null,
      lat: p.lat ?? null,
      lng: p.lng ?? null,
      fecha: p.fecha || null,
    });
  }

  // 10. Procesar REDH AVAPRE
  const redhData = redhResult && Array.isArray(redhResult.data) ? redhResult.data : [];
  for (const p of redhData) {
    const fullName = `${p.first_name || ''} ${p.last_name || ''}`.trim();
    persons.push({
      id: `redh-${p.cedula || fullName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
      nombre: fullName || 'Persona reportada (REDH)',
      cedula: p.cedula || null,
      status: p.status === 'hospitalizado' ? 'Localizado' : (p.status === 'desaparecido' ? 'Desaparecido' : (p.status || 'Reportado')),
      lugar: p.location || 'Hospital / Desconocido',
      observaciones: p.contact_phone_masked ? `Teléfono de contacto de referencia: ${p.contact_phone_masked}` : 'Ingresado en centro médico.',
      foto: null,
      fuente: 'REDH AVAPRE',
      tipo: 'redh',
      lat: null,
      lng: null,
      fecha: null,
    });
  }

  // 11. De Mano en Mano (ya viene normalizado y geolocalizado desde la lib)
  const demanoItems = Array.isArray(demanoResult) ? demanoResult : [];
  for (const it of demanoItems) {
    persons.push(it);
  }

  // 12. ReportaVNZLA (on-demand en modo búsqueda; desaparecidosterremotovenezuela.com y aliados)
  const reportaRows = Array.isArray(reportaVnzlaResult) ? reportaVnzlaResult : [];
  for (const p of reportaRows) {
    const coords = p.ubicacion ? geocodePerson(p.estado === 'localizado' ? 'localizado' : 'desaparecido', '', '', p.ubicacion) : null;
    persons.push({
      id: p.id,
      nombre: p.nombre,
      cedula: p.cedulaMasked,
      status: p.estado === 'localizado' ? 'Localizado' : 'Desaparecido',
      lugar: p.ubicacion || 'Desconocido',
      observaciones: null,
      foto: p.foto,
      fuente: 'ReportaVNZLA',
      tipo: p.estado === 'localizado' ? 'localizado' : 'desaparecido',
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
      fecha: p.fecha,
    });
  }

  // 13. HelpMap Venezuela (pacientes verificados; ya normalizados por la lib).
  //     APAGADA salvo HELPMAP_PATIENTS_URL → normalmente []. Coordenadas reales de
  //     hospital; la cédula se enmascara en el paso de normalización PII de abajo.
  const helpmapRows = Array.isArray(helpmapResult) ? helpmapResult : [];
  for (const it of helpmapRows) persons.push(it);

  // ---- Normalización PII (obligatoria antes de dedup y de responder) ----
  // Los dígitos crudos de la cédula viven SOLO en el campo interno `_cedulaDigits`
  // (para dedup y búsqueda); el campo visible `cedula` queda SIEMPRE enmascarado.
  // Menores de edad: se omite su ubicación (sin coordenadas ni lugar textual).
  for (const p of persons) {
    p._cedulaDigits = cedulaDigits(p.cedula);
    p.cedula = maskCedulaPublic(p.cedula);
    if (typeof p.edad === 'number' && p.edad >= 0 && p.edad < 18) {
      p.lat = null;
      p.lng = null;
      p.lugar = UBICACION_MENOR;
    }
  }

  // Clave de conciliación con evidencia FUERTE (mismo criterio que /api/busqueda-avanzada):
  // cédula completa (>=6 dígitos) o nombre de 2+ tokens corroborado por lugar. Sin evidencia
  // fuerte NO se fusiona, para no mezclar la PII de homónimos distintos.
  const personKey = (p: any): string | null => {
    if (p._cedulaDigits && p._cedulaDigits.length >= 6) return `ced-${p._cedulaDigits}`;
    const n = normalizeSearchText(p.nombre || '').replace(/[^a-z0-9 ]/g, ' ').trim();
    const tokens = n.split(/\s+/).filter((t: string) => t.length > 1);
    if (tokens.length >= 2 && p.lugar) {
      const lug = normalizeSearchText(p.lugar).replace(/[^a-z0-9]/g, '');
      if (lug.length >= 4) return `name-${tokens.join('')}-${lug.slice(0, 14)}`;
    }
    return null;
  };

  const uniquePersons = new Map<string, any>();
  for (const p of persons) {
    const key = personKey(p);
    // Sin evidencia fuerte -> ficha independiente (clave estable por id, nunca aleatoria).
    if (!key) {
      uniquePersons.set(`solo-${p.id}`, { ...p, fuentes: [p.fuente] });
      continue;
    }
    const existing = uniquePersons.get(key);
    if (!existing) {
      uniquePersons.set(key, { ...p, fuentes: [p.fuente] });
      continue;
    }
    // FUSIONAR REGISTRO DUPLICADO
    if (!existing.fuentes.includes(p.fuente)) {
      existing.fuentes.push(p.fuente);
      existing.fuente = existing.fuentes.join(' + ');
    }
    if (p.nombre && p.nombre.length > (existing.nombre?.length || 0)) existing.nombre = p.nombre;
    if (!existing.cedula && p.cedula) existing.cedula = p.cedula;
    if (!existing._cedulaDigits && p._cedulaDigits) existing._cedulaDigits = p._cedulaDigits;
    if (p.observaciones && p.observaciones !== existing.observaciones) {
      const obsArr: string[] = [];
      if (existing.observaciones) obsArr.push(existing.observaciones);
      obsArr.push(`[${p.fuente}]: ${p.observaciones}`);
      existing.observaciones = obsArr.join(' · ');
    }
    if (!existing.lat && p.lat) { existing.lat = p.lat; existing.lng = p.lng; }
    if (!existing.foto && p.foto) existing.foto = p.foto;
    if (p.fecha && (!existing.fecha || p.fecha > existing.fecha)) existing.fecha = p.fecha;
  }

  const dedupedPersons = Array.from(uniquePersons.values());

  let filtered = dedupedPersons;
  if (isSearch) {
    const cd = lookup.cedula || '';
    filtered = dedupedPersons.filter((p) => {
      if (p.id.startsWith('rv-')) return true;
      if (cd) {
        const rec = p._cedulaDigits || '';
        return rec.length >= 3 && (rec.endsWith(cd) || cd.endsWith(rec));
      }
      if (qFilter) {
        const qDigits = qFilter.replace(/\D/g, '');
        const nameMatch = normalizeSearchText(p.nombre).includes(qFilter);
        const lugarMatch = normalizeSearchText(p.lugar).includes(qFilter);
        const cedulaMatch = qDigits.length >= 3 && (p._cedulaDigits || '').includes(qDigits);
        const obsMatch = p.observaciones ? normalizeSearchText(p.observaciones).includes(qFilter) : false;
        return nameMatch || lugarMatch || cedulaMatch || obsMatch;
      }
      return true;
    });
  }

  // No serializar campos internos (dígitos crudos de cédula, edad): solo la salida enmascarada.
  const publicRows = filtered.map((p) => {
    const row = { ...p };
    delete row._cedulaDigits;
    delete row.edad;
    return row;
  });

  return NextResponse.json({
    data: publicRows,
    meta: {
      total: publicRows.length,
      unfiltered_total: dedupedPersons.length,
      search_mode: isSearch,
      sources_queried: isSearch
        ? ['sos', 'localizados', 'hub', 'ayudavenezuela', 'redh', 'reportavnzla', 'helpmap']
        : undefined,
    },
  });
}
