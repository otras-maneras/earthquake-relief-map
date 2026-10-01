# Arquitectura del sistema

> Referencia técnica para desarrolladores. Última revisión: 2026-09-17 (Fusión HelpMaps y Landing SEO).
> **Monorepo:** las rutas de este documento (`src/`, `public/`, `scripts/`…) son relativas a `apps/web/`.
> Para el flujo de trabajo (ramas, verificación, deploy) ver `../CONTRIBUTING.md`.

## 1. Visión general

AcopioVE es una aplicación Next.js (App Router) en el ecosistema **HelpMaps** (`helpmaps.net`) estructurada en:

1. **Landing institucional y de posicionamiento (`/`)**: Portada oficial optimizada para SEO
   (JSON-LD Organization + WebSite + Dataset + FAQPage), métricas en vivo desde PostgreSQL,
   resumen del proyecto, documentación y portal de datos abiertos.
2. **API pública versionada (`/v1`, servida también como `api.acopiove.org/v1`)**:
   **Servicio activo principal** de la plataforma. Datos abiertos CC-BY-4.0 en JSON, GeoJSON y CSV
   para consumo de agencias humanitarias, investigadores y el ecosistema HelpMaps.
3. **Páginas de documentación y contenido (`/resumen`, `/docs`, `/data`, `/centros`, `/refugios`, `/blog`)**:
   Presentación interactiva, especificaciones de arquitectura, descarga directa de datos y listados SSR.
4. **Servicios de mapas y búsquedas redirigidos**: Para evitar sobrecarga de infraestructura y
   centralizar esfuerzos tras la fusión con HelpMaps, las interfaces interactivas pesadas
   (`/acopio`, `/mapa-3d`, `/busquedas`, `/busqueda-avanzada`) redirigen vía HTTP 307 a `/`.
5. **Backoffice (`/admin`)**: Panel administrativo para moderación y mantenimiento de registros.

Principio rector: AcopioVE es la **fuente de verdad canónica** de acopios, refugios y teléfonos,
y sirve sus bases consolidadas a través de la API pública y el portal de descargas.

## 2. Estructura del código

```
src/
  app/
    page.tsx                                         home: Landing institucional + métricas + SEO JSON-LD
    acopio/                                          ruta del mapa 2D (redirigida a / en next.config.mjs)
    busquedas/                                       vista de búsqueda (redirigida a / en next.config.mjs)
    mapa-3d/                                         vista MapLibre GL (redirigida a / en next.config.mjs)
    centros/ refugios/                               listados SSR indexables por país/ciudad
    resumen/                                         presentación interactiva del proyecto (presentacion.html)
    admin/                                           panel administrativo (login, CRUD, moderación)
    api/                                             API interna del sitio
    v1/                                              API pública versionada (servicio activo principal)
    docs/ blog/ acerca/ data/ donate/ interpretes/   páginas de contenido y documentación
  components/site/Chrome.tsx                         header/footer compartido + paleta BRAND_PALETTE + ES_NAV
  db/        schema.ts, index.ts, seeds
  lib/       lógica de dominio y clientes de servicios
scripts/     utilidades operativas (deploy.sh, check-pii.mjs, backup, auditoría)
public/      estáticos, logos de marca, snapshots
deploy/      unit de systemd de referencia
```

Convenciones:

- Componentes de mapa son client-only (`dynamic(..., { ssr: false })`); las paginas que
  los montan son server components con el contenido SEO/JSON-LD en bloques `sr-only`.
- Tokens de diseño `ap-*` (colores, sombras, radios) en `globals.css` y
  `tailwind.config.ts`; la paleta canónica se exporta como `BRAND_PALETTE` en `Chrome.tsx`.
- Búsqueda de texto siempre a través de `normalizeSearchText` (`src/lib/text.ts`):
  normaliza acentos, mayúsculas y espacios.
- **Color de clusters del mapa principal** (`CentrosMap.tsx`, `frescuraEstado()` +
  `iconCreateFunction` del `markerClusterGroup`): no representa densidad (cantidad de
  puntos) sino frescura/verificación — verde si el centro tiene `lastConfirmedAt`
  (confirmado por la comunidad vía `POST /api/centros/[id]/confirmar`), ámbar si no está
  confirmado pero `updatedAt` es de los últimos 7 días, rojo si no está confirmado y
  `updatedAt` supera los 7 días. Un cluster toma el peor color entre sus centros hijos.

## 3. Base de datos (PostgreSQL + Drizzle)

Esquema en `src/db/schema.ts`. Tablas:

