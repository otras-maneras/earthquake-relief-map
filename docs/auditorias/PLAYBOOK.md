# AUDITORIA-PLAYBOOK — Metodología reproducible de auditoría de AcopioVE

> Cómo auditar el sistema de forma **repetible, empírica y solo-lectura**.
> Antes esta metodología vivía implícita en cada reporte; ahora es un proceso
> versionado con comandos concretos, rúbrica de puntaje y un colector
> automatizado (`scripts/auditoria.sh`).

## Principios

1. **Solo lectura.** La auditoría nunca modifica DB, archivos, servicios ni envía nada. Si un check necesitara escribir, no va en la auditoría.
2. **Empírico sobre teórico.** Todo puntaje se respalda con evidencia ejecutada hoy (HTTP en vivo, query a la DB, header real, Lighthouse), no con suposiciones. Si algo no se pudo medir, se declara explícitamente `NO VERIFICADO` y no se convierte en “bien” por omisión.
3. **Sin exponer secretos.** Se leen valores de `.env` solo para conectarse; nunca se imprimen credenciales en el reporte.
4. **Reproducible.** Cualquiera repite la auditoría corriendo `./scripts/auditoria.sh` + Lighthouse. Mismos comandos → métricas comparables.
5. **Comparable.** Cada reporte incluye una tabla “cambios desde la auditoría anterior” para ver la tendencia.
6. **Tolerante a fallos parciales.** `scripts/auditoria.sh` no debe abortar toda la auditoría si falta una herramienta o variable; debe marcar esa señal como `NO VERIFICADO` y seguir con el resto.

## Cómo correrla

```bash
# 1) Colector read-only (salud, datos, prod, cache, headers, código, infra, comms)
./scripts/auditoria.sh | tee /tmp/auditoria-$(date +%F).txt

# 2) Lighthouse en producción (perf/a11y/seo/best-practices) — requiere google-chrome
npx --yes lighthouse@latest https://acopiove.org/ \
  --only-categories=performance,accessibility,seo,best-practices \
  --quiet --chrome-flags='--headless --no-sandbox --disable-gpu' \
  --output=json --output-path=/tmp/lh.json
jq -r '.categories|to_entries[]|"\(.key): \((.value.score*100)|round)"' /tmp/lh.json

# Métricas mínimas para copiar al reporte
jq -r '.audits | {
  fcp: .["first-contentful-paint"].displayValue,
  lcp: .["largest-contentful-paint"].displayValue,
  tbt: .["total-blocking-time"].displayValue,
  cls: .["cumulative-layout-shift"].displayValue,
  speed_index: .["speed-index"].displayValue
} | to_entries[] | "\(.key): \(.value)"' /tmp/lh.json

# Audits fallidos útiles para hallazgos accionables
jq -r '.audits
  | to_entries[]
  | select(.value.score != null and .value.score < 1)
  | "\(.key): \(.value.title) — \(.value.displayValue // "")"' /tmp/lh.json

# 3) Interpretar la evidencia con la rúbrica de abajo y escribir AUDITORIA-AAAA-MM-DD.md
```

> Repetir Lighthouse sobre páginas representativas además de la home cuando haya tiempo: `/busquedas` (flujo crítico), `/data`, `/docs/api`. Si solo se mide la home, declararlo explícitamente.

## Dimensiones, qué se mide y con qué

| # | Dimensión | Señal empírica | Fuente |
|---|---|---|---|
| 1 | Seguridad | RBAC en rutas mutantes, rate-limit, fail-fast JWT, CSP, headers, `npm audit`, secretos no versionados | código + headers en vivo + `npm audit --omit=dev` |
| 2 | Rendimiento | `cf-cache-status`, ISR/`revalidate`, Lighthouse perf (LCP/TBT/CLS), tiempos de respuesta | `curl -I` + Lighthouse |
| 3 | Calidad de datos | nº centros/refugios/tel/fuentes, % sin contacto, sin `recibe`, coords placeholder, coords duplicadas, estados, frescura `updated_at` | queries a Postgres |
| 4 | Código y prácticas | `tsc --noEmit`, ESLint, tests, tamaño de componentes, Lighthouse best-practices, sincronía git↔deploy, untracked | repo + Lighthouse |
| 5 | SEO | sitemap/robots/llms 200, JSON-LD, hreflang, jerarquía de encabezados, Lighthouse SEO | HTTP + Lighthouse |
| 6 | Accesibilidad | Lighthouse a11y + audits que fallan (contraste, nombres accesibles, orden de headings, target-size) | Lighthouse |
| 7 | Infra / DevOps | servicio systemd (estado/reinicios/usuario), backups locales frescos, off-site (rclone/R2), CI/CD, monitoreo | `systemctl` + `backups/` + cron/log |
| 8 | Comunicaciones | SPF/DMARC/DKIM (raíz + `send.`), estado de plantillas WhatsApp en Meta/Kapso, Resend | `dig` + API Kapso |

