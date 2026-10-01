import { digitsOnly, looksLikeCedulaInput } from '@/lib/api/reportavnzla-personas';

export interface PersonasLookupParams {
  q?: string;
  cedula?: string;
}

/** Parsea lo que escribió el usuario en nombre o cédula para lookup server-side. */
export function parsePersonasLookupInput(raw: string): PersonasLookupParams {
  const t = raw.trim();
  if (!t) return {};
  if (looksLikeCedulaInput(t)) {
    const cedula = digitsOnly(t);
    if (cedula.length >= 3) return { cedula };
  }
  if (t.length >= 2) return { q: t };
  return {};
}

export function isPersonasLookupActive(params: PersonasLookupParams): boolean {
  return !!(params.q && params.q.length >= 2) || !!(params.cedula && params.cedula.length >= 3);
}