| Tabla | Uso |
|---|---|
| `users` | Admins. Roles: `superadmin`, `cargador` |
| `centros` | Acopios/refugios propios. `active=false` = pendiente de moderación. `tipo`: `acopio`/`refugio`. `recibe` es JSONB |
| `centro_sugerencias` | Correcciones sugeridas por el público sobre centros existentes |
| `telefonos` | Directorio de teléfonos de emergencia |
| `voluntarios_snapshot` | Copia local del directorio de intérpretes (Interp-Aid) |
| `contact_lists`, `contacts` | Listas de contactos para campañas |
| `wa_templates`, `broadcasts`, `broadcast_recipients` | Campañas de WhatsApp/correo y su cola |
| `wa_sessions`, `telegram_sessions` | Estado conversacional de los bots (separadas a propósito) |

Migraciones: el esquema se sincroniza con `npm run db:push` (drizzle-kit). Varias
columnas históricas se agregaron con `ALTER TABLE` directo; `schema.ts` es la referencia.

Los datos de **personas no se guardan en la base**: se agregan en vivo desde las fuentes
externas en cada request (con caché de 60 s por fuente).

## 4. Vista consolidada `/busquedas`

Es la superficie más compleja. Flujo de datos:

```
fuentes externas de personas/danos/servicios ──> /api/personas (agregador + dedup)
                                                        │
DB propia (buildPuntos: acopios/refugios/telefonos) ──> │
Venezuela Reporta (sitios + personas on-demand) ──────> /api/busqueda-avanzada
                                                        │   (conciliacion multi-fuente,
                                                        │    modelo Entidad, cache 60s)
                                                        v
                                              PersonasClient (/busquedas)
```

- **Modelo `Entidad`** (`src/lib/busqueda-avanzada/types.ts`): superset de persona/sitio/
  reporte con `tipo` (faceta), `clase` (persona/sitio/reporte), `origen` (fuente exacta,
  lo que usan los toggles de capas) y campos de conciliación (`fuentes[]`, `confianza`,
  `fuentes_detalle`).
- **Conciliación**: fusión de personas solo con evidencia fuerte (cédula completa, o
  nombre de 2+ tokens corroborado por lugar) para no mezclar homónimos; dedup de sitios
  por nombre+coordenadas. Una ficha en N fuentes muestra el badge "N fuentes" con enlace
  a cada original.
- **Modos del endpoint** `GET /api/busqueda-avanzada`: browse (índice completo, cacheado
  60 s en servidor) y búsqueda (`q`, `cedula`, `lugar`, `estado` — dispara fuentes
  on-demand como Venezuela Reporta y ReportaVNZLA).
- **Dos ejes de filtrado en la UI**: facetas (qué es la ficha; chips superiores) y capas
  (de qué fuente sale u overlay del mapa; panel derecho). Se cruzan con AND.
- La ruta histórica `/busqueda-avanzada` redirige 301 a `/busquedas` (unificadas el
  2026-07-11).

## 5. API interna del sitio (`/api/*`)

Consumida solo por el frontend propio y los webhooks. No es contrato público.

| Grupo | Rutas | Notas |
|---|---|---|
| Auth | `auth/login`, `auth/logout`, `auth/me` | Cookie httpOnly + JWT. Rate-limit de login |
| Centros | `centros`, `centros/[id]`, `submit`, `pending`, `[id]/approve`, `[id]/confirmar`, `[id]/sugerir`, `sugerencias` | GET público (solo activos); mutaciones con sesión; approve/delete solo `superadmin` |
| Teléfonos | `telefonos`, `telefonos/[id]` | GET público, mutaciones con sesión |
| Personas | `personas` | Agregador de fuentes externas; modo búsqueda con `q`/`cedula`; rate-limit 45/min/IP |
| Consolidado | `busqueda-avanzada` | Ver sección 4 |
| Sismos | `sismos` | Proxy USGS con caché |
| Noticias | `news/summary`, `news/stats` | GET solo lee caché en disco; POST exige `X-Cron-Secret` (lo dispara un cron) |
| Bots | `kapso/webhook` (WhatsApp), `telegram/webhook` | Firmados: HMAC / secret token, fail-closed |
| Admin | `admin/*` | Solo `superadmin` (RBAC en `src/lib/guard.ts`) |
| Voluntarios | `voluntarios` | Snapshot de intérpretes |

## 6. API pública (`/v1`)

Contrato documentado en `/v1/openapi.json` y https://acopiove.org/docs/api. CORS `*`,
rate-limit por IP, caché CDN (`s-maxage=300` + SWR). Datos CC-BY-4.0.

- `GET /v1/puntos` — directorio unificado (acopios + refugios + teléfonos + salud CIVIS)
  con filtros `tipo`, `ciudad`, `pais`, `near`, y formatos JSON/GeoJSON/CSV.
