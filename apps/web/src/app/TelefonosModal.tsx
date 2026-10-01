'use client';

import { useEffect, useState } from 'react';
import { X, Phone, Search, Globe, MapPin } from 'lucide-react';
import { type Telefono } from '@/db/schema';

export default function TelefonosModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [telefonos, setTelefonos] = useState<Telefono[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filtroCiudad, setFiltroCiudad] = useState('');

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch('/api/telefonos')
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setTelefonos(Array.isArray(d) ? d : []))
      .catch(() => setTelefonos([]))
      .finally(() => setLoading(false));
  }, [open]);

  if (!open) return null;

  const ciudades = Array.from(new Set(telefonos.map((t) => t.ciudad).filter(Boolean) as string[])).sort();

  const filtrados = telefonos.filter((t) => {
    const matchSearch =
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      (t.description && t.description.toLowerCase().includes(search.toLowerCase())) ||
      t.number.includes(search);
    const matchCiudad = !filtroCiudad || t.ciudad === filtroCiudad;
    return matchSearch && matchCiudad;
  });

  return (
    <div className="fixed inset-0 z-[2000] bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
      <div className="bg-ap-surface w-full max-w-[500px] max-h-[85dvh] rounded-t-[20px] sm:rounded-agentos-lg border border-ap-border shadow-agentos-md flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-ap-border shrink-0">
          <div className="flex items-center gap-2">
            <Phone size={18} className="text-ap-success animate-pulse" />
            <h2 className="font-extrabold text-ap-primary font-outfit text-[16px]">Teléfonos de Emergencia</h2>
          </div>
          <button onClick={onClose} className="text-ap-muted hover:text-ap-primary p-1 transition-colors"><X size={20} /></button>
        </div>

        {/* Buscador y filtro */}
        <div className="shrink-0 px-4 py-3 border-b border-ap-border bg-ap-surface-hover/50 flex flex-col gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-ap-muted" size={16} />
            <input
              type="text"
              placeholder="Buscar entidad (ej: Bomberos, Cruz Roja)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-ap-border rounded-xl text-[13px] bg-white text-ap-primary outline-none focus:border-ap-secondary transition-colors"
            />
          </div>
          {ciudades.length > 0 && (
            <div className="flex gap-2">
              <select
                value={filtroCiudad}
                onChange={(e) => setFiltroCiudad(e.target.value)}
                className="w-full text-[12px] font-semibold text-ap-primary bg-white border border-ap-border rounded-lg px-2.5 py-1.5 outline-none focus:border-ap-secondary"
              >
                <option value="">Todas las ciudades</option>
                {ciudades.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}
        </div>

        {/* Listado */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 bg-ap-bg/30">
          {loading && <div className="text-ap-muted text-sm text-center py-8">Cargando teléfonos…</div>}
          {!loading && filtrados.length === 0 && (
            <div className="text-ap-muted text-sm text-center py-8">No se encontraron números de emergencia.</div>
          )}
          {!loading && filtrados.map((t) => (
            <div
              key={t.id}
              className="bg-white border border-ap-border hover:border-ap-muted rounded-xl p-3 flex items-start justify-between gap-3 shadow-sm hover:shadow-md transition-all duration-200"
            >
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-ap-primary text-[14px] leading-tight">{t.name}</h3>
                {t.description && <p className="text-[11.5px] text-ap-secondary mt-1">{t.description}</p>}
                
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-2 text-[10.5px] text-ap-muted">
                  {t.ciudad && (
                    <span className="flex items-center gap-0.5">
                      <MapPin size={11} /> {t.ciudad}
                    </span>
                  )}
                  {t.pais && (
                    <span className="flex items-center gap-0.5">
                      <Globe size={11} /> {t.pais}
                    </span>
                  )}
                </div>
              </div>
              
              <a
                href={`tel:${t.number.replace(/\s+/g, '')}`}
                className="shrink-0 flex items-center gap-1 bg-ap-success hover:bg-emerald-700 text-white font-extrabold text-[12px] px-3.5 py-2 rounded-xl transition-all duration-150 hover:scale-105 active:scale-95 shadow-sm shadow-emerald-200"
              >
                <Phone size={13} fill="white" />
                {t.number}
              </a>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
