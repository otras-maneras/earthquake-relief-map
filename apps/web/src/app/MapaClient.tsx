'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { ChevronUp, MapPin, Menu, X, Phone, UserSearch, PlusCircle, Heart, Mail, List, Home, Languages, Globe, HeartHandshake, Instagram, Search, BookOpen, ClipboardList, Newspaper } from 'lucide-react';
import { type Centro, ESTADO_COLOR, ESTADO_LABEL, TIPO_LABEL, TIPO_LABEL_SHORT } from '@/lib/centros';
const SubmitForm = dynamic(() => import('./SubmitForm'), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center text-ap-muted text-sm">Cargando formulario…</div>
  ),
});

const CentrosMap = dynamic(() => import('./CentrosMap'), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center text-ap-muted text-sm">Cargando mapa…</div>
  ),
});

const SugerirForm = dynamic(() => import('./SugerirForm'), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center text-ap-muted text-sm">Cargando formulario…</div>
  ),
});

const TelefonosModal = dynamic(() => import('./TelefonosModal'), {
  ssr: false,
  loading: () => <div className="h-full flex items-center justify-center text-ap-muted text-sm">Cargando teléfonos…</div>,
});

const RcfModal = dynamic(() => import('./RcfModal'), {
  ssr: false,
  loading: () => <div className="h-full flex items-center justify-center text-ap-muted text-sm">Cargando RCF…</div>,
});

const VoluntariosModal = dynamic(() => import('./VoluntariosModal'), {
  ssr: false,
  loading: () => <div className="h-full flex items-center justify-center text-ap-muted text-sm">Cargando voluntarios…</div>,
});


const DonacionesModal = dynamic(() => import('./DonacionesModal'), {
  ssr: false,
  loading: () => <div className="h-full flex items-center justify-center text-ap-muted text-sm">Cargando donaciones…</div>,
});

const NewsModal = dynamic(() => import('./NewsModal'), {
  ssr: false,
  loading: () => <div className="h-full flex items-center justify-center text-ap-muted text-sm">Cargando noticias…</div>,
});

const SHEET_HEIGHT = '60vh';
const PEEK = 88;

