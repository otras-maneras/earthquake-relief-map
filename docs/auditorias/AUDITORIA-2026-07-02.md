# Auditoría Completa del Sistema — AcopioVE

> Fecha: **2026-07-02** · Método: `scripts/auditoria.sh` (read-only) + Lighthouse en producción (home y `/busquedas`) + revisión de evidencia.
> Sistema verificado **activo**: `systemctl is-active` → `active` (0 reinicios, usuario `acopiove`, arranque 19:14 de hoy); `localhost:4100` → 200 en 0.03 s; `https://acopiove.org/` → 200; DB responde `select 1`.
> Generado siguiendo `AUDITORIA-PLAYBOOK.md`.

## Puntuación global

| Aspecto | Puntaje | Veredicto |
|---|---|---|
| Seguridad | 90 | Fail-fast JWT, RBAC, rate-limit, CSP report-only y headers completos verificados en vivo; servicio no-root. Persisten 2 vulns moderate en deps. |
| Rendimiento | 81 | Edge cache `HIT` y TTFB sano (home 0.16 s). Pero Lighthouse móvil: home **42** (TBT subió a 3.86 s) y `/busquedas` **38** (TBT 7.0 s). El costo del cliente creció. |
| Calidad de datos | 81 | **703 centros activos (+124)**, 49 refugios, 108 fuentes, 22 países. % sin contacto bajó a 46.66 % (antes 48.7 %), pero son 328 en absoluto. |
| Código y prácticas | 73 | `tsc --noEmit` limpio; sin tests ni ESLint; `PersonasClient.tsx` 1.270 líneas y `Mapa3DView.tsx` nuevo con 1.079. |
| SEO | 96 | Lighthouse SEO **100 en ambas rutas medidas**; sitemap/robots/llms 200. Resta jerarquía de encabezados. |
| Accesibilidad | 88 | Home bajó a **87** (antes 91): se sumó `target-size` a contraste, nombres accesibles y orden de headings. `/busquedas` da 96. |
| Infra / DevOps | 82 | Backups locales cada 6 h (último 18:30 hoy) + off-site R2 `OK` a las 18:30 en `scripts/backup.log`. Falta CI/CD y monitoreo. |
| Comunicaciones | 90 | SPF (raíz ahora vía Hostinger)/DMARC/DKIM válidos; `send.` con SES; plantillas WhatsApp `v2`/`v3` siguen `approved`. DMARC en `p=none`. |
| **GLOBAL** | **≈ 85/100** | **Producción robusta, sin críticos abiertos.** Baja 1 punto vs. 2026-06-29 por rendimiento del cliente (TBT peor y `/busquedas` medido en 38) y por la caída de a11y en la home. |

---

## Seguridad — 90/100

**Bien:**
- **Headers de seguridad completos verificados en vivo**: HSTS (`max-age=31536000; includeSubDomains`), `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` restrictiva.
- **CSP emitida** (aún `Report-Only`): `default-src 'self'`, `object-src 'none'`, `frame-ancestors 'self'`, `form-action 'self'`.
- Servicio corre como **usuario `acopiove`** (no root), 0 reinicios.
- Fail-fast de `JWT_SECRET`, RBAC (`requireRole`) y rate-limit en `/api/personas` — verificados en auditorías previas, sin cambios en el código desde entonces.
- Sin secretos versionados (los 2 untracked son PNGs de mapa-3d).

**Hallazgos:**
- Medio — **2 vulnerabilidades moderate** en deps de producción (`npm audit --omit=dev`: total=2, moderate=2, high=0, critical=0). Mismas que el 06-29; siguen sin cerrarse. _Acción:_ `npm install next@latest postcss@latest` + re-build como `acopiove`.
- Bajo — **CSP sigue en Report-Only** desde hace varias auditorías. _Acción:_ revisar reportes y promover a enforcing.

## Rendimiento — 81/100

**Bien:**
- **Edge cache activo**: `api.acopiove.org/v1/puntos` → `cf-cache-status: HIT`, `cache-control: public, s-maxage=300, stale-while-revalidate=600`, `vary: Accept-Encoding`.
- **HTTP sano**: home 0.16 s, sitemap/robots/llms 0.12–0.13 s, `/v1/centros` 0.17 s (todos 200).

