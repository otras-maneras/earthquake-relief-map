'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  X, MapPin, Layers, ChevronRight, ExternalLink,
  Package, Home, Stethoscope, AlertTriangle, Wrench, User, Phone,
  SlidersHorizontal, ChevronDown, Trash2, Search
} from 'lucide-react';
import {
  GRUPOS, grupoDe, estadoDe, fmtFecha, ESTADO_STYLE,
  type Entidad,
} from './entidad';

export type ResultsPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading: boolean;
  error: boolean;
  searchLoading: boolean;
  isSearching: boolean;
  total: number;
  lista: Entidad[];
  filtradas: number;
  selectedId: string | null;
  onSelect: (e: Entidad) => void;
  
  // Props para integrar facetas (selectores principales)
  grupoFiltro: string;
  onToggleGrupo: (key: string) => void;
  conteos: Record<string, number>;

  zonas: { lugar: string; n: number }[];
  zonaSel: string | null;
  onZona: (z: string | null) => void;
  estadoPersona: 'all' | 'localizado' | 'desaparecido';
  onEstadoPersona: (s: 'all' | 'localizado' | 'desaparecido') => void;
  estadoFiltro: 'all' | 'abierto' | 'lleno' | 'cerrado';
  onEstadoFiltro: (s: 'all' | 'abierto' | 'lleno' | 'cerrado') => void;
  haySitiosConEstado: boolean;
  topCategorias: string[];
  categoriaFiltro: string | null;
  onCategoria: (c: string | null) => void;
  query: string;
  onQueryChange: (q: string) => void;
};

