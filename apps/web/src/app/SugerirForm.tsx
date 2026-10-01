'use client';

import { useState } from 'react';
import { X, CheckCircle } from 'lucide-react';
import { RECIBE_OPCIONES } from '@/lib/validation';
import type { Centro } from '@/lib/centros';

const ESTADOS: { v: 'abierto' | 'lleno' | 'cerrado'; label: string }[] = [
  { v: 'abierto', label: 'Activo' },
  { v: 'lleno', label: 'Lleno' },
  { v: 'cerrado', label: 'Cerrado' },
];

// Modal público para COMPLEMENTAR/corregir un punto ya publicado. Precarga los
// valores actuales; al enviar solo manda los campos que cambiaron + la nota libre.
export default function SugerirForm({ centro, onClose }: { centro: Centro; onClose: () => void }) {
  const [address, setAddress] = useState(centro.address || '');
  const [ciudad, setCiudad] = useState(centro.ciudad || '');
  const [pais, setPais] = useState(centro.pais || '');
  const [horario, setHorario] = useState(centro.horario || '');
  const [contacto, setContacto] = useState(centro.contacto || '');
  const [estado, setEstado] = useState<'abierto' | 'lleno' | 'cerrado'>(centro.estado);
  const [necesita, setNecesita] = useState(centro.necesitaAhora || '');
  const [recibe, setRecibe] = useState<string[]>(centro.recibe || []);
  const [mensaje, setMensaje] = useState('');
  const [fuente, setFuente] = useState('');
  const [contactoReporta, setContactoReporta] = useState('');
  const [website, setWebsite] = useState(''); // honeypot
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  // Opciones de "recibe": las estándar + cualquier valor actual fuera de la lista.
  const recibeOpts = Array.from(new Set([...RECIBE_OPCIONES, ...(centro.recibe || [])]));
  const toggle = (op: string) => setRecibe((r) => (r.includes(op) ? r.filter((x) => x !== op) : [...r, op]));

  const sameArr = (a: string[], b: string[]) =>
    a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|');

  const submit = async () => {
    // Solo enviar lo que cambió respecto al valor actual.
    const payload: Record<string, unknown> = {};
    if (address.trim() !== (centro.address || '')) payload.address = address.trim();
    if (ciudad.trim() !== (centro.ciudad || '')) payload.ciudad = ciudad.trim();
    if (pais.trim() !== (centro.pais || '')) payload.pais = pais.trim();
    if (horario.trim() !== (centro.horario || '')) payload.horario = horario.trim();
    if (contacto.trim() !== (centro.contacto || '')) payload.contacto = contacto.trim();
    if (necesita.trim() !== (centro.necesitaAhora || '')) payload.necesitaAhora = necesita.trim();
    if (estado !== centro.estado) payload.estado = estado;
    if (!sameArr(recibe, centro.recibe || [])) payload.recibe = recibe;

    if (Object.keys(payload).length === 0 && !mensaje.trim()) {
      return setError('Cambiá algún dato o dejá un mensaje con la corrección.');
    }

    setSaving(true);
    setError('');
    const res = await fetch(`/api/centros/${centro.id}/sugerir`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        mensaje: mensaje.trim() || null,
        contactoReporta: contactoReporta.trim() || null,
        fuente: fuente.trim() || null,
        website,
      }),
    });
    setSaving(false);
    if (res.ok) setDone(true);
    else setError((await res.json().catch(() => ({})))?.error || 'No se pudo enviar.');
  };

  return (
    <div className="fixed inset-0 z-[2000] bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
      <div className="bg-ap-surface w-full max-w-[560px] max-h-[94dvh] rounded-t-[20px] sm:rounded-agentos-lg border border-ap-border shadow-agentos-md flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-ap-border shrink-0">
          <div className="min-w-0">
            <h2 className="font-bold text-ap-primary font-outfit truncate">Completar o corregir info</h2>
            <p className="text-[11px] text-ap-muted truncate">{centro.name}</p>
          </div>
          <button onClick={onClose} className="text-ap-muted p-1"><X size={20} /></button>
        </div>

        {done ? (
          <div className="p-8 text-center">
            <CheckCircle className="w-12 h-12 text-ap-success mx-auto mb-3" />
            <p className="font-bold text-ap-primary">¡Gracias!</p>
            <p className="text-[13px] text-ap-muted mt-1">Tu sugerencia fue enviada y será revisada antes de actualizar el punto.</p>
            <button onClick={onClose} className="mt-5 px-5 py-2.5 rounded-lg bg-ap-primary text-white font-bold text-[13px]">Cerrar</button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <p className="text-[12px] text-ap-secondary bg-ap-surface-hover rounded-lg px-3 py-2">
                Corregí o agregá datos de este punto. Solo se enviarán los campos que cambies; un equipo lo revisa antes de publicarlo.
              </p>
              {/* honeypot */}
              <input type="text" value={website} onChange={(e) => setWebsite(e.target.value)} className="hidden" tabIndex={-1} autoComplete="off" />

              <L label="Dirección"><input value={address} onChange={(e) => setAddress(e.target.value)} className="inp2" placeholder="Calle, número, zona" /></L>
              <div className="grid grid-cols-2 gap-3">
                <L label="País"><input value={pais} onChange={(e) => setPais(e.target.value)} className="inp2" /></L>
                <L label="Ciudad"><input value={ciudad} onChange={(e) => setCiudad(e.target.value)} className="inp2" /></L>
              </div>

              <L label="Estado">
                <div className="flex gap-1.5">
                  {ESTADOS.map((e) => (
                    <button key={e.v} type="button" onClick={() => setEstado(e.v)}
                      className={`flex-1 text-[12px] font-bold px-2 py-2 rounded-lg border ${estado === e.v ? 'bg-ap-primary text-white border-ap-primary' : 'border-ap-border text-ap-secondary'}`}>{e.label}</button>
                  ))}
                </div>
              </L>

              <L label="¿Qué recibe?">
                <div className="flex flex-wrap gap-1.5">
                  {recibeOpts.map((op) => (
                    <button key={op} type="button" onClick={() => toggle(op)}
                      className={`text-[12px] font-semibold px-2.5 py-1 rounded-full border ${recibe.includes(op) ? 'bg-ap-primary text-white border-ap-primary' : 'border-ap-border text-ap-secondary'}`}>{op}</button>
                  ))}
                </div>
              </L>

              <L label="Necesita ahora">
                <textarea value={necesita} onChange={(e) => setNecesita(e.target.value)} className="inp2 resize-none" rows={2} placeholder="Ej: Medicamentos de trauma, agua potable, sábanas…" />
              </L>
              <div className="grid grid-cols-2 gap-3">
                <L label="Horario"><input value={horario} onChange={(e) => setHorario(e.target.value)} className="inp2" placeholder="Ej: 8:00 AM — 4:00 PM" /></L>
                <L label="Contacto"><input value={contacto} onChange={(e) => setContacto(e.target.value)} className="inp2" placeholder="Teléfono / @cuenta" /></L>
              </div>

              <L label="Mensaje / aclaración (opcional)">
                <textarea value={mensaje} onChange={(e) => setMensaje(e.target.value)} className="inp2 resize-none" rows={2} placeholder="Ej: El teléfono cambió, ahora atienden solo en la mañana…" />
              </L>
              <div className="grid grid-cols-2 gap-3">
                <L label="Tu nombre / @cuenta"><input value={fuente} onChange={(e) => setFuente(e.target.value)} className="inp2" placeholder="Quién reporta" /></L>
                <L label="Tu contacto (opcional)"><input value={contactoReporta} onChange={(e) => setContactoReporta(e.target.value)} className="inp2" placeholder="Por si necesitamos verificar" /></L>
              </div>

              {error && <p className="text-[12px] text-ap-red font-semibold">{error}</p>}
            </div>
            <div className="p-4 border-t border-ap-border shrink-0 flex gap-2">
              <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-ap-border text-ap-secondary font-bold text-[13px]">Cancelar</button>
              <button onClick={submit} disabled={saving} className="flex-1 py-2.5 rounded-lg bg-ap-primary text-white font-bold text-[13px] disabled:opacity-50">
                {saving ? 'Enviando…' : 'Enviar sugerencia'}
              </button>
            </div>
          </>
        )}
      </div>

      <style jsx global>{`
        .inp2 { width:100%; padding:9px 11px; border:1px solid var(--ap-border); border-radius:10px; font-size:13px; background:#fff; color:var(--ap-primary); outline:none; }
        .inp2:focus { border-color: var(--ap-secondary); }
      `}</style>
    </div>
  );
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-bold text-ap-muted uppercase tracking-wide mb-1">{label}</span>
      {children}
    </label>
  );
}
