export type Tipo = 'refugio' | 'acopio';

export function detectTipo(text: string): Tipo | undefined {
  const t = text.toLowerCase();
  if (/refugi|albergue|dormir|techo/.test(t)) return 'refugio';
  if (/acopi|donar|donaci|llevar|ayuda|v[ií]veres|comida|agua/.test(t)) return 'acopio';
  return undefined;
}

export function mapsLink(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

export function estadoTag(estado: string): string {
  if (estado === 'lleno') return '🟠 lleno';
  if (estado === 'cerrado') return '🔴 cerrado';
  return '🟢 abierto';
}