**Hallazgos:**
- Medio — **Lighthouse perf móvil home = 42** (antes 44): LCP 6.8 s, **TBT 3.860 ms (antes 2.480)**, Speed Index 5.8 s, TTI 7.9 s, CLS 0. Main-thread 10.3 s, ejecución JS 5.2 s. El bundle del mapa sigue siendo la palanca principal.
- Medio — **`/busquedas` perf = 38** (primera medición de esta ruta): LCP 8.1 s, **TBT 7.020 ms**, CLS 0. El flujo crítico de búsqueda de personas es hoy la página más pesada medida.
- Bajo — `/v1/personas?q=test` tardó **2.85 s** en esta corrida (agrega fuentes externas en paralelo, incluida ReportaVNZLA integrada en sesión #15); vigilar que el debounce de 400 ms + esta latencia no degrade la UX de búsqueda.

## Calidad de datos — 81/100

**Bien:**
- **703 centros activos (+124 desde el 06-29)**, **49 refugios (+16)**, 78 teléfonos, **108 fuentes (+26)**, **22 países (+2)** — crecimiento fuerte tras la carga de venezuelared.com y nuevas fuentes.
- **% sin contacto bajó**: 46.66 % (antes 48.70 %).
- 0 submissions pendientes de moderación.

**Hallazgos:**
- Medio — **328 de 703 sin contacto** (46.66 %): el número absoluto creció con la carga masiva; sigue siendo la mayor brecha operativa.
- Bajo — **175 sin `recibe`** (antes 143): las cargas nuevas entran sin el dato de qué acepta cada centro.
- Bajo — **2 centros activos con estado distinto de `abierto`** (antes 0) — revisar si deben seguir visibles u ocultarse.
- Bajo — **3 coords placeholder** (sin cambio) y **29 grupos de coordenadas duplicadas** (antes 26, esperable por geocodificación a nivel ciudad en las cargas nuevas).

## Código y prácticas — 73/100

**Bien:**
- **`npx tsc --noEmit` limpio** (0 errores) con tipado estricto.
- Solo 2 untracked (`mapa-3d-capas.png`, `mapa-3d-personas.png` — capturas; commitear o ignorar).

**Hallazgos:**
- Medio — **Sin tests** (`*.test.ts` = 0) **ni ESLint** configurado. Sin cambios en tres auditorías consecutivas.
- Bajo — **Lighthouse best-practices = 77** en ambas rutas (APIs deprecadas: 3 warnings; issues en panel DevTools).
- Bajo — **Componentes grandes**: `PersonasClient.tsx` 1.270 líneas (+41), **`Mapa3DView.tsx` 1.079 (nuevo en el top)**, `MapaClient.tsx` 759 (+85), `docs/api/page.tsx` 757. La tendencia es al alza.

## SEO — 96/100

**Bien:**
- **Lighthouse SEO = 100 en home y `/busquedas`**.
- `sitemap.xml`, `robots.txt`, `llms.txt` → 200 en producción.

**Hallazgos:**
- Bajo — **Jerarquía de encabezados** no secuencial (falla `heading-order` en home).

## Accesibilidad — 88/100

**Bien:**
- **`/busquedas` a11y = 96**, con un solo audit fallando (`target-size`).

**Hallazgos:**
- Medio — **Home a11y bajó a 87** (antes 91). Fallan: `color-contrast` (grises sobre claro), `aria-command-name` (controles del mapa sin nombre accesible), `heading-order` y **`target-size` (nuevo)**: touch targets sin tamaño/espaciado suficiente — probablemente los controles agregados recientemente al mapa (botón 3D, capas).

## Infra / DevOps — 82/100

**Bien:**
- Servicio `centros-acopio.service` **active, 0 reinicios**, usuario `acopiove`.
- **Backups locales cada 6 h**: último `centros_acopio_20260702_183001.sql.gz` (18:30 de hoy).
- **Off-site R2 verificado**: `scripts/backup.log` registra `off-site R2 OK` a las 06:30, 12:30 y 18:30 de hoy.

**Hallazgos:**
- Medio — **Sin CI/CD** ni **monitoreo/alertas** (sin cambio en tres auditorías).
- Bajo — **Gotcha del colector**: la sección 7 de `scripts/auditoria.sh` busca `backup.log` en la raíz, pero el archivo vive en `scripts/backup.log`, así que el sync off-site no aparece en la salida automática (se verificó a mano en esta corrida). Ajustar la ruta en el script en la próxima sesión de código.

## Comunicaciones — 90/100

**Bien:**
- **SPF raíz** válido — ahora `include:_spf.mail.hostinger.com` (antes IONOS; cambio de proveedor de correo raíz, registro correcto).
- **DKIM** (`resend._domainkey`) presente; **`send.acopiove.org`** con `include:amazonses.com`.
- **DMARC** presente con `rua` hacia Cloudflare.
- **Plantillas WhatsApp `coordinacion_logistica_v2` y `v3` = `approved`** en Kapso/Meta.

**Hallazgos:**
- Bajo — **DMARC sigue en `p=none`**: tras revisar los reportes `rua`, endurecer a `p=quarantine`.

---

## Recomendaciones priorizadas

### Alta
_(Ninguna crítica abierta.)_

### Media
1. **Rendimiento del cliente**: diferir/code-split el mapa (home, perf 42) y ahora también revisar `/busquedas` (perf 38, TBT 7.0 s) — es el flujo crítico de búsqueda de personas y quedó como la página más pesada medida.
2. **Actualizar dependencias** (`next`, `postcss`) para cerrar las 2 vulns moderate que persisten desde junio.
3. **Accesibilidad de la home**: nombres accesibles y tamaño de touch targets en los controles del mapa (el audit `target-size` es nuevo y bajó el score a 87), más el contraste pendiente.
4. **Contacto de centros**: 328 sin contacto; pedir el dato en la carga y campaña de completado (la carga masiva de fuentes agranda la brecha absoluta aunque el % mejoró).
5. **Observabilidad**: uptime check + alerta (caída del :4100 / 5xx) y CI mínimo con `tsc --noEmit`.

### Baja
1. Configurar ESLint + tests base (`auth.ts`, `guard.ts`, `validation.ts`).
2. Modularizar `PersonasClient.tsx` (1.270) y `Mapa3DView.tsx` (1.079).
3. Revisar los 2 centros activos con estado distinto de `abierto`; corregir las 3 coords placeholder; completar `recibe` (175).
4. Endurecer DMARC a `p=quarantine`; promover CSP a enforcing.
5. Corregir la ruta de `backup.log` en `scripts/auditoria.sh` (sección 7).
6. Commitear o ignorar los 2 PNGs de mapa-3d.

---

## Cambios desde la auditoría anterior (2026-06-29)

| Dimensión | Antes | Ahora | Nota |
|---|---|---|---|
| Seguridad | 90 | 90 | Estable; mismas 2 vulns moderate abiertas. |
| Rendimiento | 83 | **81** | TBT de la home empeoró (2.48 s → 3.86 s) y `/busquedas` midió 38 (primera vez que se mide el flujo crítico). Edge sigue HIT. |
| Datos | 80 | **81** | +124 centros, +26 fuentes, +2 países y % sin contacto bajó a 46.66 %; suben levemente `recibe` faltante y coords duplicadas por la carga masiva. |
| Código | 73 | 73 | `tsc` limpio; sin tests/ESLint; `Mapa3DView.tsx` entra al top de componentes grandes. |
| SEO | 96 | 96 | SEO 100 confirmado también en `/busquedas`. |
| Accesibilidad | 91 | **88** | Home bajó a 87 (audit `target-size` nuevo); `/busquedas` 96 compensa parcialmente. |
| Infra | 82 | 82 | Off-site R2 OK 3 veces hoy en el log; siguen faltando CI/CD y monitoreo. |
| Comms | 90 | 90 | SPF raíz migró de IONOS a Hostinger (válido); resto estable. |
| **GLOBAL** | **86** | **85** | Baja marginal y honesta: el crecimiento de datos fue el gran positivo; el costo de cliente (mapa/JS) y los touch targets nuevos son el gran negativo medible. |

### NO VERIFICADO en esta corrida
- Detalle nominal de los 2 centros con estado distinto de `abierto` (la query directa a la DB fuera del colector fue denegada por permisos de la sesión; el conteo agregado sí proviene del colector).
- La sección 7 del colector no imprimió el sync off-site por la ruta del log (verificado manualmente en `scripts/backup.log`).

---

> **Veredicto:** AcopioVE sigue **robusto y sin hallazgos críticos**. Lo que cambió de verdad desde el 06-29: los datos crecieron con fuerza (703 centros, 108 fuentes, 22 países) manteniendo el % de calidad, los backups off-site quedaron confirmados de nuevo, y el costo del cliente empeoró de forma medible (TBT home +56 %, `/busquedas` en 38) junto con una regresión de accesibilidad en la home (`target-size`). Las palancas de mayor impacto siguen siendo rendimiento del cliente, contacto de los centros y observabilidad.

*Generado siguiendo `AUDITORIA-PLAYBOOK.md` (solo lectura; sin secretos expuestos). Evidencia: `scripts/auditoria.sh` + Lighthouse en home y `/busquedas`.*