function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radio de la Tierra en km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function MapaClient() {
  const [centros, setCentros] = useState<Centro[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [sugerirCentro, setSugerirCentro] = useState<Centro | null>(null);
  const [telefonosOpen, setTelefonosOpen] = useState(false);
  const [rcfOpen, setRcfOpen] = useState(false);
  const [voluntariosOpen, setVoluntariosOpen] = useState(false);
  const [donacionesOpen, setDonacionesOpen] = useState(false);
  const [newsOpen, setNewsOpen] = useState(false);
  const [newsButtonVisible, setNewsButtonVisible] = useState(true);
  const [tipo, setTipo] = useState<'acopio' | 'refugio' | 'alojamiento'>('acopio');

  const [filtroPais, setFiltroPais] = useState('');
  const [filtroCiudad, setFiltroCiudad] = useState('');
  const [ciudadSearchInput, setCiudadSearchInput] = useState('');
  const [showCiudadDropdown, setShowCiudadDropdown] = useState(false);
  const [userCoords, setUserCoords] = useState<[number, number] | null>(null);
  const [radioFiltro, setRadioFiltro] = useState<number>(10);
  const [activarRadio, setActivarRadio] = useState<boolean>(false);
  const [showBanner, setShowBanner] = useState(false);
  const [submitTipo, setSubmitTipo] = useState<'acopio' | 'refugio' | 'alojamiento'>('acopio');
  const [mountMap, setMountMap] = useState(false);
  const [lastUpdatedText, setLastUpdatedText] = useState('');
  const [confirmMsg, setConfirmMsg] = useState('');

  // Sincronizar input de búsqueda de ciudad al cambiar el filtro real
  useEffect(() => {
    setCiudadSearchInput(filtroCiudad);
  }, [filtroCiudad]);

  // Cerrar el dropdown de ciudades al hacer clic fuera del selector
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.city-autocomplete-container')) {
        setShowCiudadDropdown(false);
      }
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  useEffect(() => {
    setShowBanner(true);
    const timer = setTimeout(() => setShowBanner(false), 20000);
    return () => clearTimeout(timer);
  }, []);

  // Cierra el banner al interactuar (abrir menú o desplegar la lista) para que no se superponga.
  useEffect(() => {
    if (menuOpen || expanded) setShowBanner(false);
  }, [menuOpen, expanded]);

  // Montar el mapa (import dinámico, ssr:false) apenas hidrata. requestIdleCallback
  // acá empeoraba LCP/TBT en vez de mejorarlos: retrasaba el fetch del chunk del mapa
  // sin liberar nada útil, porque no hay más contenido pesado compitiendo en el primer paint.
  useEffect(() => {
    setMountMap(true);
  }, []);

  // 2. Cargar parámetros iniciales de la URL
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const p = params.get('pais');
      const c = params.get('ciudad');
      const t = params.get('tipo');
      const ofrecer = params.get('ofrecer');
      const modal = params.get('modal') || params.get('voluntarios');
      if (p) setFiltroPais(p);
      if (c) setFiltroCiudad(c);
      if (t === 'acopio' || t === 'refugio' || t === 'alojamiento') {
        setTipo(t);
      } else if (ofrecer === 'hospedaje') {
        setTipo('alojamiento');
        setSubmitTipo('alojamiento');
        setSubmitOpen(true);
      }
      if (modal === 'voluntarios' || modal === 'true') {
        setVoluntariosOpen(true);
      } else if (modal === 'telefonos') {
        setTelefonosOpen(true);
      } else if (modal === 'donaciones') {
        setDonacionesOpen(true);
      } else if (modal === 'rcf') {
        setRcfOpen(true);
      }
      if (p || c) setExpanded(true);
    }
  }, []);


  useEffect(() => {
    fetch('/api/centros')
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => {
        if (Array.isArray(d)) {
          // Red de seguridad: eliminar duplicados por ID por si la caché sirve data repetida
          const unicos: Centro[] = [];
          const seen = new Set<string>();
          for (const item of d) {
            if (item?.id && !seen.has(item.id)) {
              seen.add(item.id);
              unicos.push(item);
            }
          }
          setCentros(unicos);
        } else {
          setCentros([]);
        }
      })
      .catch(() => setCentros([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (centros.length === 0) return;
    const times = centros
      .map((c) => (c.updatedAt ? new Date(c.updatedAt).getTime() : 0))
      .filter(Boolean);
    if (times.length === 0) return;
    const maxTime = new Date(Math.max(...times));
    try {
      const formatter = new Intl.DateTimeFormat(undefined, {
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
      setLastUpdatedText(formatter.format(maxTime));
    } catch (e) {
      setLastUpdatedText(maxTime.toLocaleDateString());
    }
  }, [centros]);


  // Vista por tipo (acopio / refugio) → opciones de filtro → lista final filtrada.
  // Memoizadas para que su referencia sea estable y el mapa/clusters no se reconstruyan en cada render.
  const visible = useMemo(() => centros.filter((c) => c.tipo === tipo), [centros, tipo]);

  // Botón "Completar o corregir info" dentro del popup del mapa: abre el modal de
  // sugerencia para el punto cuyo id viene en el evento.
  useEffect(() => {
    const onSugerir = (e: Event) => {
      const id = (e as CustomEvent).detail as string;
      const c = centros.find((x) => x.id === id);
      if (c) setSugerirCentro(c);
    };
    window.addEventListener('acopiove:sugerir', onSugerir);
    return () => window.removeEventListener('acopiove:sugerir', onSugerir);
  }, [centros]);

  // Botón "Confirmar que sigue abierto" del popup: confirmación pública de un toque.
  // Sella la frescura del punto (no lo edita) y actualiza el estado local optimista.
  useEffect(() => {
    const onConfirmar = async (e: Event) => {
      const id = (e as CustomEvent).detail as string;
      try {
        const r = await fetch(`/api/centros/${id}/confirmar`, { method: 'POST' });
        if (r.ok) {
          const data = await r.json().catch(() => null);
          setCentros((prev) => prev.map((x) => x.id === id
            ? { ...x, lastConfirmedAt: data?.lastConfirmedAt ?? new Date().toISOString(), confirmaciones: data?.confirmaciones ?? (x.confirmaciones ?? 0) + 1 }
            : x));
          setConfirmMsg('¡Gracias! Registramos que este punto sigue vigente.');
        } else if (r.status === 429) {
          setConfirmMsg('Muchas confirmaciones seguidas. Probá en un rato.');
        } else {
          setConfirmMsg('No se pudo confirmar. Intentá de nuevo.');
        }
      } catch {
        setConfirmMsg('No se pudo confirmar. Revisá tu conexión.');
      }
      setTimeout(() => setConfirmMsg(''), 3500);
    };
    window.addEventListener('acopiove:confirmar', onConfirmar);
    return () => window.removeEventListener('acopiove:confirmar', onConfirmar);
  }, []);
  
  const paises = useMemo(() => {
    const list = visible.map((c) => c.pais).filter(Boolean) as string[];
    const seen = new Set<string>();
    const result: string[] = [];
    for (const p of list) {
      const trimmed = p.trim();
      const lower = trimmed.toLowerCase();
      if (trimmed && !seen.has(lower)) {
        seen.add(lower);
        result.push(trimmed);
      }
    }
    return result.sort();
  }, [visible]);

  const ciudades = useMemo(() => {
    const list = visible
      .filter((c) => !filtroPais || c.pais?.trim().toLowerCase() === filtroPais.trim().toLowerCase())
      .map((c) => c.ciudad)
      .filter(Boolean) as string[];
    const seen = new Set<string>();
    const result: string[] = [];
    for (const ci of list) {
      const trimmed = ci.trim();
      const lower = trimmed.toLowerCase();
      if (trimmed && !seen.has(lower)) {
        seen.add(lower);
        result.push(trimmed);
      }
    }
    return result.sort();
  }, [visible, filtroPais]);

  const calculateVerification = useCallback((c: any) => {
    const fuentes = c.fuente || '';
    const sources = fuentes.split(/·|&|,/g).map((s: string) => s.trim()).filter(Boolean);
    const sourceCount = Math.max(1, sources.length);

    let score = 0;
    const isDefaultCaracas = (Math.abs(Number(c.latitude) - 10.4880) < 0.01 && Math.abs(Number(c.longitude) - -66.9350) < 0.01);
    if (c.latitude && c.longitude && !isDefaultCaracas) {
      score += 2;
    }
    if (c.contacto && c.contacto.length > 5 && !c.contacto.toLowerCase().includes('sin telefono')) {
      score += 1;
    }
    if (c.horario && !c.horario.toLowerCase().includes('contingencia')) {
      score += 1;
    }

    const finalScore = sourceCount * 2 + score;
    let tier: 'high' | 'medium' | 'basic' = 'basic';
    if (sourceCount >= 2 && finalScore >= 6) {
      tier = 'high';
    } else if (sourceCount >= 1 && finalScore >= 4) {
      tier = 'medium';
    }

    return { score: finalScore, tier, sourceCount };
  }, []);

  const filtrados = useMemo(
    () => {
      let list = visible.map(c => {
        let distancia: number | undefined = undefined;
        if (userCoords && c.latitude && c.longitude) {
          const lat = parseFloat(c.latitude);
          const lng = parseFloat(c.longitude);
          if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
            distancia = Math.round(getDistanceKm(userCoords[0], userCoords[1], lat, lng) * 10) / 10;
          }
        }
        return {
          ...c,
          distancia,
          verification: calculateVerification(c)
        };
      });

      // Filtrar por país y ciudad
      list = list.filter((c) => {
        const matchPais = !filtroPais || c.pais?.trim().toLowerCase() === filtroPais.trim().toLowerCase();
        const matchCiudad = !filtroCiudad || c.ciudad?.trim().toLowerCase() === filtroCiudad.trim().toLowerCase();
        return matchPais && matchCiudad;
      });

      // Filtrar por radio de distancia si está activo
      if (userCoords && activarRadio) {
        list = list.filter((c) => c.distancia !== undefined && c.distancia <= radioFiltro);
      }

      // Ordenar: por distancia si el radio está activo, si no por score de verificación
      return list.sort((a, b) => {
        if (activarRadio && a.distancia !== undefined && b.distancia !== undefined) {
          return a.distancia - b.distancia;
        }
        return b.verification.score - a.verification.score;
      });
    },
    [visible, filtroPais, filtroCiudad, calculateVerification, userCoords, activarRadio, radioFiltro],
  );

  const touchStartY = useRef(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const touchEndY = e.changedTouches[0].clientY;
    const diff = touchStartY.current - touchEndY;
    // Swipe Up (deslizar hacia arriba): expandir
    if (diff > 50 && !expanded) {
      setExpanded(true);
    }
    // Swipe Down (deslizar hacia abajo): colapsar
    if (diff < -50 && expanded) {
      setExpanded(false);
    }
  };

  const handleSelect = useCallback((id: string) => {
    setSelected(id);
    setExpanded(false);
  }, []);

  const switchTipo = (t: 'acopio' | 'refugio' | 'alojamiento') => {
    setTipo(t);
    setSelected(null);
    setFiltroPais('');
    setFiltroCiudad('');
  };

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Mapa a pantalla completa. Sin key de remount: el mapa se mantiene y solo
          se actualizan los marcadores/encuadre al cambiar filtros (mucho más liviano). */}
      <div className="absolute inset-0 bg-ap-bg">
        {mountMap ? (
          <CentrosMap
            centros={filtrados}
            selected={selected}
            hovered={hovered}
            onSelect={handleSelect}
            userCoords={userCoords}
            onUserCoordsChange={setUserCoords}
            onClickAñadir={() => { setSubmitTipo(tipo); setSubmitOpen(true); }}
          />
        ) : (
          <div className="h-full w-full relative bg-ap-bg flex flex-col items-center justify-center overflow-hidden">
            {/* Fondo simulando cuadrículas de mapa */}
            <div className="absolute inset-0 opacity-[0.04] bg-[linear-gradient(to_right,#000_1px,transparent_1px),linear-gradient(to_bottom,#000_1px,transparent_1px)] bg-[size:40px_40px]"></div>
            
            {/* Animación del logo de Otras Maneras (punta verde viajera) */}
            <div className="relative flex flex-col items-center justify-center mb-6">
              <style dangerouslySetInnerHTML={{__html: `
                .ld-svg { width: 44px; height: 44px; display: block; }
                .ld-body { fill: #072AC8; }
                .tip-c {
                  fill: #072AC8;
                  stroke: #072AC8;
                  stroke-width: 8px;
                  stroke-linejoin: round;
                  stroke-linecap: round;
                  animation: tipCycle 2.56s linear infinite;
                }
                @keyframes tipCycle {
                  0%, 13% { fill: #FCF300; stroke: #FCF300; }
                  18% { fill: #072AC8; stroke: #072AC8; }
                  100% { fill: #072AC8; stroke: #072AC8; }
                }
              `}} />
              
              <svg className="ld-svg animate-pulse" viewBox="0 0 920 920" xmlns="http://www.w3.org/2000/svg" style={{ animationDuration: '3.5s' }}>
                <path className="ld-body" d="M460.31,364.8c-52.33-.17-95,42.4-95.24,95-.22,52,42.1,94.73,94.42,95.43,51.63.68,95.94-42.55,96-93.83C555.67,405.18,509.57,363.79,460.31,364.8ZM611,659.76a51.85,51.85,0,0,0,13.42,35.13,52.5,52.5,0,0,0,71,6.71c21.19-16.24,26.17-46.64,11.5-70.18-14.06-22.56-43.4-30.34-67.61-17.73-3.34,1.74-5.51,1.75-8.23-1-14.67-15-29.51-29.83-44.3-44.71q-15.32-15.44-30.64-30.84c-3.71-3.72-8.17-4.39-12.89-2.38-4.3,1.82-6,5.53-6.19,10-.16,4.23,2.3,7.14,5.06,9.92q36.79,37,73.64,74c2.72,2.72,3.18,4.82,1.16,8.15A42.84,42.84,0,0,0,611,659.76Zm51.23-347.24c28.84,0,51.73-22.35,52.09-50a51.56,51.56,0,0,0-50-52.53c-38.57-1-63.78,38.88-47,74.61,1.67,3.55,1.22,5.57-1.42,8.18q-35.54,35.14-70.87,70.5c-2.12,2.11-4.41,4.09-5.86,6.78-2.58,4.81-1.62,11.12,2.14,14.22s9.75,3,14-.21a44.47,44.47,0,0,0,4.36-4.11q35.93-35.82,71.77-71.73c2.89-2.91,5.17-3.25,8.64-1.17A40.82,40.82,0,0,0,662.27,312.52ZM256.6,709.68c38,1.2,64.12-40.11,46.44-73.78-1.65-3.15-1.3-4.92,1.15-7.25,5.67-5.4,11.05-11.09,16.57-16.64,19-19.15,38.16-38.18,57-57.47,6.29-6.43,6.47-14,1.32-18.58-4.65-4.1-11.47-2.58-17.54,3.54q-36,36.39-72.18,72.71c-2.54,2.57-4.67,2.93-7.84,1.18a50.33,50.33,0,0,0-23.44-6.26c-27.24-.64-51,21.91-51.88,49C205.33,685.44,227.27,708.76,256.6,709.68Zm-50-449.46c-1.74,38.43,39.31,64.67,73.71,46.89,4.22-2.18,6.46-1.33,9.4,1.64,15.13,15.27,30.4,30.4,45.63,45.58,9.67,9.65,19.28,19.37,29.07,28.91a10.78,10.78,0,0,0,14.55.83c4.33-3.68,5.05-9.88,1.51-14.89a46,46,0,0,0-5.22-6Q340,328,304.76,292.92c-3.06-3-3.21-5.5-1.36-9.14a47.42,47.42,0,0,0,4.39-31.11c-5.22-26.86-28.34-44.69-54.7-42.47C226.06,212.48,206.1,235.73,206.57,260.22Zm243.15,31.06h0c0,6,0,12,0,18,0,9.83-.09,19.66.17,29.48.17,6.32,4.55,10.12,10.74,10,6-.14,9.72-3.85,10.09-10.11.12-2,.08-4,.08-6,0-29,0-58-.06-86.94,0-4,.64-6.66,5.16-8.25,23.17-8.11,35.73-27.1,34.86-51.88-1.08-30.62-30.9-53.68-60.85-47-22.76,5-39.59,24.24-40.69,47.8-1,22.19,11.29,42.53,34,50.6,5.08,1.8,6.59,4.41,6.52,9.42C449.58,261.29,449.72,276.29,449.72,291.28ZM628.17,449.39c-15.33,0-30.66-.95-46,.24-7,.55-10.84,4.76-10.39,11.34s4.35,9.78,12,9.8c29.16.07,58.32.12,87.48,0,4.86,0,7.57,1.31,8.92,6.4,3.05,11.47,10.34,20.09,20.26,26.3,19.16,12,42.1,10.56,59.79-3.4,16.45-13,22.73-35.94,15.59-57-6.87-20.25-26.54-33.95-48.8-34-20.32-.05-40.3,14.2-46.54,34-1.68,5.34-4.47,6.44-9.32,6.38C656.82,449.28,642.49,449.39,628.17,449.39Zm-335.29,21.4h0c14.33,0,28.65,0,43,0,8.65,0,12.83-3.46,12.93-10.39s-4.25-10.8-12.44-11.26c-.83,0-1.67-.05-2.5-.05-27.83,0-55.65-.2-83.47.14-5.89.07-8.69-1.42-10.87-7.19-7.33-19.36-21.91-30.45-42.39-32.48-18.79-1.87-34.53,5.09-45.48,20.67-12,17.14-13.59,35.62-3.58,54.22,10.53,19.58,27.56,29.05,49.55,26.73,21.18-2.24,35.86-14.3,42.84-34.73,1.46-4.28,3.66-5.73,7.94-5.68C263.22,470.88,278.05,470.79,292.88,470.79Zm178,155.75c0-3.67,0-7.33,0-11,0-11,.06-22-.12-33-.12-7.3-4.38-11.45-11.11-11.32-5.79.11-9.66,4.58-9.92,11.49-.06,1.83,0,3.67,0,5.5q0,40.21,0,80.43c0,3.9-.43,6.81-5.07,8.34-22.65,7.49-35.48,26.21-34.85,50.14.8,30.78,29.43,53.76,59.62,47.83,22.63-4.43,39.62-22.7,41.17-44.26,1.78-24.84-11.13-45.56-33.87-53.47-4.76-1.66-6-4.19-5.94-8.76C471,654.51,470.86,640.52,470.87,626.54Z" />
                {[
                  { cx: 661.5, cy: 660.5 }, // Bottom-Right
                  { cx: 726.5, cy: 460.5 }, // Right
                  { cx: 662.0, cy: 261.5 }, // Top-Right
                  { cx: 459.5, cy: 188.0 }, // Top
                  { cx: 257.0, cy: 260.5 }, // Top-Left
                  { cx: 192.0, cy: 460.0 }, // Left
                  { cx: 256.5, cy: 658.0 }, // Bottom-Left
                  { cx: 460.0, cy: 724.0 }, // Bottom
                ].map((t, i) => {
                  const delay = i === 0 ? "0s" : `-${(2.56 - i * 0.32).toFixed(2)}s`;
                  return (
                    <circle
                      key={i}
                      cx={t.cx}
                      cy={t.cy}
                      r="52"
                      className="tip-c"
                      style={{ animationDelay: delay }}
                    />
                  );
                })}
              </svg>
            </div>
            
            {/* Texto de carga estilizado */}

            <p className="text-ap-muted text-[13px] font-medium mt-1 animate-pulse">Iniciando mapa interactivo...</p>
          </div>
        )}
      </div>

      {/* Barra superior: switch acopio/refugio al centro + menú en la esquina */}
      <div className="absolute top-3 left-0 right-0 px-3 z-[1000] flex items-center justify-center pointer-events-none">
        {/* Botón volver a inicio / landing */}
        <div className="absolute left-3 pointer-events-auto flex items-center gap-2">
          <a
            href="/"
            aria-label="Ir a la página de inicio"
            className="bg-ap-surface border border-ap-border rounded-full h-11 px-3.5 flex items-center gap-2 shadow-agentos-sm text-ap-primary hover:bg-ap-surface-hover transition-colors font-semibold text-xs"
          >
            <Home size={16} />
            <span className="hidden sm:inline font-outfit font-bold">Inicio</span>
          </a>
        </div>

        {/* Switch central */}
        <div className="pointer-events-auto bg-ap-surface border border-ap-border rounded-full p-1 shadow-agentos-sm flex">
          {(['acopio', 'refugio', 'alojamiento'] as const).map((t) => (
            <button
              key={t}
              onClick={() => switchTipo(t)}
              className={`px-3.5 py-1.5 rounded-full text-[12px] font-bold transition-colors ${
                tipo === t ? 'bg-ap-primary text-white' : 'text-ap-secondary'
              }`}
            >
              {TIPO_LABEL_SHORT[t]}
            </button>
          ))}
        </div>



        {/* Menú en la esquina derecha */}
        <div className="absolute right-3 pointer-events-auto">
          <div className="relative">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="bg-ap-surface border border-ap-border rounded-full w-11 h-11 flex items-center justify-center shadow-agentos-sm text-ap-primary"
              aria-label="Menú"
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          {menuOpen && (
            <div className="absolute right-0 mt-2 w-60 bg-ap-surface border border-ap-border rounded-agentos-lg shadow-agentos-md overflow-hidden animate-fadeIn">
              <a href="/" className="flex w-full items-center gap-2.5 px-4 py-3 text-[13px] font-semibold text-ap-primary bg-blue-50/50 hover:bg-blue-50 border-b border-ap-border/60">
                <Home size={16} className="text-ap-primary" /> Presentación e Inicio
              </a>
              <MenuItem icon={<HeartHandshake size={16} className="text-rose-500" />} label="Donaciones" onClick={() => { setMenuOpen(false); setDonacionesOpen(true); }} />
              <MenuItem icon={<Phone size={16} />} label="Teléfonos de emergencia" onClick={() => { setMenuOpen(false); setTelefonosOpen(true); }} />
              <MenuItem icon={<Languages size={16} />} label="Voluntarios Intérpretes" onClick={() => { setMenuOpen(false); setVoluntariosOpen(true); }} />
              <MenuItem icon={<Heart size={16} className="text-rose-500" />} label="Contactar familiares (RCF)" onClick={() => { setMenuOpen(false); setRcfOpen(true); }} />
              <MenuItem icon={<UserSearch size={16} />} label="Reportar persona" onClick={() => { setMenuOpen(false); window.open('https://venezuelatebusca.com', '_blank', 'noopener,noreferrer'); }} />
              <a href="/centros" className="flex w-full items-center gap-2.5 px-4 py-3 text-[13px] font-semibold text-ap-secondary hover:bg-ap-surface-hover">
                <List size={16} /> Ver listado completo
              </a>
              <a href="/busquedas" className="flex w-full items-center gap-2.5 px-4 py-3 text-[13px] font-semibold text-ap-secondary hover:bg-ap-surface-hover">
                <Search size={16} className="text-ap-primary" /> Búsqueda avanzada
              </a>
              <a href="/docs" className="flex w-full items-center gap-2.5 px-4 py-3 text-[13px] font-semibold text-ap-secondary hover:bg-ap-surface-hover">
                <BookOpen size={16} /> Documentación y APIs
              </a>
              <a
                href="https://docs.google.com/forms/d/e/1FAIpQLSeTfwwcg6pH4A2jdILcJJl-XLkPZZzx4EmqjF6mXz6yXZgT5g/viewform"
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center gap-2.5 px-4 py-3 text-[13px] font-semibold text-ap-secondary hover:bg-ap-surface-hover"
              >
                <ClipboardList size={16} className="text-ap-primary" /> Censo Celíacos
              </a>
              <div className="border-t border-ap-border" />

              <button
                onClick={() => {
                  setMenuOpen(false);
                  setSubmitTipo(tipo);
                  setSubmitOpen(true);
                }}
                className="flex w-full items-center gap-2.5 px-4 py-3 text-[13px] font-semibold text-ap-secondary hover:bg-ap-surface-hover"
              >
                <PlusCircle size={16} /> Cargar información
              </button>

              <div className="border-t border-ap-border" />
              <div className="px-4 py-3.5">
                <div className="flex items-start gap-2.5 text-[12px] text-ap-secondary">
                  <Mail size={16} className="mt-0.5 shrink-0 text-ap-muted" />
                  <p className="leading-relaxed">
                    ¿Tienes información o quieres colaborar? Escríbenos a{' '}
                    <a href="mailto:info@acopiove.org" className="font-bold text-ap-primary hover:underline">info@acopiove.org</a>
                  </p>
                </div>
                <div className="flex items-center gap-3 mt-3 pl-[26px]">
                  <span className="text-[12px] font-semibold text-ap-secondary">Síguenos</span>
                  <a
                    href="https://x.com/acopiove"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="AcopioVE en X"
                    className="text-ap-muted hover:text-ap-primary transition-colors"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                  </a>
                  <a
                    href="https://instagram.com/acopiove"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="AcopioVE en Instagram"
                    className="text-ap-muted hover:text-ap-primary transition-colors"
                  >
                    <Instagram size={17} />
                  </a>
                </div>
              </div>
            </div>
          )}
          </div>
        </div>
      </div>

      {/* Bottom sheet con la lista */}
      <div
        className="absolute left-0 right-0 bottom-0 mx-auto w-full max-w-[640px] bg-ap-surface rounded-t-[20px] border border-b-0 border-ap-border shadow-agentos-md z-[1000] flex flex-col"
        style={{
          height: SHEET_HEIGHT,
          transform: expanded ? 'translateY(0)' : `translateY(calc(${SHEET_HEIGHT} - ${PEEK}px))`,
          transition: 'transform 0.34s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <button
          onClick={() => setExpanded((e) => !e)}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className="shrink-0 px-5 pt-2.5 pb-3 text-left w-full select-none"
          aria-expanded={expanded}
        >
          <div className="mx-auto w-10 h-1.5 bg-ap-border rounded-full mb-2.5 cursor-grab active:cursor-grabbing" />
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-[17px] font-extrabold text-ap-primary font-outfit leading-tight">{TIPO_LABEL[tipo]}</h1>
              <p className="text-[12px] text-ap-muted">
                {filtrados.length} {tipo === 'refugio'
                  ? (filtrados.length === 1 ? 'refugio oficial' : 'refugios oficiales')
                  : tipo === 'alojamiento'
                  ? (filtrados.length === 1 ? 'hogar solidario' : 'hogares solidarios')
                  : (filtrados.length === 1 ? 'centro de acopio' : 'centros de acopio')}
                {lastUpdatedText && ` · Actualizado: ${lastUpdatedText}`}
              </p>
            </div>
            <ChevronUp size={20} className={`text-ap-muted shrink-0 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`} />
          </div>
        </button>

        {/* Filtros país / ciudad */}
        <div className="shrink-0 px-4 pb-2.5 flex gap-2 w-full z-[2000]">
          <select
            value={filtroPais}
            onChange={(e) => { setFiltroPais(e.target.value); setFiltroCiudad(''); }}
            className="w-1/2 min-w-0 text-[12px] font-semibold text-ap-primary bg-ap-bg border border-ap-border rounded-lg px-2 py-1.5 outline-none truncate"
            aria-label="Filtrar por país"
          >
            <option value="">Todos los países</option>
            {paises.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          
          {/* Autocomplete de ciudades */}
          <div className="w-1/2 relative city-autocomplete-container">
            <div className="flex items-center bg-ap-bg border border-ap-border rounded-lg px-2.5 py-1.5 focus-within:border-ap-primary transition-colors">
              <input
                type="text"
                placeholder="Buscar ciudad..."
                value={ciudadSearchInput}
                onChange={(e) => {
                  setCiudadSearchInput(e.target.value);
                  setShowCiudadDropdown(true);
                  if (e.target.value === '') {
                    setFiltroCiudad('');
                  }
                }}
                onFocus={() => setShowCiudadDropdown(true)}
                className="w-full text-[12px] font-semibold text-ap-primary bg-transparent outline-none min-w-0 placeholder-ap-muted"
                aria-label="Filtrar por ciudad (escribe para autocompletar)"
              />
              {ciudadSearchInput && (
                <button
                  onClick={() => {
                    setFiltroCiudad('');
                    setCiudadSearchInput('');
                    setShowCiudadDropdown(false);
                  }}
                  className="text-ap-muted hover:text-ap-primary p-0.5 shrink-0"
                  aria-label="Limpiar ciudad"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {showCiudadDropdown && (
              <div className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-ap-surface border border-ap-border rounded-lg shadow-agentos-md z-[3000]">
                <div
                  onClick={() => {
                    setFiltroCiudad('');
                    setCiudadSearchInput('');
                    setShowCiudadDropdown(false);
                  }}
                  className="px-3 py-2 text-[12px] font-bold text-ap-secondary hover:bg-ap-surface-hover cursor-pointer border-b border-ap-border/50"
                >
                  Todas las ciudades
                </div>
                {ciudades
                  .filter((c) => c.toLowerCase().includes(ciudadSearchInput.toLowerCase()))
                  .map((c) => (
                    <div
                      key={c}
                      onClick={() => {
                        setFiltroCiudad(c);
                        setCiudadSearchInput(c);
                        setShowCiudadDropdown(false);
                      }}
                      className="px-3 py-2 text-[12px] font-semibold text-ap-primary hover:bg-ap-surface-hover cursor-pointer"
                    >
                      {c}
                    </div>
                  ))}
                {ciudades.filter((c) => c.toLowerCase().includes(ciudadSearchInput.toLowerCase())).length === 0 && (
                  <div className="px-3 py-2 text-[12px] text-ap-muted">No hay resultados</div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Filtros de cercanía GPS */}
        {userCoords && (
          <div className="shrink-0 px-4 pb-2.5 pt-1 border-t border-ap-border/30 bg-ap-bg/5 flex items-center justify-between gap-3 w-full">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={activarRadio}
                onChange={(e) => setActivarRadio(e.target.checked)}
                className="w-4 h-4 rounded text-ap-primary border-ap-border focus:ring-ap-primary shrink-0"
              />
              <span className="text-[12px] font-bold text-ap-secondary">Filtrar por cercanía</span>
            </label>
            {activarRadio && (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-ap-muted">Radio:</span>
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={radioFiltro}
                  onChange={(e) => setRadioFiltro(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-14 text-center text-[12px] font-bold text-ap-primary bg-ap-bg border border-ap-border rounded-md px-1 py-0.5 outline-none"
                />
                <span className="text-[11px] text-ap-muted">km</span>
              </div>
            )}
          </div>
        )}


        <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-2">
          {tipo === 'alojamiento' && (
            <div className="p-3.5 bg-rose-50 border border-rose-100 rounded-xl text-[12.5px] text-rose-950 leading-relaxed font-semibold mb-2">
              <strong>¿Tienes una habitación o espacio libre?</strong> Puedes ponerlo a disposición de familias damnificadas temporalmente. Regístralo pulsando &quot;Cargar información&quot; en el menú o comparte este enlace directo: <strong className="text-rose-700 underline break-all">acopiove.org/?ofrecer=hospedaje</strong>
            </div>
          )}
          {loading && <div className="text-ap-muted text-sm px-1">Cargando…</div>}
          {!loading && filtrados.length === 0 && (
            <div className="text-ap-muted text-sm px-1">No hay resultados con estos filtros.</div>
          )}
          {/* Las tarjetas solo se montan cuando el panel está abierto (perf, sobre todo en móvil). */}
          {expanded && filtrados.map((c) => {
            const active = c.id === selected;
            return (
              <div
                key={c.id}
                onClick={() => handleSelect(c.id)}
                onMouseEnter={() => setHovered(c.id)}
                onMouseLeave={() => setHovered(null)}
                className={`cursor-pointer rounded-agentos-lg border p-3 transition-colors ${
                  active ? 'border-ap-primary bg-ap-surface-hover' : 'border-ap-border hover:border-ap-muted'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <MapPin size={15} className="text-ap-muted mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-bold text-ap-primary text-[14px] truncate">{c.name}</span>
                      <span
                        className="shrink-0 text-[9px] font-bold text-white px-1.5 py-0.5 rounded-full"
                        style={{ background: ESTADO_COLOR[c.estado] }}
                      >
                        {ESTADO_LABEL[c.estado]}
                      </span>
                      {c.verification?.tier === 'high' && (
                        <span className="shrink-0 text-[9px] font-extrabold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">
                          Verificación Cruzada ({c.verification.sourceCount})
                        </span>
                      )}
                      {c.verification?.tier === 'medium' && (
                        <span className="shrink-0 text-[9px] font-bold text-sky-800 bg-sky-50 border border-sky-200 px-1.5 py-0.5 rounded-full">
                          Verificado
                        </span>
                      )}
                      {c.distancia !== undefined && (
                        <span className="shrink-0 text-[9px] font-bold text-blue-800 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-full">
                          A {c.distancia} km
                        </span>
                      )}
                    </div>
                    {c.address && <div className="text-[12px] text-ap-muted truncate">{c.address}</div>}
                    {c.recibe?.length > 0 && (
                      <div className="text-[11px] text-ap-secondary mt-1 truncate">Recibe: {c.recibe.join(', ')}</div>
                    )}
                    {c.necesitaAhora && (
                      <div className="text-[12px] font-semibold mt-1" style={{ color: '#b45309' }}>
                        Necesita: {c.necesitaAhora}
                      </div>
                    )}
                    {c.fuente && <div className="text-[10px] text-ap-muted mt-1">Fuente: {c.fuente}</div>}
                    
                    {c.latitude && c.longitude && (
                      <div className="mt-2.5 flex justify-end">
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${c.latitude},${c.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1.5 text-[11px] font-bold text-ap-primary hover:underline bg-ap-bg border border-ap-border px-2.5 py-1.5 rounded-lg hover:bg-ap-surface-hover transition-colors shadow-sm"
                        >
                          Cómo llegar (Google Maps)
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          <FaqSection />
        </div>
      </div>

      {submitOpen && (
        <SubmitForm
          open={submitOpen}
          onClose={() => setSubmitOpen(false)}
          initialTipo={submitTipo}
        />
      )}
      {sugerirCentro && (
        <SugerirForm centro={sugerirCentro} onClose={() => setSugerirCentro(null)} />
      )}
      {confirmMsg && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 2000, background: '#166534', color: '#fff', fontSize: 13, fontWeight: 600, padding: '10px 16px', borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.25)', maxWidth: '90vw', textAlign: 'center' }}>
          {confirmMsg}
        </div>
      )}
      {telefonosOpen && <TelefonosModal open={telefonosOpen} onClose={() => setTelefonosOpen(false)} />}
      {rcfOpen && <RcfModal open={rcfOpen} onClose={() => setRcfOpen(false)} />}
      {voluntariosOpen && <VoluntariosModal open={voluntariosOpen} onClose={() => setVoluntariosOpen(false)} />}
      {donacionesOpen && <DonacionesModal open={donacionesOpen} onClose={() => setDonacionesOpen(false)} />}


      {showBanner && (
        <div className="absolute top-[76px] left-3 right-3 sm:left-auto sm:right-3 sm:w-[350px] z-[1000] pointer-events-none">
          <div className="bg-white/80 backdrop-blur-lg border border-ap-border/50 rounded-2xl p-3 sm:p-4 shadow-agentos-md pointer-events-auto relative animate-fadeIn">
            <button
              onClick={() => setShowBanner(false)}
              className="text-ap-muted hover:text-ap-primary w-11 h-11 flex items-center justify-center absolute top-0 right-0 transition-colors"
              aria-label="Cerrar banner"
            >
              <X size={15} />
            </button>
            <div className="flex items-start gap-2.5 sm:gap-3">
              <div className="bg-ap-primary/10 text-ap-primary p-1.5 sm:p-2 rounded-xl shrink-0 mt-0.5">
                <Heart size={18} className="sm:w-5 sm:h-5" />
              </div>
              <div className="flex-1 min-w-0 pr-4">
                <h2 className="font-extrabold text-ap-primary text-[13px] sm:text-[14px] font-outfit">¿Querés sumar a la red?</h2>
                <p className="text-[11px] sm:text-[12px] text-ap-secondary mt-0.5 sm:mt-1 leading-normal">
                  Registrá un punto de ayuda o ofrecé tu espacio a familias damnificadas.
                </p>
              </div>
            </div>
            <div className="flex gap-2 mt-2.5">
              <button
                onClick={() => { setShowBanner(false); setSubmitTipo('acopio'); setSubmitOpen(true); }}
                className="flex-1 inline-flex items-center justify-center gap-1.5 text-[11px] sm:text-[11.5px] font-bold text-white bg-ap-primary hover:bg-ap-secondary px-2.5 py-1.5 rounded-lg transition-all active:scale-95 shadow-sm"
              >
                <PlusCircle size={14} /> Centro de acopio
              </button>
              <button
                onClick={() => { setShowBanner(false); setSubmitTipo('alojamiento'); setSubmitOpen(true); }}
                className="flex-1 inline-flex items-center justify-center gap-1.5 text-[11px] sm:text-[11.5px] font-bold text-white bg-rose-600 hover:bg-rose-700 px-2.5 py-1.5 rounded-lg transition-all active:scale-95 shadow-sm"
              >
                <Home size={14} /> Techo solidario
              </button>
          </div>
        </div>
      </div>
      )}
      {/* Pestaña lateral de noticias (estilo /busquedas) */}
      {!newsOpen && (
        <>
          {/* Desktop: Pestaña vertical pegada al borde izquierdo */}
          <button
            onClick={() => setNewsOpen(true)}
            aria-label="Ver noticias"
            className="hidden md:flex absolute top-[210px] left-0 z-[1000] bg-ap-surface border border-ap-border border-l-0 rounded-r-xl shadow-agentos-md flex-col items-center gap-1.5 px-1.5 py-3 hover:bg-ap-surface-hover transition-colors pointer-events-auto cursor-pointer"
          >
            <Newspaper size={14} className="text-ap-primary" />
            <span className="text-[9px] font-extrabold text-ap-primary uppercase tracking-wide [writing-mode:vertical-rl] font-sans">
              Noticias
            </span>
          </button>
          {/* Móvil: Botón flotante discreto */}
          <button
            onClick={() => setNewsOpen(true)}
            className="md:hidden absolute bottom-[104px] left-3 z-[999] bg-ap-surface border border-ap-border rounded-full w-11 h-11 flex items-center justify-center shadow-agentos-md text-ap-primary pointer-events-auto cursor-pointer"
            aria-label="Ver noticias"
          >
            <Newspaper size={18} className="animate-pulse" />
          </button>
        </>
      )}

      {newsOpen && <NewsModal open={newsOpen} onClose={() => setNewsOpen(false)} />}
    </div>
  );
}



function MenuItem({
  icon,
  label,
  active,
  soon,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  soon?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={soon}
      className={`flex w-full items-center gap-2.5 px-4 py-3 text-[13px] font-semibold text-left ${
        active ? 'text-ap-primary bg-ap-surface-hover' : 'text-ap-secondary hover:bg-ap-surface-hover'
      } ${soon ? 'opacity-50 cursor-default' : ''}`}
    >
      {icon}
      <span className="flex-1">{label}</span>
      {soon && <span className="text-[9px] font-bold text-ap-muted bg-ap-bg px-1.5 py-0.5 rounded-full">PRONTO</span>}
    </button>
  );
}

function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqs = [
    {
      q: '¿Qué es AcopioVE?',
      a: 'AcopioVE es un mapa interactivo y directorio de emergencia actualizado en tiempo real que reúne los centros de acopio y puntos de recolección de donaciones activos en Venezuela y la diáspora (Colombia, España, Estados Unidos, Ecuador, Panamá y más) para canalizar ayuda humanitaria tras la emergencia.',
    },
    {
      q: '¿Qué tipo de insumos y ayuda se puede donar?',
      a: 'Generalmente se requiere agua potable embotellada, alimentos no perecederos (arroz, pasta, granos, enlatados), medicamentos esenciales, insumos de primeros auxilios (gasas, alcohol, vendas), artículos de higiene personal (pañales, toallas sanitarias) y herramientas de rescate o limpieza (palas, picos, linternas, guantes).',
    },
    {
      q: '¿Cómo registrar un nuevo centro de acopio o refugio temporal?',
      a: 'Cualquier persona o voluntario puede registrar un punto de ayuda de forma gratuita. Haz clic en "Cargar información" en el menú, marca la ubicación exacta en el mapa interactivo, completa los datos del centro (dirección, contacto, tipo e insumos que recibe) y envíalo. Se publicará tras una moderación rápida.',
    },
    {
      q: '¿Qué es un techo solidario y cómo puedo ofrecer hospedaje?',
      a: 'El techo solidario o alojamiento es una iniciativa para que personas con habitaciones, casas o espacios disponibles puedan albergar temporalmente a familias damnificadas. Puedes registrar tu espacio seleccionando la opción "Alojamiento" al cargar información o compartiendo el enlace directo acopiove.org/?ofrecer=hospedaje.',
    },
  ];

  return (
    <div className="mt-8 border-t border-ap-border/60 pt-6 pb-2">
      <h2 className="font-extrabold text-[15px] text-ap-primary font-outfit mb-4">Preguntas Frecuentes y Ayuda</h2>
      <div className="space-y-2.5">
        {faqs.map((faq, i) => {
          const isOpen = openIndex === i;
          return (
            <div key={i} className="border border-ap-border rounded-xl overflow-hidden bg-ap-bg/50">
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? null : i)}
                className="w-full text-left px-4 py-3 flex justify-between items-center gap-3 hover:bg-ap-surface-hover transition-colors"
              >
                <span className="font-bold text-[12.5px] text-ap-primary leading-snug">{faq.q}</span>
                <span className="text-[14px] text-ap-muted font-bold shrink-0">{isOpen ? '−' : '+'}</span>
              </button>
              {isOpen && (
                <div className="px-4 pb-3 pt-1 text-[12px] text-ap-secondary leading-relaxed border-t border-ap-border/40 bg-white/40">
                  {faq.a}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
