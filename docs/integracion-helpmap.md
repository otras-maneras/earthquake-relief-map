# Integración AcopioVE ⇄ HelpMap Venezuela

> Estado y contrato de la integración con **HelpMap Venezuela** (`helpmapvzla.net`,
> repo `GiorgyArmani/helpmap-venezuela`). Última revisión: 2026-07-12.

HelpMap es el **`upstream`** del que AcopioVE nació como fork; comparten ancestro pero
hoy son apps distintas: HelpMap corre en **Supabase + Vercel** (con n8n y un bot de
Telegram para la carga), AcopioVE en **Postgres self-hosted + Next** detrás de Cloudflare.

## 1. Modelo: autoridad por dominio

Cada app es fuente de verdad de lo suyo e ingiere lo del otro en **solo lectura**, con
la procedencia etiquetada para no re-emitir en círculo:

| Dominio | Autoridad | El otro lo… |
|---|---|---|
| Refugios / acopios / teléfonos | **AcopioVE** | HelpMap lo **jala** (sync de refugios) |
| Pacientes de hospitales | **HelpMap** | AcopioVE lo **ingiere** (fuente de personas) |

## 2. Refugios (HelpMap ← AcopioVE) — ya existe

- **Pull (funciona):** HelpMap `GET /api/refugios/sync` (cron diario) consume nuestro
  `GET /v1/centros?tipo=refugio&format=json&limit&offset&updatedSince`, upsert por
  `external_id` (nuestro UUID) con *freshest-wins* por `updated_at`.
- **Push (de vuelta):** HelpMap `POST /api/refugios/push` → nuestro `POST /v1/submissions`
  como sugerencia moderada. Estaba **roto** por un mismatch de campos; ver §3.

## 3. Cambios hechos en AcopioVE para habilitar la integración (A1 + A2)

`POST /v1/submissions` ahora, **retrocompatible**:

- **Acepta el shape de lectura** (`lat`/`lng`/`necesita_ahora`) además del canónico
  (`latitude`/`longitude`/`necesitaAhora`). Antes, un POST modelado sobre el DTO que la
  API *devuelve* fallaba con `400` — justo el caso del push de HelpMap.
- **Acepta `external_id`** (o `id` como alias). Si apunta al UUID de un centro nuestro
  existente → entra como **sugerencia moderada vinculada** a ese centro (no duplica); si
  no → alta nueva pendiente que **guarda el `external_id`** (columna nueva
  `centros.external_id`).

Respuesta: `data.kind` = `"suggestion"` (con `linked_to`) o `"new"`.

## 4. Pacientes (AcopioVE ← HelpMap) — armado y APAGADO (B1)

Fuente de ingesta en `/api/personas` (`src/lib/api/helpmap-personas.ts`). **Apagada** por
defecto: sin `HELPMAP_PATIENTS_URL` no consulta nada.

### Encender
```
HELPMAP_PATIENTS_URL=https://www.helpmapvzla.net   # base de su API
HELPMAP_INCLUDE_DECEASED=                           # =1 para incluir fallecidos (default: excluidos)
```
Al setear la URL, los pacientes verificados de HelpMap aparecen en `/api/personas`,
`/busquedas` y la conciliación multi-fuente, sin más cambios.

### Fuente y contrato consumido
`GET /api/v1/patients` de HelpMap: solo filas `verified=true`, vista `patients_public`,
CORS abierto, rate-limit 60/min, paginado (`limit`/`offset`/`count`/`next`), `q` filtra
nombre/apellido/CI server-side.

### Mapeo paciente → persona de AcopioVE
| HelpMap | AcopioVE | Nota |
|---|---|---|
| `id` | `id = helpmap-<id>` | |
| `nombres` + `apellidos` | `nombre` | |
| `ci_display` | `cedula` | **cruda**; el enmascarado central la reduce a `***NNN` |
| `estatus` INGRESADO/ALTA | `status` Hospitalizado/Alta médica, `tipo=localizado` | |
| `estatus` FALLECIDO | — | **excluido** salvo `HELPMAP_INCLUDE_DECEASED=1` |
| `lat`/`lng` (hospital) | `lat`/`lng` | reales; **null si menor** |
| `location_name`, `municipality`, `state` | `lugar`, `observaciones` | |
| `updated_at` | `fecha` | |

### Salvaguardas de PII (por diseño)
- **Cédula:** siempre enmascarada por el paso central de `/api/personas` (`maskCedulaPublic`),
  que además usa los dígitos crudos solo internamente para dedup.
- **Menores:** sin ubicación (el mapper anula lat/lng si `is_minor`, y el paso central
  anula por `edad < 18`).
- **Fotos:** nunca (la API de HelpMap ya las omite; el mapper fuerza `foto=null`).
- **Fallecidos:** excluidos por defecto.
- **Gate:** `npm run check:pii` (corre en cada deploy) valida que nada sin enmascarar
  salga por estas superficies, incluida esta fuente.

Verificado con la fuente encendida en pruebas: 3.6k filas de HelpMap ingeridas, **0
cédulas sin enmascarar**, 0 fallecidos, dedup fusionando con otras fuentes
("`Localizados + HelpMap VE`").

## 5. Decisiones que dependen del equipo de HelpMap (matriz)

| Tema | Default actual en AcopioVE | Decisión de HelpMap |
|---|---|---|
| Ingerir pacientes | listo, **apagado** | ¿autorizan encenderlo y con qué términos? |
| Fallecidos | excluidos | ¿incluir? |
| Cédula en su bulk | la enmascaramos al ingerir | ¿la enmascaran ellos en origen? |
| Reactivar su push de refugios | ya lo soportamos | ¿lo encienden (`ACOPIOVE_PUSH_ENABLED=1`)? |
| Jalar acopios/teléfonos (`/v1/puntos`) | disponible | ¿les interesa? |

## 6. Licencia y términos
- Datos de AcopioVE: **CC-BY-4.0** → atribución "Datos: AcopioVE (acopiove.org)".
- Datos de HelpMap: atribuir **"HelpMap VE"**; uso humanitario, sin reidentificar/
  perfilar/targetear, sin publicar conteos de víctimas (honrado al ingerir).
- API de AcopioVE versionada (`/v1`): los cambios serán compatibles o irán a `/v2`.
