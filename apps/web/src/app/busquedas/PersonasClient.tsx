'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Search, X, Menu, Home, Code, AlertTriangle, MapPin } from 'lucide-react';
import { normalizeSearchText } from '@/lib/text';
import { parsePersonasLookupInput } from '@/lib/api/personas-search-input';
import {
  GRUPOS, grupoDe, estadoDe, toPerson,
  CAPAS_INICIALES, origenesActivos,
  type Entidad, type CapasState, type BrowseMeta, type Person,
} from './entidad';
import LayersPanel from './LayersPanel';
import ResultsPanel from './ResultsPanel';
import StatsModal from './StatsModal';
import ImportModal from './ImportModal';

const PersonasMap = dynamic(() => import('./PersonasMap'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center text-ap-muted text-sm">Cargando mapa…</div>
  ),
});

// Techo de fichas pintadas en la lista: el índice completo pasa de 2.900 y el DOM
// se vuelve el cuello de botella mucho antes que el mapa (que agrupa en clusters).
const MAX_LISTA = 400;

export default function PersonasClient() {
  // Índice completo (browse) y resultados de búsqueda server-side. La búsqueda es
  // un sustituto del browse, no un filtro: trae fuentes que solo responden a una
  // consulta (Venezuela Reporta, ReportaVNZLA).
  const [entidades, setEntidades] = useState<Entidad[]>([]);
  const [meta, setMeta] = useState<BrowseMeta | null>(null);
  const [searchHits, setSearchHits] = useState<Entidad[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [error, setError] = useState(false);

  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>([10.4806, -66.9036]);
  const [mapZoom, setMapZoom] = useState(11);
  const [menuOpen, setMenuOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Facetas (qué es la ficha) y capas (de dónde sale / qué overlay se dibuja).
  const [grupoFiltro, setGrupoFiltro] = useState<string>('all');
  const grupos = useMemo(() => {
    if (grupoFiltro === 'all') return new Set(GRUPOS.map((g) => g.key));
    return new Set([grupoFiltro]);
  }, [grupoFiltro]);
  const [capas, setCapas] = useState<CapasState>(CAPAS_INICIALES);
  const [hubOfertas, setHubOfertas] = useState(false);

  // Filtros del panel de resultados.
  const [estadoFiltro, setEstadoFiltro] = useState<'all' | 'abierto' | 'lleno' | 'cerrado'>('all');
  const [categoriaFiltro, setCategoriaFiltro] = useState<string | null>(null);
  const [zonaSel, setZonaSel] = useState<string | null>(null);
  const [estadoPersona, setEstadoPersona] = useState<'all' | 'localizado' | 'desaparecido'>('all');

  // API externa cargada por el usuario (solo en su navegador).
  const [customNombre, setCustomNombre] = useState<string | null>(null);
  const [customData, setCustomData] = useState<Entidad[]>([]);
  const [customActiva, setCustomActiva] = useState(true);

  const [showStats, setShowStats] = useState(false);
  const [showImport, setShowImport] = useState(false);

  // Aviso de transparencia sobre el origen de los datos: aparece al entrar y se
  // desvanece solo (no compromete a AcopioVE; solo informa qué se muestra y de dónde).
  const [infoMounted, setInfoMounted] = useState(true);
  const [infoOn, setInfoOn] = useState(false);
  useEffect(() => {
    const rise = setTimeout(() => setInfoOn(true), 60);
    const fall = setTimeout(() => setInfoOn(false), 8000);
    const unmount = setTimeout(() => setInfoMounted(false), 8600);
    return () => { clearTimeout(rise); clearTimeout(fall); clearTimeout(unmount); };
  }, []);

  // Carga inicial: índice completo (mapa + lista + facetas + estadísticas).
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const res = await fetch('/api/busqueda-avanzada');
        if (!res.ok) throw new Error('bad');
        const body = await res.json();
        if (cancel) return;
        setEntidades(Array.isArray(body.data) ? body.data : []);
        setMeta(body.meta ?? null);
      } catch (err) {
        console.error('Error cargando el índice:', err);
        if (!cancel) setError(true);
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, []);

  // Búsqueda / exploración server-side con debounce. Dispara con texto (>=2), con
  // cédula, o al elegir zona o estado de persona.
  useEffect(() => {
    const lookup = parsePersonasLookupInput(query);
    const texto = query.trim();
    const hayTexto = texto.length >= 2 || !!lookup.cedula;
    if (!hayTexto && !zonaSel && estadoPersona === 'all') {
      setSearchHits(null);
      setSearchLoading(false);
      return;
    }

    setSearchLoading(true);
    const params = new URLSearchParams();
    if (lookup.cedula) params.set('cedula', lookup.cedula);
    else if (texto.length >= 2) params.set('q', texto);
    if (zonaSel) params.set('lugar', zonaSel);
    if (estadoPersona !== 'all') params.set('estado', estadoPersona);

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/busqueda-avanzada?${params}`);
        const body = await res.json();
        setSearchHits(Array.isArray(body.data) ? body.data : []);
      } catch (err) {
        console.error('Error en la búsqueda:', err);
        setSearchHits([]);
      } finally {
        setSearchLoading(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [query, zonaSel, estadoPersona]);

  const isSearching = searchHits !== null;
  const base = useMemo(() => {
    const b = searchHits ?? entidades;
    return customData.length > 0 ? [...b, ...customData] : b;
  }, [entidades, searchHits, customData]);

  const origenes = useMemo(() => origenesActivos(capas), [capas]);

  const filtradas = useMemo(() => {
    const q = normalizeSearchText(query.trim());
    const cf = categoriaFiltro ? normalizeSearchText(categoriaFiltro) : null;

    return base.filter((e) => {
      // La API externa del usuario tiene su propio toggle y no pasa por las capas.
      if (customNombre && e.fuente === customNombre) return customActiva;

      if (!origenes.has(e.origen)) return false;
      if (e.origen === 'hub' && e.category === 'oferta' && !hubOfertas) return false;
      if (!grupos.has(grupoDe(e))) return false;
      if (estadoFiltro !== 'all' && estadoDe(e) !== estadoFiltro) return false;
      if (cf && !e.categorias.some((c) => normalizeSearchText(c).includes(cf))) return false;

      // Con búsqueda server-side el filtro de texto ya viene aplicado.
      if (q && !isSearching) {
        const hay =
          normalizeSearchText(e.nombre || '').includes(q) ||
          normalizeSearchText(e.lugar || '').includes(q) ||
          normalizeSearchText(e.observaciones || '').includes(q) ||
          (e.cedula ? normalizeSearchText(e.cedula).includes(q) : false);
        if (!hay) return false;
      }
      return true;
    });
  }, [base, origenes, grupos, estadoFiltro, categoriaFiltro, hubOfertas, query, isSearching, customNombre, customActiva]);

  const persons: Person[] = useMemo(
    () => filtradas.filter((e) => e.lat != null && e.lng != null).map(toPerson),
    [filtradas],
  );

  // Multi-fuente primero, luego lo que tiene coordenadas.
  const lista = useMemo(
    () =>
      [...filtradas]
        .sort((a, b) => b.confianza - a.confianza || (b.lat != null ? 1 : 0) - (a.lat != null ? 1 : 0))
        .slice(0, MAX_LISTA),
    [filtradas],
  );

  // Los chips cuentan lo que se vería al encender esa faceta: respetan las capas
  // (si el hub está apagado, sus personas no se prometen en el chip) pero ignoran
  // la faceta misma y los filtros del panel.
  const conteos = useMemo(() => {
    const c: Record<string, number> = {};
    for (const e of base) {
      if (!origenes.has(e.origen)) continue;
      if (e.origen === 'hub' && e.category === 'oferta' && !hubOfertas) continue;
      c[grupoDe(e)] = (c[grupoDe(e)] || 0) + 1;
    }
    return c;
  }, [base, origenes, hubOfertas]);



  const topCategorias = useMemo(() => {
    const c = new Map<string, number>();
    for (const e of base) {
      if (e.clase !== 'sitio' || !grupos.has(grupoDe(e))) continue;
      for (const cat of e.categorias) {
        const k = cat.trim();
        if (k) c.set(k, (c.get(k) || 0) + 1);
      }
    }
    return [...c.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k]) => k);
  }, [base, grupos]);

  const haySitiosConEstado = useMemo(
    () => base.some((e) => grupos.has(grupoDe(e)) && estadoDe(e) !== null),
    [base, grupos],
  );

  const zonas = (meta?.top_lugares ?? []).slice(0, 12);

  const handleSelect = useCallback((e: Entidad) => {
    setSelectedId(e.id);
    if (e.lat != null && e.lng != null) {
      setMapCenter([e.lat, e.lng]);
      setMapZoom(16);
    }
  }, []);

  const handleSelectPerson = useCallback((p: Person) => {
    setSelectedId(p.id);
    if (p.lat != null && p.lng != null) {
      setMapCenter([p.lat, p.lng]);
      setMapZoom(16);
    }
  }, []);

  function toggleCapa(key: string, on: boolean) {
    if (key === 'custom') {
      setCustomActiva(on);
      return;
    }
    setCapas((prev) => ({ ...prev, [key]: on }));
  }



  return (
    <div className="relative h-full w-full overflow-hidden bg-ap-bg">
      {/* Aviso de transparencia: qué datos se muestran y de dónde vienen. */}
      {infoMounted && (
        <div
          className={`fixed bottom-3 left-1/2 -translate-x-1/2 z-[1500] w-[min(94vw,440px)] pointer-events-none transition-opacity duration-500 ${infoOn ? 'opacity-100' : 'opacity-0'}`}
        >
          <div className="bg-white/85 backdrop-blur-lg border border-ap-border/60 rounded-2xl p-3 shadow-agentos-md pointer-events-auto relative">
            <button
              onClick={() => { setInfoOn(false); setTimeout(() => setInfoMounted(false), 500); }}
              aria-label="Cerrar aviso"
              className="text-ap-muted hover:text-ap-primary p-1 absolute top-1.5 right-1.5 transition-colors"
            >
              <X size={14} />
            </button>
            <div className="flex items-start gap-2.5 pr-4">
              <div className="bg-amber-100 text-amber-600 p-1.5 rounded-xl shrink-0 mt-0.5">
                <AlertTriangle size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-extrabold text-ap-primary text-[12.5px] font-outfit">Sobre estos datos</h2>
                <p className="text-[11.5px] text-ap-secondary mt-0.5 leading-normal">
                  Vista consolidada de fuentes públicas y comunitarias: personas, centros de acopio, refugios,
                  teléfonos, daños y servicios. AcopioVE los centraliza para facilitar la búsqueda; pueden contener
                  errores o estar desactualizados: verificá siempre con la fuente original.{' '}
                  <Link href="/docs/fuentes" className="font-bold text-ap-primary hover:underline">Ver fuentes</Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mapa a pantalla completa */}
      <div className="absolute inset-0 z-0">
        <PersonasMap
          persons={persons}
          selectedId={selectedId}
          onSelectPerson={handleSelectPerson}
          center={mapCenter}
          zoom={mapZoom}
          showSAR={capas.sar}
          smShakemap={capas.shakemap}
          smEpicentros={capas.epicentros}
          smReplicas={capas.replicas}
          show1967={capas.sismo1967}
          showRain={capas.lluvia}
          showClima={capas.clima}
          showAlertas={capas.alertas}
          showDanosIA={capas.danosIA}
        />
      </div>

      {/* Menú de navegación flotante en la esquina superior derecha */}
      <div className="fixed top-3 right-3 z-[1000] pointer-events-auto">
        <div className="relative">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="w-10 h-10 flex items-center justify-center bg-ap-surface border border-ap-border rounded-full shadow-agentos-md text-ap-primary hover:bg-ap-surface-hover transition-colors cursor-pointer"
            aria-label="Menú"
          >
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
          {menuOpen && (
            <div className="absolute top-full right-0 mt-2 w-60 bg-ap-surface border border-ap-border rounded-agentos-lg shadow-agentos-md overflow-hidden animate-fadeIn">
              <div className="px-4 py-2.5 text-[11px] font-bold text-ap-muted uppercase border-b border-ap-border">Navegación</div>
              <Link href="/" onClick={() => setMenuOpen(false)} className="flex w-full items-center gap-2.5 px-4 py-3 text-[13px] font-semibold text-ap-secondary hover:bg-ap-surface-hover transition-colors">
                <Home size={16} /> Inicio (AcopioVE)
              </Link>
              <Link href="/acopio" onClick={() => setMenuOpen(false)} className="flex w-full items-center gap-2.5 px-4 py-3 text-[13px] font-semibold text-ap-secondary hover:bg-ap-surface-hover transition-colors">
                <MapPin size={16} /> Mapa de Centros y Refugios
              </Link>
              <Link href="/docs/fuentes" onClick={() => setMenuOpen(false)} className="flex w-full items-center gap-2.5 px-4 py-3 text-[13px] font-semibold text-ap-secondary hover:bg-ap-surface-hover transition-colors">
                <Code size={16} /> Fuentes y APIs
              </Link>
              <Link href="/docs" onClick={() => setMenuOpen(false)} className="flex w-full items-center gap-2.5 px-4 py-3 text-[13px] font-semibold text-ap-secondary hover:bg-ap-surface-hover transition-colors">
                <Code size={16} /> Documentación de API
              </Link>
            </div>
          )}
        </div>
      </div>

      <ResultsPanel
        open={panelOpen}
        onOpenChange={setPanelOpen}
        loading={loading}
        error={error}
        searchLoading={searchLoading}
        isSearching={isSearching}
        total={meta?.total ?? entidades.length}
        lista={lista}
        filtradas={filtradas.length}
        selectedId={selectedId}
        onSelect={handleSelect}
        grupoFiltro={grupoFiltro}
        onToggleGrupo={setGrupoFiltro}
        conteos={conteos}
        zonas={zonas}
        zonaSel={zonaSel}
        onZona={setZonaSel}
        estadoPersona={estadoPersona}
        onEstadoPersona={setEstadoPersona}
        estadoFiltro={estadoFiltro}
        onEstadoFiltro={setEstadoFiltro}
        haySitiosConEstado={haySitiosConEstado}
        topCategorias={topCategorias}
        categoriaFiltro={categoriaFiltro}
        onCategoria={setCategoriaFiltro}
        query={query}
        onQueryChange={setQuery}
      />

      <LayersPanel
        capas={capas}
        onToggle={toggleCapa}
        hubOfertas={hubOfertas}
        onToggleHubOfertas={setHubOfertas}
        customApi={customNombre ? { nombre: customNombre, activa: customActiva, total: customData.length } : null}
        onOpenStats={() => setShowStats(true)}
        onOpenImport={() => setShowImport(true)}
      />

      {showStats && (
        <StatsModal
          entidades={entidades}
          customApi={customNombre ? { nombre: customNombre, total: customData.length } : null}
          onClose={() => setShowStats(false)}
        />
      )}

      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onImported={(nombre, nuevas) => {
            setCustomNombre(nombre);
            setCustomData(nuevas);
            setCustomActiva(true);
            setShowImport(false);
          }}
        />
      )}
    </div>
  );
}