## Rúbrica de puntaje (0–100 por dimensión)

Puntaje base 100; restar por hallazgo según severidad. Mantener consistencia entre auditorías:

- **Crítico** (−20 a −35): vector explotable activo, pérdida de datos posible, secreto expuesto, servicio caído.
- **Medio** (−7 a −15): degrada seguridad/calidad/operación pero hay mitigación o no es explotable directo (ej. deps moderate, 48% sin contacto, sin tests).
- **Bajo** (−2 a −5): higiene/pulido (ej. coords placeholder, jerarquía de headings, componente grande).

**GLOBAL** = promedio de las 8 dimensiones (redondeado). Reglas:
- Un hallazgo crítico sin mitigar **topa** el global en ≤ 70 por más que el resto esté bien.
- Toda subida/bajada de puntaje respecto al reporte previo debe citar el cambio concreto que la justifica (no mover números “a ojo”).

## Severidad de hallazgos

Cada hallazgo lleva: **severidad (crítico/medio/bajo) · evidencia (comando/valor) · ubicación (`archivo:línea` o endpoint) · recomendación accionable**.

Reglas para `NO VERIFICADO`:
- Si una señal crítica no se pudo medir (DB, servicio, backups, headers, Lighthouse), tratarla como riesgo operativo y mencionarla en hallazgos.
- Si una señal secundaria no se pudo medir por falta de herramienta local (`dig`, `jq`, `npx`), reportarla como limitación de la corrida, no como fallo del sistema.
- Nunca subir un puntaje porque “no apareció evidencia negativa” cuando la sección está `NO VERIFICADO`.

## Salida

- Reporte fechado en `docs/auditorias/AUDITORIA-AAAA-MM-DD.md` (se conserva solo el más reciente; los previos se borran para evitar ruido).
- Estructura del reporte: puntuación global → una sección por dimensión (bien / hallazgos) → recomendaciones priorizadas por severidad → tabla de cambios vs. anterior → veredicto.
- Incluir siempre los scores Lighthouse medidos: performance, accessibility, best-practices, SEO, LCP, TBT y CLS.
- Incluir si el colector tuvo `NO VERIFICADO` y en qué secciones.
- Cerrar con la nota: *“Generado siguiendo AUDITORIA-PLAYBOOK.md (solo lectura; sin secretos expuestos).”*

## Checklist antes de publicar

- `./scripts/auditoria.sh` terminó y la salida quedó guardada.
- Lighthouse terminó y se copiaron scores + métricas Core Web Vitals.
- El reporte no incluye secretos, tokens, URLs con credenciales ni valores completos de `.env`.
- Cada cambio de puntaje tiene una causa concreta y medible.
- Las recomendaciones están ordenadas por impacto real: primero riesgo/operación, luego performance/datos, luego higiene.
- `git status --short` revisado para saber si hay cambios o archivos sueltos que afecten la auditoría.

## Límites y mejoras futuras

Esta es una auditoría operativa sólida para producción: salud, datos, seguridad básica, performance real, SEO, accesibilidad, backups y comunicaciones. No reemplaza una auditoría externa de seguridad, pentest, revisión legal de privacidad ni monitoreo continuo.

Para acercarla al mejor estándar posible:
- Generar artefactos versionables además del Markdown: salida del colector, `/tmp/lh.json`, resumen JSON y fecha exacta.
- Definir umbrales automáticos de fail/pass: servicio caído, DB sin respuesta, backups vencidos, Lighthouse perf < 50, vulnerabilidades high/critical.
- Correr Lighthouse en varias rutas y comparar contra la corrida anterior.
- Agregar checks automáticos para CI/CD, uptime externo, expiración TLS, dominios, cron de backups y frescura de datos.
- Añadir pruebas mínimas de seguridad de rutas mutantes: endpoints admin, RBAC, rate-limit y validación de payloads.
- Separar evidencia de interpretación: el script colecta datos; el reporte decide puntajes y prioridades.

## Notas operativas (lecciones aprendidas)

- El esquema real usa `active`, `latitude`, `longitude`; `recibe` es **JSONB** (comparar contra `'[]'`, no `''`). No asumir nombres en español.
- Cloudflare naranja quema IPs ~30 min; un 403 desde una IP usada no es necesariamente un fallo del origen (verificar desde IP fresca). Ver [[acopiove-api-publica]].
- **Nunca** matar procesos por `lsof`/`fuser` de un puerto compartido: el :4100 lo comparte el upstream de Caddy. Ver [[acopiove-infra-deploy]].
- Lighthouse corre por defecto en perfil **móvil con throttling**: un perf bajo ahí refleja la home con mapa pesado, no necesariamente el TTFB real (que es < 200 ms en prod).
