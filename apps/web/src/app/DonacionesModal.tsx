'use client';

import { useState } from 'react';
import { X, HeartHandshake, Search, ExternalLink, Share2 } from 'lucide-react';
import { donaciones as donacionesList } from '@/lib/donaciones';

export default function DonacionesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState(false);

  const handleShare = () => {
    if (typeof window === 'undefined') return;
    navigator.clipboard.writeText(`${window.location.origin}/?modal=donaciones`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (!open) return null;

  const filtrados = donacionesList.filter((d) => {
    const q = search.toLowerCase();
    return (
      d.name.toLowerCase().includes(q) ||
      d.description.toLowerCase().includes(q) ||
      d.category.toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-[2000] bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
      <div className="bg-ap-surface w-full max-w-[500px] max-h-[85dvh] rounded-t-[20px] sm:rounded-agentos-lg border border-ap-border shadow-agentos-md flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-ap-border shrink-0">
          <div className="flex items-center gap-2">
            <HeartHandshake size={18} className="text-rose-500 animate-pulse" />
            <h2 className="font-extrabold text-ap-primary font-outfit text-[16px]">Donaciones</h2>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleShare}
              className={`px-2 py-1.5 rounded-xl border text-[11px] font-extrabold transition-all duration-200 flex items-center gap-1 leading-none shadow-sm ${
                copied
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-white text-ap-primary border-ap-border hover:bg-ap-surface-hover'
              }`}
              title="Copiar enlace directo"
            >
              <Share2 size={13} />
              {copied ? '¡Copiado!' : 'Compartir'}
            </button>
            <button onClick={onClose} className="text-ap-muted hover:text-ap-primary p-1 transition-colors"><X size={20} /></button>
          </div>
        </div>

        {/* Buscador */}
        <div className="shrink-0 px-4 py-3 border-b border-ap-border bg-ap-surface-hover/50">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-ap-muted" size={16} />
            <input
              type="text"
              placeholder="Buscar organización o tipo de ayuda..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-ap-border rounded-xl text-[13px] bg-white text-ap-primary outline-none focus:border-ap-secondary transition-colors"
            />
          </div>
        </div>

        {/* Listado */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 bg-ap-bg/30">
          <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-[11.5px] text-rose-900 leading-normal mb-1 font-semibold">
            💗 Canales oficiales y verificados para donar. Al pulsar "Donar" saldrás del sitio hacia la página de la organización.
          </div>
          {filtrados.length === 0 && (
            <div className="text-ap-muted text-sm text-center py-8">No se encontraron resultados.</div>
          )}
          {filtrados.map((d, idx) => (
            <div
              key={idx}
              className="bg-white border border-ap-border hover:border-ap-muted rounded-xl p-3 flex items-start justify-between gap-3 shadow-sm hover:shadow-md transition-all duration-200"
            >
              <img
                src={d.logo}
                alt={`Logo de ${d.name}`}
                className="shrink-0 w-11 h-11 rounded-lg object-contain bg-white border border-ap-border p-1"
                loading="lazy"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-bold text-ap-primary text-[14px] leading-tight">{d.name}</span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-ap-bg border border-ap-border text-ap-secondary">
                    {d.category}
                  </span>
                </div>
                <p className="text-[12px] text-ap-secondary mt-1 leading-relaxed">{d.description}</p>
              </div>

              <a
                href={d.url}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 flex items-center gap-1.5 bg-rose-500 hover:bg-rose-600 text-white font-extrabold text-[12px] px-3 py-2 rounded-xl transition-all shadow-sm"
              >
                <ExternalLink size={13} />
                Donar
              </a>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