export default function ResultsPanel(p: ResultsPanelProps) {
  const [filtrosExpanded, setFiltrosExpanded] = useState(false);

  const activeFiltersCount =
    (p.grupoFiltro !== 'all' ? 1 : 0) +
    (p.zonaSel ? 1 : 0) +
    (p.estadoPersona !== 'all' ? 1 : 0) +
    (p.estadoFiltro !== 'all' ? 1 : 0) +
    (p.categoriaFiltro ? 1 : 0);

  const handleClearAll = () => {
    p.onToggleGrupo('all');
    p.onZona(null);
    p.onEstadoPersona('all');
    p.onEstadoFiltro('all');
    p.onCategoria(null);
  };

  // Mostrar condicionalmente los filtros específicos según el grupo activo
  const mostrarEstadoPersona = p.grupoFiltro === 'all' || p.grupoFiltro === 'persona';
  const mostrarEstadoSitio = p.grupoFiltro === 'all' || ['acopio', 'refugio', 'salud'].includes(p.grupoFiltro);
  const mostrarInsumos = p.grupoFiltro === 'all' || ['acopio', 'refugio'].includes(p.grupoFiltro);

  if (!p.open) {
    return (
      <>
        {/* Móvil: barra inferior tipo peek */}
        <button
          onClick={() => p.onOpenChange(true)}
          className="md:hidden absolute bottom-0 left-0 right-0 z-[1000] bg-ap-surface/95 backdrop-blur-md border-t border-ap-border px-4 py-3 flex items-center justify-between pointer-events-auto"
        >
          <span className="text-[13px] font-bold text-ap-primary flex items-center gap-2">
            <Layers size={15} /> Resultados ({p.filtradas})
          </span>
          <ChevronRight size={15} className="text-ap-muted -rotate-90" />
        </button>
        {/* Desktop: pestaña pegada al borde izquierdo (alineada a top-[120px]) */}
        <button
          onClick={() => p.onOpenChange(true)}
          aria-label="Mostrar resultados"
          className="hidden md:flex absolute top-[120px] left-0 z-[1000] bg-white/90 backdrop-blur-md border border-ap-border border-l-0 rounded-r-xl shadow-agentos-md flex-col items-center gap-1.5 px-1.5 py-3 hover:bg-ap-surface-hover transition-colors pointer-events-auto cursor-pointer"
        >
          <ChevronRight size={14} className="text-ap-primary" />
          <span className="text-[9px] font-extrabold text-ap-primary uppercase tracking-wide [writing-mode:vertical-rl]">
            Resultados ({p.filtradas})
          </span>
        </button>
      </>
    );
  }

  return (
    <div
      className="absolute z-[1000] bg-ap-surface border border-ap-border shadow-agentos-md flex flex-col
                 left-0 right-0 bottom-0 max-h-[70dvh] rounded-t-2xl
                 md:left-0 md:top-0 md:bottom-0 md:right-auto md:w-[25rem] md:rounded-none md:border-y-0 md:border-l-0 md:border-r md:max-h-none"
    >
      {/* Cabecera del panel con buscador y 3D integrados */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-ap-border shrink-0 gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {/* Botón 3D */}
          <Link
            href="/mapa-3d"
            className="w-8 h-8 flex items-center justify-center bg-ap-bg border border-ap-border hover:border-ap-muted rounded-xl shadow-sm text-ap-primary hover:bg-ap-surface-hover transition-colors font-outfit font-extrabold text-[11px] tracking-tight shrink-0"
            title="Ver edificios dañados en 3D"
            aria-label="Ver edificios dañados en 3D"
          >
            3D
          </Link>
          {/* Barra de búsqueda */}
          <div className="bg-ap-bg border border-ap-border rounded-xl shadow-sm flex items-center px-2.5 h-8 flex-1 min-w-0">
            <Search size={14} className="text-ap-muted shrink-0" />
            <input
              value={p.query}
              onChange={(e) => p.onQueryChange(e.target.value)}
              placeholder="Buscar..."
              className="flex-1 bg-transparent outline-none px-2 text-[12px] text-ap-primary placeholder:text-ap-muted min-w-0 font-medium"
            />
            {p.query && (
              <button onClick={() => p.onQueryChange('')} className="text-ap-muted hover:text-ap-primary p-0.5" aria-label="Limpiar">
                <X size={13} />
              </button>
            )}
          </div>
        </div>
        <button onClick={() => p.onOpenChange(false)} className="text-ap-muted hover:text-ap-primary p-1 shrink-0" aria-label="Cerrar panel">
          <X size={18} />
        </button>
      </div>

      {/* Filtros Avanzados (Colapsable y unificado) */}
      <div className="shrink-0 border-b border-ap-border bg-ap-bg/10">
        <button
          onClick={() => setFiltrosExpanded(!filtrosExpanded)}
          className="w-full flex items-center justify-between px-4 py-3 text-[11px] font-extrabold text-ap-secondary hover:bg-ap-surface-hover transition-colors"
        >
          <span className="flex items-center gap-1.5 uppercase tracking-wider">
            <SlidersHorizontal size={13} />
            Filtros Avanzados
            {activeFiltersCount > 0 && (
              <span className="bg-ap-primary text-white text-[9.5px] px-1.5 py-0.2 rounded-full font-mono leading-none">
                {activeFiltersCount}
              </span>
            )}
          </span>
          <ChevronRight
            size={14}
            className={`text-ap-muted transition-transform duration-200 ${filtrosExpanded ? 'rotate-90' : ''}`}
          />
        </button>

        {filtrosExpanded && (
          <div className="px-4 pb-4 pt-1 space-y-3.5 animate-fadeIn">
            {/* Filtro: Categoría (Facets integrados) */}
            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-extrabold text-ap-muted uppercase tracking-wider">Categoría</label>
              <div className="relative">
                <select
                  value={p.grupoFiltro}
                  onChange={(e) => p.onToggleGrupo(e.target.value)}
                  className="w-full bg-ap-surface border border-ap-border rounded-xl px-3 py-1.5 text-[11.5px] font-bold text-ap-primary outline-none appearance-none hover:border-ap-muted transition-colors cursor-pointer"
                >
                  <option value="all">Todas las categorías ({p.total})</option>
                  {GRUPOS.map((g) => (
                    <option key={g.key} value={g.key}>
                      {g.label} ({p.conteos[g.key] || 0})
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-ap-muted">
                  <ChevronDown size={13} />
                </div>
              </div>
            </div>

            {/* Filtro: Zona (Dropdown) */}
            {p.zonas.length > 0 && (
              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-extrabold text-ap-muted uppercase tracking-wider">Zona / Municipio</label>
                <div className="relative">
                  <select
                    value={p.zonaSel || ''}
                    onChange={(e) => p.onZona(e.target.value || null)}
                    className="w-full bg-ap-surface border border-ap-border rounded-xl px-3 py-1.5 text-[11.5px] font-bold text-ap-primary outline-none appearance-none hover:border-ap-muted transition-colors cursor-pointer"
                  >
                    <option value="">Todas las zonas</option>
                    {p.zonas.map((z) => (
                      <option key={z.lugar} value={z.lugar}>
                        {z.lugar} ({z.n})
                      </option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-ap-muted">
                    <ChevronDown size={13} />
                  </div>
                </div>
              </div>
            )}

            {/* Filtro: Estado de Persona (Segmented Control) */}
            {mostrarEstadoPersona && (
              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-extrabold text-ap-muted uppercase tracking-wider">Estado de Persona</label>
                <div className="flex bg-ap-surface border border-ap-border/60 p-0.5 rounded-xl">
                  {([
                    { key: 'all', label: 'Todas' },
                    { key: 'desaparecido', label: 'Se busca' },
                    { key: 'localizado', label: 'Localizadas' }
                  ] as const).map((opt) => {
                    const active = p.estadoPersona === opt.key;
                    return (
                      <button
                        key={opt.key}
                        onClick={() => p.onEstadoPersona(opt.key)}
                        className={`flex-1 py-1 text-[10.5px] font-bold rounded-lg transition-all ${
                          active
                            ? 'bg-ap-bg shadow-sm text-ap-primary border border-ap-border/30'
                            : 'text-ap-muted hover:text-ap-secondary'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Filtro: Estado de Sitio (Segmented Control) */}
            {mostrarEstadoSitio && p.haySitiosConEstado && (
              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-extrabold text-ap-muted uppercase tracking-wider">Estado de Sitio</label>
                <div className="flex bg-ap-surface border border-ap-border/60 p-0.5 rounded-xl">
                  {([
                    { key: 'all', label: 'Todos' },
                    { key: 'abierto', label: 'Abiertos' },
                    { key: 'lleno', label: 'Llenos' },
                    { key: 'cerrado', label: 'Cerrados' }
                  ] as const).map((opt) => {
                    const active = p.estadoFiltro === opt.key;
                    return (
                      <button
                        key={opt.key}
                        onClick={() => p.onEstadoFiltro(opt.key)}
                        className={`flex-1 py-1 text-[10.5px] font-bold rounded-lg transition-all ${
                          active
                            ? 'bg-ap-bg shadow-sm text-ap-primary border border-ap-border/30'
                            : 'text-ap-muted hover:text-ap-secondary'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Filtro: Recibe / Necesita (Dropdown) */}
            {mostrarInsumos && p.topCategorias.length > 0 && (
              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-extrabold text-ap-muted uppercase tracking-wider">Recibe / Necesita (Insumo)</label>
                <div className="relative">
                  <select
                    value={p.categoriaFiltro || ''}
                    onChange={(e) => p.onCategoria(e.target.value || null)}
                    className="w-full bg-ap-surface border border-ap-border rounded-xl px-3 py-1.5 text-[11.5px] text-ap-primary outline-none appearance-none hover:border-ap-muted transition-colors cursor-pointer"
                  >
                    <option value="">Todas las categorías / necesidades</option>
                    {p.topCategorias.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-ap-muted">
                    <ChevronDown size={13} />
                  </div>
                </div>
              </div>
            )}

            {/* Limpiar Filtros */}
            {activeFiltersCount > 0 && (
              <button
                onClick={handleClearAll}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 border border-dashed border-ap-border rounded-xl text-[10.5px] font-extrabold text-ap-muted hover:text-red-500 hover:border-red-200 transition-colors"
              >
                <Trash2 size={12} /> Limpiar todos los filtros
              </button>
            )}
          </div>
        )}
      </div>

      {/* Listado de resultados */}
      <div className="overflow-y-auto flex-1 p-2.5 space-y-2">
        {p.error && <div className="text-[12px] text-red-600 p-3">No se pudieron cargar los datos. Reintentá.</div>}
        {!p.loading && !p.error && p.lista.length === 0 && (
          <div className="text-[12px] text-ap-muted p-3 text-center">Sin resultados para el filtro actual.</div>
        )}
        {p.lista.map((e) => (
          <Ficha
            key={e.id}
            e={e}
            active={p.selectedId === e.id}
            onSelect={() => p.onSelect(e)}
            categoriaFiltro={p.categoriaFiltro}
            onCategoria={p.onCategoria}
          />
        ))}
        {p.filtradas > p.lista.length && (
          <div className="text-[11px] text-ap-muted text-center py-2">
            Mostrando {p.lista.length} de {p.filtradas}. Refiná con el buscador.
          </div>
        )}
      </div>

      <div className="px-4 py-3 border-t border-ap-border text-[10.5px] text-ap-muted shrink-0">
        Datos consolidados de fuentes públicas y comunitarias (incl. Venezuela Reporta).{' '}
        <Link href="/docs/fuentes" className="font-bold text-ap-primary hover:underline">Ver fuentes</Link>
      </div>
    </div>
  );
}

function tipoIcon(e: Entidad) {
  if (e.tipo === 'acopio')   return <Package size={15} className="text-violet-500 shrink-0" />;
  if (e.tipo === 'refugio')  return <Home size={15} className="text-teal-700 shrink-0" />;
  if (e.tipo === 'salud')    return <Stethoscope size={15} className="text-cyan-700 shrink-0" />;
  if (e.tipo === 'telefono') return <Phone size={15} className="text-slate-500 shrink-0" />;
  if (e.tipo === 'dano')     return <AlertTriangle size={15} className="text-pink-600 shrink-0" />;
  if (e.tipo === 'servicio' || e.tipo === 'necesidad') return <Wrench size={15} className="text-amber-500 shrink-0" />;
  return <User size={15} className="text-red-500 shrink-0" />;
}

function Ficha({
  e,
  active,
  onSelect,
  categoriaFiltro,
  onCategoria,
}: {
  e: Entidad;
  active: boolean;
  onSelect: () => void;
  categoriaFiltro: string | null;
  onCategoria: (c: string | null) => void;
}) {
  const g = GRUPOS.find((x) => x.key === grupoDe(e))!;
  const fecha = fmtFecha(e.fecha);
  const est = estadoDe(e);
  // Desglose por fuente para auditar la conciliación (enlace propio por fuente).
  const sources =
    e.fuentes_detalle && e.fuentes_detalle.length
      ? e.fuentes_detalle
      : [{ fuente: e.fuente, ficha_url: e.ficha_url, fuente_url: e.fuente_url }];

  return (
    <div
      onClick={onSelect}
      className={`cursor-pointer rounded-agentos-lg border p-3 transition-colors ${
        active ? 'border-ap-primary bg-ap-surface-hover' : 'border-ap-border hover:border-ap-muted'
      }`}
    >
      <div className="flex items-start gap-2.5">
        <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: g.color }} />
          {tipoIcon(e)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-bold text-ap-primary text-[13.5px] leading-tight font-outfit truncate">{e.nombre}</span>
            <span
              className="shrink-0 text-[8.5px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider text-white"
              style={{ backgroundColor: g.color }}
            >
              {g.label}
            </span>
            {est && (
              <span className={`shrink-0 text-[8.5px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider border ${ESTADO_STYLE[est].cls}`}>
                {ESTADO_STYLE[est].label}
              </span>
            )}
            {e.confianza > 1 && (
              <span className="shrink-0 text-[8.5px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                {e.confianza} fuentes
              </span>
            )}
          </div>

          {e.status && !est && <div className="text-[11px] text-ap-secondary mt-0.5">{e.status}</div>}
          {e.lugar && <div className="text-[11.5px] text-ap-muted truncate mt-0.5">{e.lugar}</div>}
          {e.cedula && (
            <div className="text-[11px] text-ap-secondary mt-0.5">Documento: <span className="font-mono">{e.cedula}</span></div>
          )}
          {e.telefono && (
            <div className="text-[11px] text-ap-secondary mt-0.5">Tel: <span className="font-mono">{e.telefono}</span></div>
          )}

          {e.categorias.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {e.categorias.slice(0, 6).map((c) => {
                const on = categoriaFiltro === c;
                return (
                  <button
                    key={c}
                    onClick={(ev) => { ev.stopPropagation(); onCategoria(on ? null : c); }}
                    className={`text-[9.5px] font-semibold px-1.5 py-0.5 rounded-full border transition-colors ${
                      on ? 'bg-violet-600 text-white border-violet-600' : 'bg-violet-50 text-violet-700 border-violet-100 hover:border-violet-300'
                    }`}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          )}

          {e.observaciones && (
            <div className="text-[11px] text-ap-secondary bg-ap-bg/50 px-2 py-1 rounded border border-ap-border/50 italic leading-snug mt-1 line-clamp-3">
              {e.observaciones}
            </div>
          )}

          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            <span className="text-[9.5px] text-ap-muted font-semibold uppercase tracking-wide mr-0.5">
              {sources.length > 1 ? 'Fuentes' : 'Fuente'}
            </span>
            {sources.map((s, i) => {
              const url = s.ficha_url || s.fuente_url;
              return url ? (
                <a
                  key={`${s.fuente}-${i}`}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(ev) => ev.stopPropagation()}
                  className="inline-flex items-center gap-0.5 text-[9.5px] font-semibold px-1.5 py-0.5 rounded-full bg-ap-bg border border-ap-border text-ap-secondary hover:border-ap-primary hover:text-ap-primary transition-colors"
                >
                  {s.fuente} <ExternalLink size={9} />
                </a>
              ) : (
                <span
                  key={`${s.fuente}-${i}`}
                  className="text-[9.5px] font-semibold px-1.5 py-0.5 rounded-full bg-ap-bg border border-ap-border text-ap-muted"
                >
                  {s.fuente}
                </span>
              );
            })}
            {fecha && <span className="text-[10px] text-ap-muted ml-auto shrink-0">{fecha}</span>}
          </div>
        </div>
        {e.lat != null && e.lng != null && <MapPin size={13} className="text-emerald-600 shrink-0 mt-0.5" />}
      </div>
    </div>
  );
}
