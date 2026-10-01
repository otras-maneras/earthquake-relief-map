'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, BarChart2, Plus } from 'lucide-react';
import { CAPAS, SECCIONES, type CapasState } from './entidad';

// Panel de capas: pegado al borde DERECHO, colapsado es una pestaña angosta.
// Incluye la leyenda del mapa como sección plegable — antes vivía dentro de
// PersonasMap y peleaba por el mismo borde.
export default function LayersPanel({
  capas,
  onToggle,
  hubOfertas,
  onToggleHubOfertas,
  customApi,
  onOpenStats,
  onOpenImport,
}: {
  capas: CapasState;
  onToggle: (key: string, on: boolean) => void;
  hubOfertas: boolean;
  onToggleHubOfertas: (on: boolean) => void;
  customApi: { nombre: string; activa: boolean; total: number } | null;
  onOpenStats: () => void;
  onOpenImport: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Mostrar capas del mapa"
        title="Capas del mapa"
        className="absolute top-[124px] right-0 z-[999] bg-white/90 backdrop-blur-md border border-ap-border border-r-0 rounded-l-xl shadow-agentos-md pointer-events-auto flex flex-col items-center gap-1.5 px-1.5 py-3 hover:bg-ap-surface-hover transition-colors"
      >
        <ChevronLeft size={14} className="text-ap-primary" />
        <span className="text-[9px] font-extrabold text-ap-primary uppercase tracking-wide [writing-mode:vertical-rl]">Capas</span>
      </button>
    );
  }

  return (
    <div className="absolute top-[124px] right-0 z-[999] bg-white/90 backdrop-blur-md border border-ap-border border-r-0 rounded-l-xl shadow-agentos-md flex flex-col w-[min(15rem,calc(100vw-1.5rem))] max-h-[calc(100dvh-190px)] pointer-events-auto overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(false)}
        aria-expanded={open}
        className="shrink-0 flex items-center justify-between w-full text-[10.5px] font-extrabold text-ap-primary uppercase tracking-wide cursor-pointer select-none px-3 pt-3 pb-2 border-b border-ap-border/50"
      >
        <ChevronRight size={14} className="text-ap-muted" />
        <span>Capas del Mapa</span>
      </button>

      <div className="overflow-y-auto overscroll-contain min-h-0 px-3 pb-3 pt-2.5 flex flex-col gap-2.5">
        <div className="flex flex-col gap-3">
          {SECCIONES.map((seccion) => (
            <LayerSection key={seccion} title={seccion}>
              {CAPAS.filter((c) => c.seccion === seccion).map((c) => (
                <div key={c.key}>
                  <LayerToggle
                    checked={!!capas[c.key]}
                    onChange={(v) => onToggle(c.key, v)}
                    color={c.color}
                    title={c.title}
                    sub={c.sub}
                  />
                  {c.key === 'hub' && capas.hub && (
                    <label className="flex items-center gap-2.5 text-[11.5px] font-semibold text-ap-secondary cursor-pointer select-none ml-6 mt-1">
                      <input
                        type="checkbox"
                        checked={hubOfertas}
                        onChange={(e) => onToggleHubOfertas(e.target.checked)}
                        className="rounded border-ap-border text-ap-primary focus:ring-ap-primary cursor-pointer w-3.5 h-3.5 shrink-0"
                      />
                      <span className="text-ap-secondary">Mostrar ofertas de ayuda</span>
                    </label>
                  )}
                </div>
              ))}
            </LayerSection>
          ))}

          {customApi && (
            <LayerSection title="Otros">
              <LayerToggle
                checked={customApi.activa}
                onChange={(v) => onToggle('custom', v)}
                color="#1e293b"
                title={customApi.nombre}
                sub={`API externa · ${customApi.total} registros`}
              />
            </LayerSection>
          )}
        </div>

        {/* Leyenda del mapa: qué significa cada pin. */}
        <div className="pt-2 border-t border-ap-border/40">
          <button
            type="button"
            onClick={() => setLegendOpen((o) => !o)}
            aria-expanded={legendOpen}
            className="flex items-center justify-between w-full text-[9.5px] font-extrabold text-ap-muted uppercase tracking-wide cursor-pointer"
          >
            <span>Leyenda del mapa</span>
            <ChevronRight size={12} className={`text-ap-muted transition-transform ${legendOpen ? 'rotate-90' : ''}`} />
          </button>
          {legendOpen && (
            <div className="flex flex-col gap-2 mt-2">
              {LEYENDA.map((l) => (
                <div key={l.label} className="flex items-center gap-2.5 leading-tight">
                  <span
                    className="w-4.5 h-4.5 rounded-full shrink-0 flex items-center justify-center text-white"
                    style={{ background: l.color }}
                    dangerouslySetInnerHTML={{ __html: l.svg }}
                  />
                  <span className="text-[11px] font-semibold text-ap-secondary">{l.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-1 pt-3 border-t border-ap-border/50 flex flex-col gap-1.5">
          <button
            onClick={onOpenStats}
            className="flex items-center justify-center gap-1.5 w-full py-2 bg-ap-bg hover:bg-ap-surface-hover border border-ap-border rounded-lg text-[11px] font-bold text-ap-primary transition-colors cursor-pointer"
          >
            <BarChart2 size={13} /> Estadísticas de APIs
          </button>
          <button
            onClick={onOpenImport}
            className="flex items-center justify-center gap-1.5 w-full py-2 bg-ap-primary hover:opacity-90 rounded-lg text-[11px] font-bold text-white transition-opacity cursor-pointer"
          >
            <Plus size={13} /> Cargar API Externa
          </button>
        </div>
      </div>
    </div>
  );
}

// Mismos colores y dibujos que los pines de PersonasMap.
const LEYENDA: { label: string; color: string; svg: string }[] = [
  { label: 'Persona localizada', color: '#059669', svg: '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>' },
  { label: 'Persona desaparecida', color: '#ef4444', svg: '<span style="font:900 9.5px sans-serif;line-height:1">!</span>' },
  { label: 'Centro de acopio', color: '#7c3aed', svg: '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><rect x="3" y="8" width="18" height="12"/><rect x="2" y="4" width="20" height="4"/><path d="M12 4v16"/></svg>' },
  { label: 'Refugio', color: '#0f766e', svg: '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M3 10l9-7 9 7v10H3z"/></svg>' },
  { label: 'Centro de salud', color: '#0e7490', svg: '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round"><path d="M12 4v16M4 12h16"/></svg>' },
  { label: 'Centro de insumos', color: '#8b5cf6', svg: '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>' },
  { label: 'Daño de estructura', color: '#db2777', svg: '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>' },
  { label: 'Servicio / escasez', color: '#f59e0b', svg: '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>' },
  { label: 'Venezuela Ayuda (hub)', color: '#0891b2', svg: '<svg width="9" height="9" viewBox="0 0 24 24" fill="white" stroke="none"><circle cx="9" cy="7" r="3"/><path d="M3 21c0-3.3 2.7-5 6-5s6 1.7 6 5"/><circle cx="17" cy="9" r="2.2"/></svg>' },
  { label: 'De Mano en Mano', color: '#0d9488', svg: '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round"><path d="M12 6v12M6 12h12"/></svg>' },
  { label: 'Grupo mixto (varios)', color: '#1e293b', svg: '<span style="font:900 9.5px sans-serif;line-height:1">3</span>' },
];

function LayerSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 pt-2 border-t border-ap-border/40 first:pt-0 first:border-t-0">
      <div className="text-[9.5px] font-extrabold text-ap-muted uppercase tracking-wide">{title}</div>
      {children}
    </div>
  );
}

function LayerToggle({
  checked,
  onChange,
  color,
  title,
  sub,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  color: string;
  title: string;
  sub?: string;
}) {
  return (
    <label className="flex items-start gap-2.5 text-[12px] font-semibold text-ap-secondary cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded border-ap-border text-ap-primary focus:ring-ap-primary cursor-pointer w-4 h-4 shrink-0 mt-0.5"
      />
      <span className="w-2.5 h-2.5 rounded-full shrink-0 mt-1.5" style={{ background: color }} />
      <div className="flex flex-col leading-tight min-w-0">
        <span className="font-bold text-ap-primary truncate">{title}</span>
        {sub && <span className="text-[9.5px] text-ap-muted font-normal">{sub}</span>}
      </div>
    </label>
  );
}