- `GET /v1/centros`, `/v1/centros/{id}`, `/v1/telefonos`, `/v1/meta` — datos propios.
- `GET /v1/personas` — búsqueda PII-segura (requiere `q` o `cedula`; nunca volcado
  completo; cédula enmascarada, sin teléfonos ni GPS exactos, menores sin ubicación).
- `POST /v1/submissions` + `GET /v1/submissions/{id}` — contribución de terceros: entra
  como pendiente, detecta posibles duplicados, la aprueba un admin. Acepta el shape de
  lectura (`lat`/`lng`) además del canónico; si trae `external_id`/`id` de un centro
  existente entra como sugerencia vinculada (no duplica). Columna `centros.external_id`.

Los listados paginados duplican `total`/`limit`/`offset` en la raíz del JSON además de
`meta.*` (compatibilidad con scrapers genéricos); `meta.*` es el contrato canónico.

## 7. Módulos de `src/lib`

| Módulo | Responsabilidad |
|---|---|
| `api/puntos.ts` | Directorio unificado de sitios propios + CIVIS |
| `api/personas-search*.ts`, `api/reportavnzla-personas.ts` | Búsqueda de personas compartida entre `/api/personas`, `/v1/personas` y bots |
| `busqueda-avanzada/` | Modelo `Entidad` + adaptador de Venezuela Reporta |
| `centros.ts`, `centros-search.ts` | Tipos de centro y búsqueda por cercanía/ciudad |
| `auth.ts`, `guard.ts` | Sesión JWT y RBAC (`requireAuth`/`requireRole`) |
| `validation.ts` | Esquemas Zod de todos los inputs de escritura |
| `ratelimit.ts` | Rate-limit en memoria (por IP, lee `CF-Connecting-IP`) |
| `kapso.ts`, `wa-bot.ts` | Bot de WhatsApp (cliente Kapso + flujo conversacional) |
| `telegram.ts`, `telegram-bot.ts` | Bot de Telegram (espejo del de WhatsApp) |
| `news.ts`, `newsDates.ts` | Boletín: fetch RSS, filtro de relevancia, síntesis vía OpenRouter, caché en disco |
| `broadcast-worker.ts` | Envío de campañas (Resend / plantillas WhatsApp) |
| `blog.ts`, `donate-i18n.ts`, `interpretes-i18n.ts` | Contenido estático tipado |
| `text.ts` | `normalizeSearchText` (acentos/case) |
| `demano.ts`, `donaciones.ts`, `voluntarios.ts` | Adaptadores de fuentes/directorios puntuales |

## 8. Fuentes externas

El catálogo público y navegable (endpoint, formato, qué capa alimenta) está en
https://acopiove.org/docs/fuentes (código: `src/app/docs/fuentes/page.tsx`). Resumen de
integración:

- **Agregadas en vivo por `/api/personas`**: SOS Venezuela, Localizados Venezuela, CIVIS,
  Mapa de Daños (terremotovenezuela.com), Reporte VE, Centros de Insumos VE, Venezuela
  Ayuda (hub), Terremoto Venezuela (REST), REDH AVAPRE, De Mano en Mano.
- **On-demand al buscar**: ReportaVNZLA y Venezuela Reporta (personas).
- **HelpMap Venezuela** (pacientes verificados de hospitales): fuente armada y **apagada**
  por defecto (`HELPMAP_PATIENTS_URL`); ver `docs/integracion-helpmap.md`.
- **Sitios de aliados**: Venezuela Reporta (`/api/v1/sitios`).
- **Capas de mapa**: USGS (ShakeMap/réplicas), TerraVE (SAR Sentinel-1), Microsoft AI
  for Good (edificios dañados, snapshot en `public/danos-catia-la-mar.json`),
  OpenWeatherMap (lluvia), Open-Meteo (clima), GDACS (alertas).

Todas las integraciones son tolerantes a fallos: si una fuente cae, devuelve vacío y el
resto sigue. Importaciones manuales históricas en `docs/FUENTES.md`.

## 9. Decisiones técnicas vigentes

- **Sin tests automatizados todavía** (backlog: CI con `tsc --noEmit` primero).
- **Rate-limit en memoria**: suficiente para 1 proceso; migrar a Redis si se escala
  horizontalmente.
- **PII**: nunca exponer cédulas completas, teléfonos personales ni GPS exacto de
  personas; los menores no llevan ubicación. Cifras agregadas de personas no se publican
  en contenido SEO (las fuentes no están reconciliadas entre sí).
- **Cachés**: fuentes externas `revalidate: 60`; browse consolidado 60 s en memoria;
  API pública 5 min en CDN; boletín de noticias en disco con SWR.
- **Emojis**: no se usan en documentación ni en comunicaciones oficiales.
