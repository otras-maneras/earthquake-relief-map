'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { X, CheckCircle } from 'lucide-react';
import { RECIBE_OPCIONES } from '@/lib/validation';

const ALOJAMIENTO_OPCIONES = [
  'Habitación privada',
  'Sofá o colchón',
  'Baño disponible',
  'Agua / Luz estable',
  'Internet / WiFi',
  'Acepta mascotas',
  'Acepta niños',
];

const MapPicker = dynamic(() => import('@/app/admin/MapPicker'), {
  ssr: false,
  loading: () => <div className="h-full flex items-center justify-center text-ap-muted text-sm">Cargando mapa…</div>,
});

export default function SubmitForm({
  open,
  onClose,
  initialTipo = 'acopio',
}: {
  open: boolean;
  onClose: () => void;
  initialTipo?: 'acopio' | 'refugio' | 'alojamiento';
}) {
  const [tipo, setTipo] = useState<'acopio' | 'refugio' | 'alojamiento'>(initialTipo);
  const [name, setName] = useState('');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [address, setAddress] = useState('');
  const [pais, setPais] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [recibe, setRecibe] = useState<string[]>([]);
  const [necesita, setNecesita] = useState('');
  const [contacto, setContacto] = useState('');
  const [fuente, setFuente] = useState('');
  const [website, setWebsite] = useState(''); // honeypot
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [count, setCount] = useState(0); // cuántos cargó en esta sesión
  const MAX = 3;

  if (!open) return null;

  const submit = async () => {
    if (!name.trim()) return setError('Poné el nombre del lugar.');
    if (lat == null || lng == null) return setError('Marcá la ubicación en el mapa.');
    setSaving(true);
    setError('');
    const res = await fetch('/api/centros/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(), tipo, latitude: lat, longitude: lng,
        address: address.trim() || null, pais: pais.trim() || null, ciudad: ciudad.trim() || null,
        recibe, necesitaAhora: necesita.trim() || null, contacto: contacto.trim() || null,
        fuente: fuente.trim() || null, website,
      }),
    });
    setSaving(false);
    if (res.ok) { setCount((c) => c + 1); setDone(true); }
    else setError((await res.json().catch(() => ({})))?.error || 'No se pudo enviar.');
  };

  // Limpia para cargar otro (conserva país/ciudad/fuente/tipo, que suelen repetirse).
  const cargarOtro = () => {
    setName(''); setLat(null); setLng(null); setAddress('');
    setRecibe([]); setNecesita(''); setContacto('');
    setError(''); setDone(false);
  };

  const toggle = (op: string) => setRecibe((r) => (r.includes(op) ? r.filter((x) => x !== op) : [...r, op]));

  return (
    <div className="fixed inset-0 z-[2000] bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
      <div className="bg-ap-surface w-full max-w-[560px] max-h-[94dvh] rounded-t-[20px] sm:rounded-agentos-lg border border-ap-border shadow-agentos-md flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-ap-border shrink-0">
          <h2 className="font-bold text-ap-primary font-outfit">Sugerir un centro o refugio</h2>
          <button onClick={onClose} className="text-ap-muted p-1"><X size={20} /></button>
        </div>

        {done ? (
          <div className="p-8 text-center">
            <CheckCircle className="w-12 h-12 text-ap-success mx-auto mb-3" />
            <p className="font-bold text-ap-primary">¡Gracias!</p>
            <p className="text-[13px] text-ap-muted mt-1">Tu sugerencia fue enviada y será revisada antes de publicarse en el mapa.</p>
            {count < MAX ? (
              <>
                <p className="text-[12px] text-ap-muted mt-2">Podés cargar otro ({count}/{MAX}).</p>
                <div className="flex gap-2 justify-center mt-5">
                  <button onClick={cargarOtro} className="px-5 py-2.5 rounded-lg bg-ap-primary text-white font-bold text-[13px]">Cargar otro</button>
                  <button onClick={onClose} className="px-5 py-2.5 rounded-lg border border-ap-border text-ap-secondary font-bold text-[13px]">Listo</button>
                </div>
              </>
            ) : (
              <>
                <p className="text-[12px] text-ap-muted mt-2">Cargaste el máximo de {MAX} por ahora. ¡Gracias por sumar!</p>
                <button onClick={onClose} className="mt-5 px-5 py-2.5 rounded-lg bg-ap-primary text-white font-bold text-[13px]">Cerrar</button>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {/* honeypot */}
              <input type="text" value={website} onChange={(e) => setWebsite(e.target.value)} className="hidden" tabIndex={-1} autoComplete="off" />

              <div className="flex gap-1.5">
                {(['acopio', 'refugio', 'alojamiento'] as const).map((t) => (
                  <button key={t} type="button" onClick={() => setTipo(t)}
                    className={`flex-1 text-[11px] font-bold px-2 py-2 rounded-lg border ${tipo === t ? 'bg-ap-primary text-white border-ap-primary' : 'border-ap-border text-ap-secondary'}`}>
                    {t === 'acopio' ? 'Centro de acopio' : t === 'refugio' ? 'Refugio Oficial' : 'Techo Solidario'}
                  </button>
                ))}
              </div>

              <L label={tipo === 'alojamiento' ? 'Identificador o Nombre del espacio *' : 'Nombre del lugar *'}>
                <input value={name} onChange={(e) => setName(e.target.value)} className="inp2" placeholder={tipo === 'alojamiento' ? 'Ej: Habitación familiar en casa de María' : 'Ej: Iglesia San José'} />
              </L>

              <L label="Ubicación * (tocá el mapa o usá tu ubicación)">
                <div className="h-[220px] rounded-agentos-lg overflow-hidden border border-ap-border">
                  <MapPicker lat={lat} lng={lng} onChange={(la, ln) => { setLat(la); setLng(ln); }} />
                </div>
              </L>

              <L label={tipo === 'alojamiento' ? 'Dirección (o zona de referencia)' : 'Dirección'}>
                <input value={address} onChange={(e) => setAddress(e.target.value)} className="inp2" placeholder="Calle, número, zona" />
              </L>
              <div className="grid grid-cols-2 gap-3">
                <L label="País"><input value={pais} onChange={(e) => setPais(e.target.value)} className="inp2" /></L>
                <L label="Ciudad"><input value={ciudad} onChange={(e) => setCiudad(e.target.value)} className="inp2" /></L>
              </div>

              <L label={tipo === 'alojamiento' ? '¿Qué ofrece el espacio?' : '¿Qué recibe?'}>
                <div className="flex flex-wrap gap-1.5">
                  {(tipo === 'alojamiento' ? ALOJAMIENTO_OPCIONES : RECIBE_OPCIONES).map((op) => (
                    <button key={op} type="button" onClick={() => toggle(op)}
                      className={`text-[12px] font-semibold px-2.5 py-1 rounded-full border ${recibe.includes(op) ? 'bg-ap-primary text-white border-ap-primary' : 'border-ap-border text-ap-secondary'}`}>{op}</button>
                  ))}
                </div>
              </L>

              <L label={tipo === 'alojamiento' ? 'Detalles o condiciones del hospedaje' : 'Necesita ahora'}>
                <textarea value={necesita} onChange={(e) => setNecesita(e.target.value)} className="inp2 resize-none" rows={2} placeholder={tipo === 'alojamiento' ? 'Ej: Espacio para 2 personas, solo familias, se cuenta con agua...' : 'Ej: Medicamentos de trauma, agua potable, sábanas...'} />
              </L>
              <div className="grid grid-cols-2 gap-3">
                <L label="Contacto"><input value={contacto} onChange={(e) => setContacto(e.target.value)} className="inp2" /></L>
                <L label="Fuente / quién reporta"><input value={fuente} onChange={(e) => setFuente(e.target.value)} className="inp2" placeholder="Tu nombre o @cuenta" /></L>
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
