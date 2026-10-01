#!/usr/bin/env node
// Invariante anti-PII de las superficies públicas de personas.
// Falla (exit 1) si alguna respuesta trae: una cédula completa sin enmascarar,
// datos simulados ("Simulado") o campos internos que no deberían serializarse.
// Es la verificación que habría atrapado la fuga H-1 del reporte de auditoría.
//
// Uso:  node scripts/check-pii.mjs [baseUrl]
//       (default: http://127.0.0.1:4100 · o variable PII_CHECK_BASE)

const BASE = (process.argv[2] || process.env.PII_CHECK_BASE || 'http://127.0.0.1:4100').replace(/\/$/, '');
const ENDPOINTS = ['/api/personas', '/api/busqueda-avanzada'];

const digits = (s) => String(s ?? '').replace(/\D/g, '');
const isUnmasked = (c) => !!c && !String(c).includes('*') && digits(c).length >= 6;

let failed = false;

for (const ep of ENDPOINTS) {
  const url = `${BASE}${ep}`;
  let rows;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`✗ ${ep}: HTTP ${res.status}`);
      failed = true;
      continue;
    }
    const body = await res.json();
    rows = Array.isArray(body?.data) ? body.data : [];
  } catch (e) {
    console.error(`✗ ${ep}: ${e.message}`);
    failed = true;
    continue;
  }

  const unmasked = rows.filter((r) => isUnmasked(r?.cedula));
  const mocks = rows.filter((r) => /simulad/i.test(String(r?.fuente || '')));
  const internal = rows.filter((r) => r && ('_cedulaDigits' in r || 'edad' in r));

  const problems = [];
  if (unmasked.length) problems.push(`${unmasked.length} cédula(s) sin enmascarar`);
  if (mocks.length) problems.push(`${mocks.length} fila(s) simulada(s)`);
  if (internal.length) problems.push(`${internal.length} fila(s) con campos internos`);

  if (problems.length) {
    console.error(`✗ ${ep} (${rows.length} filas): ${problems.join(', ')}`);
    for (const r of unmasked.slice(0, 3)) {
      console.error(`    cédula=${JSON.stringify(r.cedula)}  nombre=${r.nombre}`);
    }
    failed = true;
  } else {
    console.log(`✓ ${ep}: ${rows.length} filas, sin PII expuesta`);
  }
}

if (failed) {
  console.error('\nFALLO: se detectó exposición de PII en una superficie pública.');
  process.exit(1);
}
console.log('\nOK: invariante anti-PII satisfecha.');
