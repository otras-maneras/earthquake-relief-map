// Normaliza texto para comparar en buscadores: saca acentos/diacriticos (Maria -> maria),
// minusculas y espacios repetidos. Evita que un tilde faltante esconda resultados reales
// en el buscador de personas (critico: preferimos mas falsos positivos a ocultar a alguien).
export function normalizeSearchText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
