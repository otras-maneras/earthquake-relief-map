'use client';

import { useEffect, useState } from 'react';
import { X, Languages, Search, MapPin, Globe, MessageCircle, PhoneCall, Share2 } from 'lucide-react';

interface Volunteer {
  id: string;
  full_name: string;
  phone: string;
  contact_channels: string[] | null;
  languages: string[] | null;
  fluency: string;
  technical_knowledge: boolean;
  in_venezuela: boolean;
  state: string | null;
  city: string | null;
  can_travel: string | null;
  support_types: string[] | null;
  availability: string[] | null;
}

export default function VoluntariosModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('');
  const [selectedSupport, setSelectedSupport] = useState('');
  const [copied, setCopied] = useState(false);

  const handleShare = () => {
    if (typeof window === 'undefined') return;
    const url = `${window.location.origin}/?modal=voluntarios`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    
    // Proxy propio: cachea en CDN y sirve la copia de respaldo si la fuente cae.
    fetch('/api/voluntarios')
      .then((r) => (r.ok ? r.json() : { volunteers: [] }))
      .then((d) => setVolunteers(Array.isArray(d?.volunteers) ? d.volunteers : []))
      .catch(() => setVolunteers([]))
      .finally(() => setLoading(false));
  }, [open]);

  if (!open) return null;

  // Extraer lista de idiomas únicos de forma dinámica y segura
  const allLanguages = Array.from(
    new Set(volunteers.flatMap((v) => v.languages || []).filter(Boolean))
  ).sort();

  const filtrados = volunteers.filter((v) => {
    const matchSearch =
      v.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (v.city && v.city.toLowerCase().includes(search.toLowerCase())) ||
      (v.state && v.state.toLowerCase().includes(search.toLowerCase()));

    const matchLang = !selectedLanguage || (v.languages && v.languages.includes(selectedLanguage));
    
    const supportList = v.support_types || [];
    const matchSupport =
      !selectedSupport ||
      (selectedSupport === 'presencial' && supportList.some(s => s.toLowerCase().includes('presencial'))) ||
      (selectedSupport === 'remoto' && supportList.some(s => s.toLowerCase().includes('remota') || s.toLowerCase().includes('online')));

    return matchSearch && matchLang && matchSupport;
  });

  const cleanPhone = (phone: string | null | undefined) => {
    if (!phone) return '';
    const cleaned = phone.replace(/[^0-9+]/g, '');
    if (cleaned.startsWith('0')) {
      return '+58' + cleaned.substring(1);
    }
    if (cleaned.startsWith('58') && !cleaned.startsWith('+')) {
      return '+' + cleaned;
    }
    return cleaned;
  };

  return (
    <div className="fixed inset-0 z-[2000] bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
      <div className="bg-ap-surface w-full max-w-[500px] max-h-[85dvh] rounded-t-[20px] sm:rounded-agentos-lg border border-ap-border shadow-agentos-md flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-ap-border shrink-0">
          <div className="flex items-center gap-2">
            <Languages size={18} className="text-ap-success animate-pulse" />
            <h2 className="font-extrabold text-ap-primary font-outfit text-[16px]">Voluntarios Intérpretes</h2>
            {!loading && (
              <span className="text-[11px] font-bold text-ap-muted bg-ap-bg px-2.5 py-0.5 rounded-full border border-ap-border">
                {filtrados.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleShare}
              className={`px-2 py-1.5 rounded-xl border text-[11px] font-extrabold transition-all duration-200 flex items-center gap-1 leading-none shadow-sm ${
                copied
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-white text-ap-primary border-ap-border hover:bg-ap-surface-hover'
              }`}
              title="Copiar enlace directo de compartir"
            >
              <Share2 size={13} />
              {copied ? '¡Copiado!' : 'Compartir'}
            </button>
            <button onClick={onClose} className="text-ap-muted hover:text-ap-primary p-1 transition-colors"><X size={20} /></button>
          </div>
        </div>

        {/* Buscador y Filtros */}
        <div className="shrink-0 px-4 py-3 border-b border-ap-border bg-ap-surface-hover/50 flex flex-col gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-ap-muted" size={16} />
            <input
              type="text"
              placeholder="Buscar por nombre, ciudad o estado..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-ap-border rounded-xl text-[13px] bg-white text-ap-primary outline-none focus:border-ap-secondary transition-colors"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="text-[12px] font-semibold text-ap-primary bg-white border border-ap-border rounded-lg px-2.5 py-1.5 outline-none focus:border-ap-secondary"
            >
              <option value="">Todos los idiomas</option>
              {allLanguages.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
            <select
              value={selectedSupport}
              onChange={(e) => setSelectedSupport(e.target.value)}
              className="text-[12px] font-semibold text-ap-primary bg-white border border-ap-border rounded-lg px-2.5 py-1.5 outline-none focus:border-ap-secondary"
            >
              <option value="">Cualquier modalidad</option>
              <option value="presencial">Presencial (Terreno)</option>
              <option value="remoto">Remoto (Online/Tlf)</option>
            </select>
          </div>
        </div>

        {/* Listado */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 bg-ap-bg/30">
          {loading && <div className="text-ap-muted text-sm text-center py-8">Cargando voluntarios…</div>}
          {!loading && filtrados.length === 0 && (
            <div className="text-ap-muted text-sm text-center py-8">No se encontraron voluntarios.</div>
          )}
          {!loading && filtrados.map((v) => (
            <div
              key={v.id}
              className="bg-white border border-ap-border hover:border-ap-muted rounded-xl p-3 flex flex-col gap-2.5 shadow-sm transition-all duration-200"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-ap-primary text-[14px] leading-tight">{v.full_name}</h3>
                  {v.fluency && (
                    <span className="shrink-0 text-[10px] font-extrabold bg-ap-primary/5 text-ap-primary px-2 py-0.5 rounded-full border border-ap-primary/10">
                      {v.fluency}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1 mt-1.5">
                  {(v.languages || []).map((l) => (
                    <span key={l} className="text-[10px] font-semibold px-2 py-0.5 rounded bg-ap-bg border border-ap-border text-ap-secondary">
                      {l}
                    </span>
                  ))}
                  {v.technical_knowledge && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-50 border border-emerald-100 text-emerald-700">
                      Conocimiento Técnico
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-2 text-[11px] text-ap-muted">
                  {(v.city || v.state) ? (
                    <span className="flex items-center gap-0.5">
                      <MapPin size={11} /> {v.city || ''}{v.city && v.state ? ', ' : ''}{v.state || ''}
                    </span>
                  ) : (
                    <span className="flex items-center gap-0.5"><MapPin size={11} /> Remoto</span>
                  )}
                  {!v.in_venezuela && (
                    <span className="flex items-center gap-0.5">
                      <Globe size={11} /> Fuera de Venezuela
                    </span>
                  )}
                </div>
              </div>

              {/* Disponibilidad y canales */}
              <div className="text-[11px] text-ap-secondary border-t border-ap-bg pt-2 flex flex-col gap-1">
                {v.availability && v.availability.length > 0 && (
                  <div><strong>Disponibilidad:</strong> {v.availability.join(', ')}</div>
                )}
                {v.support_types && v.support_types.length > 0 && (
                  <div><strong>Apoyo:</strong> {v.support_types.join(', ')}</div>
                )}
              </div>

              {/* Botones de acción */}
              <div className="flex gap-2 border-t border-ap-bg pt-2 shrink-0">
                {v.contact_channels && v.contact_channels.includes('WhatsApp') && (
                  <a
                    href={`https://wa.me/${cleanPhone(v.phone)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[12px] py-2 rounded-xl transition-all shadow-sm"
                  >
                    <MessageCircle size={14} fill="white" /> WhatsApp
                  </a>
                )}
                <a
                  href={`tel:${cleanPhone(v.phone)}`}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-ap-surface-hover border border-ap-border hover:border-ap-muted text-ap-primary font-extrabold text-[12px] py-2 rounded-xl transition-all shadow-sm"
                >
                  <PhoneCall size={14} /> Llamar
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
