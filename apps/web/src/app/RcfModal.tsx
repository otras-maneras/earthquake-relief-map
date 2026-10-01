'use client';

import { X, Phone, Mail, Globe, Heart } from 'lucide-react';

interface ContactoRcf {
  pais: string;
  telefono?: string;
  correo?: string;
  web?: string;
}

const contactos: ContactoRcf[] = [
  {
    pais: 'Venezuela',
    telefono: '0422-799-4880',
    web: 'https://cruzroja.ve/',
  },
  {
    pais: 'Colombia',
    telefono: '+57 321 213 9525',
    correo: 'rcf@cruzrojacolombiana.org',
  },
  {
    pais: 'Ecuador',
    telefono: '+593 98 595 6683',
  },
  {
    pais: 'Costa Rica',
    telefono: '+506 6060-8623',
    correo: 'rcf@cruzroja.or.cr',
  },
  {
    pais: 'México',
    telefono: '56-45-85-32-74',
  },
  {
    pais: 'Argentina',
    web: 'https://www.cruzroja.org.ar/rcf/',
  },
  {
    pais: 'Honduras',
    telefono: '+504 9849-5556',
    correo: 'busquedarcf@cruzroja.org.hn',
  },
];

export default function RcfModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[2000] bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
      <div className="bg-ap-surface w-full max-w-[500px] max-h-[85dvh] rounded-t-[20px] sm:rounded-agentos-lg border border-ap-border shadow-agentos-md flex flex-col overflow-hidden">
        
        {/* Cabecera */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-ap-border shrink-0">
          <div className="flex items-center gap-2">
            <Heart size={18} className="text-rose-500 fill-rose-500 animate-pulse" />
            <h2 className="font-extrabold text-ap-primary font-outfit text-[15px] sm:text-[16px] leading-tight">
              Búsqueda de Familiares (RCF)
            </h2>
          </div>
          <button onClick={onClose} className="text-ap-muted hover:text-ap-primary p-1 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Descripción informativa */}
        <div className="shrink-0 px-4 py-3 border-b border-ap-border bg-rose-50/50 dark:bg-rose-950/10">
          <p className="text-[12px] text-ap-secondary leading-relaxed font-semibold">
            La <strong className="text-rose-600">Cruz Roja Venezolana</strong> activó el servicio de <span className="italic">Restablecimiento del Contacto entre Familiares (RCF)</span> para facilitar la búsqueda y comunicación entre familiares afectados por la emergencia.
          </p>
        </div>

        {/* Listado de Contactos por País */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-ap-bg/30">
          {contactos.map((c) => (
            <div
              key={c.pais}
              className="bg-white border border-ap-border rounded-xl p-3 shadow-sm flex flex-col gap-2.5"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-ap-primary text-[13.5px] tracking-wide">{c.pais}</span>
                <span className="text-[9px] font-bold text-rose-600 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Cruz Roja
                </span>
              </div>

              <div className="flex flex-col gap-2">
                {/* Teléfono */}
                {c.telefono && (
                  <div className="flex items-center justify-between gap-3 text-[12px]">
                    <span className="text-ap-muted flex items-center gap-1.5 shrink-0">
                      <Phone size={13} className="text-rose-500" /> Teléfono:
                    </span>
                    <a
                      href={`tel:${c.telefono.replace(/\s+/g, '')}`}
                      className="font-extrabold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100/70 border border-rose-100 rounded-lg px-2.5 py-1 text-[11px] transition-colors flex items-center gap-1 shrink-0 active:scale-95 duration-100"
                    >
                      <Phone size={11} fill="currentColor" /> {c.telefono}
                    </a>
                  </div>
                )}

                {/* Correo */}
                {c.correo && (
                  <div className="flex items-center justify-between gap-3 text-[12px]">
                    <span className="text-ap-muted flex items-center gap-1.5 shrink-0">
                      <Mail size={13} className="text-blue-500" /> Correo:
                    </span>
                    <a
                      href={`mailto:${c.correo}`}
                      className="font-semibold text-blue-600 hover:underline truncate text-[11px]"
                    >
                      {c.correo}
                    </a>
                  </div>
                )}

                {/* Web */}
                {c.web && (
                  <div className="flex items-center justify-between gap-3 text-[12px]">
                    <span className="text-ap-muted flex items-center gap-1.5 shrink-0">
                      <Globe size={13} className="text-emerald-500" /> Sitio Web:
                    </span>
                    <a
                      href={c.web}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-extrabold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100/70 border border-emerald-100 rounded-lg px-2.5 py-1 text-[11px] transition-colors flex items-center gap-1 active:scale-95 duration-100"
                    >
                      <Globe size={11} /> Visitar sitio web
                    </a>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Pie del modal / Fuente */}
          <div className="pt-2 text-center">
            <p className="text-[10px] text-ap-muted leading-tight">
              Organización responsable: Cruz Roja Venezolana <br />
              Fuente original: @elpitazotv
            </p>
          </div>
        </div>
        
      </div>
    </div>
  );
}
