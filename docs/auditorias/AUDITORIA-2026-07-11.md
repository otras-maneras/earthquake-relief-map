# Reporte de auditoría adversarial — AcopioVE

> Auditoría independiente del repositorio completo (código, configuración,
> documentación, datos, tooling e historial de git).
> Fecha: 2026-07-11 · Rama auditada: `master` (commit `e750281`).
> Método: lectura del 100% de los archivos versionados + verificación empírica
> contra la aplicación corriendo en `127.0.0.1:4100`.

Cada afirmación se etiqueta según su fuerza probatoria:
**[HECHO]** verificado directamente · **[EVIDENCIA]** fuerte pero indirecto ·
**[INFERENCIA]** deducción razonable · **[OPINIÓN]** recomendación subjetiva.

---

## 1. Resumen ejecutivo

AcopioVE es una aplicación Next.js 16 de respuesta humanitaria bien construida en su
mayor parte: buena cobertura de autorización en el backoffice, webhooks firmados con
comparación en tiempo constante, protección contra fuerza bruta en el login, moderación
de contribuciones públicas y una arquitectura de agregación tolerante a fallos. La
documentación es amplia y, en general, honesta.

Sin embargo, la auditoría encontró **una contradicción grave y verificable entre lo que
el proyecto promete y lo que hace**: el documento de seguridad y el README garantizan que
las cédulas de personas se muestran **"siempre enmascaradas en cualquier salida pública"**
y que no se exponen ubicaciones de menores, pero **la página pública `/busquedas`
entrega al navegador cédulas venezolanas completas sin enmascarar de personas
hospitalizadas/localizadas**, junto con los nombres de los archivos internos de
hospitales de origen. Esta es la falla central del proyecto y debe corregirse antes de
cualquier publicación o difusión.

El resto de los hallazgos son de severidad media o baja: datos simulados ("mocks") que se
mezclan con datos reales en producción, claves de terceros incrustadas en el código,
una CSP que nunca se llega a aplicar, comentarios de configuración que describen un
comportamiento inexistente, y la ausencia total de pruebas automatizadas o CI.

**Estado general: funcional y cuidado, pero NO listo para publicarse como código abierto
ni para ampliar su difusión mientras persista la fuga de PII.**

---

## 2. Evaluación general

| Dimensión | Valoración | Comentario |
|---|---|---|
| Arquitectura | Buena | Separación clara sitio / API v1 / backoffice; agregación con degradación elegante. |
| Autorización (backoffice) | Buena | RBAC consistente y verificado en todas las rutas de mutación. |
| **Privacidad / PII** | **Deficiente** | La promesa central de enmascaramiento se incumple en la superficie más visible. |
| Integridad de datos | Regular | Mocks mezclados con datos reales; deduplicación no determinista en un camino. |
| Gestión de secretos | Regular | `.env` fuera de git (bien), pero varias claves de terceros hardcodeadas. |
| Calidad / mantenibilidad | Regular | Sin tests, sin CI; un archivo (`/api/personas`) de 870 líneas con lógica crítica. |
| Documentación | Buena (con desviaciones) | Extensa y clara, pero contradice al código en el punto más importante. |

---

## 3. Hallazgos principales

### H-1 · CRÍTICO — Fuga de PII: cédulas completas y sin enmascarar en la web pública

**[HECHO].** La página pública `/busquedas` se alimenta de dos endpoints internos sin
autenticación, `GET /api/personas` y `GET /api/busqueda-avanzada`. Ambos devuelven
cédulas venezolanas **completas** de personas reales.

Verificación (aplicación en ejecución, sin credenciales):

```
GET /api/personas            → 2146 fichas, 26 con cédula COMPLETA sin enmascarar
GET /api/busqueda-avanzada   → 2948 fichas, 26 con cédula COMPLETA sin enmascarar
```

Ejemplos reales devueltos al navegador (nombres y cédulas tal cual salen del endpoint):

```
cedula '1XXXXXXX'  | [nombre real omitido] | Localizados (…Pacientes Consolidados Hospitales…xlsx)
cedula '2XXXXXXX'  | [nombre real omitido] | Localizados (…Pacientes Consolidados Hospitales…xlsx)
cedula '2X.XXX.XXX'| [nombre real omitido] | Localizados (…Pacientes Consolidados Hospitales…xlsx)

(Cédulas y nombres reales redactados en este reporte: eran documentos de identidad
de personas reales. Se sustituyen por marcadores; la evidencia original se verificó
en vivo durante la auditoría.)
```

Obsérvese que además del número de cédula se filtra el **nombre del archivo interno de
origen** ("...Pacientes Consolidados Hospitales Venezuela.xlsx"), lo que revela que se
trata de listados clínicos.

**Contradicción documental directa** — `docs/SEGURIDAD.md`, sección "Salvaguardas de PII":

> - Cédulas **siempre** enmascaradas en cualquier salida pública.
> - Sin teléfonos personales ni coordenadas GPS exactas de personas; ubicación general.
> - Menores de edad sin ubicación.

Y el README:

> Los datos de personas ... se muestran con salvaguardas de PII (cédulas enmascaradas,
> sin teléfonos ni GPS exactos, menores sin ubicación).

**Causa raíz [HECHO].** Existen **dos caminos de código paralelos** para los mismos datos
de personas, y solo uno enmascara:

- `src/lib/api/personas-search.ts` + `reportavnzla-personas.ts` aplican
  `maskCedulaPublic()` → `***NNN`. Este camino es el que usa la **API pública documentada
  `/v1/personas`**, y funciona correctamente (verificado: `GET /v1/personas?q=abreu`
  devuelve `ced=***301`).
- `src/app/api/personas/route.ts` (el agregador original, 870 líneas) copia la cédula
  **cruda** desde la fuente Localizados: `cedula: p.cedula || null` (línea ~328). Este
  camino es el que consume la **web pública** `/busquedas` a través de
  `/api/busqueda-avanzada`, que en `slimForMap()` conserva `cedula` para las fichas de
  clase `persona` (líneas 253-254 de `busqueda-avanzada/route.ts`).

Es decir: el endpoint que *nadie documenta como público* es el que la interfaz pública
realmente usa, y es el único que no sanea.

**[INFERENCIA]** La salvaguarda de "menores sin ubicación" también está ausente en este
camino: `/api/personas` no calcula `edad` para la mayoría de las fuentes (solo `/v1` y
ReportaVNZLA aplican el `edad < 18 → sin ubicación`). Se verificó que el endpoint entrega
1.535 fichas con `lat`/`lng`; no fue posible aislar cuáles corresponden a menores porque
la edad no viaja, lo que es en sí mismo parte del problema.

**Riesgo.** Exposición de datos personales identificables (cédula = documento nacional
único) de personas en situación de emergencia y de menores, en un contexto políticamente
sensible. Impacto legal, reputacional y humano alto.

---

### H-2 · ALTO — Datos simulados ("mocks") servidos como reales en producción

**[HECHO].** `src/app/api/personas/route.ts` inyecta fichas ficticias hardcodeadas cuando
una fuente externa falla o no está configurada, y esas fichas se sirven a la web pública.
Ejemplos (líneas 363-505, 675-704):

- Reportes de servicios "mock-1".."mock-5" (cortes de luz, agua, medicinas) con textos
  verosímiles y coordenadas reales de La Guaira, fuente `"Reporte VE (Simulado)"`.
- Personas inventadas con cédulas de aspecto real: `Ricardo Altuve — V-15.421.***`,
  `Elena De Freitas — V-12.890.***`, fuente `"Terremoto Venezuela (Simulado)"`.
- Edificio dañado inventado "Residencias Aquarium" con foto de Supabase.

Aunque el sufijo "(Simulado)" aparece en el campo `fuente`, estos registros llevan
coordenadas, estados ("Daño Total", "Hospitalizado") y observaciones clínicas que un
usuario en emergencia interpretará como información operativa. **[OPINIÓN]** En una app de
respuesta a desastres, mezclar datos de prueba con datos reales en el mismo flujo público
es peligroso: puede enviar a alguien a un centro inexistente o dar por localizada a una
persona ficticia. Los mocks deberían estar detrás de un flag de entorno de desarrollo,
nunca activarse en producción.

---

### H-3 · ALTO — Claves de terceros incrustadas en el código versionado

**[HECHO].** Varias integraciones traen claves como *fallback* hardcodeado en el fuente:

```
src/app/api/personas/route.ts:188  DANOS_EDIFICIOS_API_KEY || 'sb_publishable_<REDACTADA>...'   (Supabase)
src/app/api/personas/route.ts:253  AYUDA_VENEZUELA_API_KEY  || '<REDACTADA>' (X-API-Key)
src/lib/voluntarios.ts:42          INTERP_AID_KEY           || 'sb_publishable_<REDACTADA>...'  (Supabase)
```

**[INFERENCIA]** Las claves `sb_publishable_*` son claves publicables de Supabase (bajo
riesgo si las políticas RLS están bien). Pero `<REDACTADA>` se envía
como `X-API-Key` a `ayudavenezuela.online` y el comentario del código la llama "Key de
Desarrollador": una credencial de este tipo normalmente **no** está pensada para vivir en
un cliente público. El commit `dad9f0a` demuestra conciencia del tema (sacó del repo
scripts con correos reales), pero estas claves quedaron. Deberían moverse a `.env` sin
fallback, o al menos rotarse y documentarse como públicas si de verdad lo son.

---

### H-4 · MEDIO — `/api/personas` es un volcado completo sin término de búsqueda

**[HECHO].** El principio rector documentado para datos de personas es *"es un LOOKUP
(requiere término de búsqueda), no un volcado masivo"* (comentario en `personas-search.ts`
y validación real en `/v1/personas`, que exige `q` o `cedula`). Sin embargo,
`GET /api/personas` **sin ningún parámetro** devuelve 1,2 MB / 2.146 fichas (verificado),
y `/api/busqueda-avanzada` en modo browse devuelve el índice completo. La regla anti-
volcado solo se aplica en `/v1`; la superficie que de verdad usa el público la ignora.
Esto agrava H-1: no solo se filtran cédulas, sino que se pueden extraer **todas** de una
sola petición.

---

### H-5 · MEDIO — Deduplicación de personas no determinista y con riesgo de mezclar PII

**[HECHO].** En `src/app/api/personas/route.ts` (líneas 770-835), la deduplicación:

- Usa `uniquePersons.set(\`rand-${Math.random()}\`, ...)` como clave cuando no hay cédula
  ni nombre suficientes → **resultado no determinista** entre peticiones idénticas.
- Fusiona por **nombre normalizado** (`cleanName.length > 5`) sin corroborar lugar. Los
  nombres venezolanos comunes (homónimos) se fusionan, **combinando la PII de personas
  distintas** en una sola ficha (cédula de una, observaciones/hospital de otra).

**[EVIDENCIA]** El endpoint más nuevo `/api/busqueda-avanzada` corrige justamente esto con
`personaKey()`, que exige "cédula completa o nombre + lugar corroborado" y cuyo comentario
advierte explícitamente del peligro de mezclar homónimos. Pero `/api/busqueda-avanzada`
**consume** la salida ya deduplicada de `/api/personas`, así que hereda las fusiones
erróneas hechas aguas arriba. Coexisten dos algoritmos de conciliación contradictorios.

---

### H-6 · MEDIO — CSP declarada pero nunca aplicada; `unsafe-inline` en scripts

**[HECHO].** `next.config.mjs` emite la política solo como
`Content-Security-Policy-Report-Only`, y además con `script-src 'self' 'unsafe-inline'`.
`docs/SEGURIDAD.md` lo lista como "Implementado ... (observa sin bloquear; promover a
enforcing cuando los reportes lo confirmen)" y como pendiente #1. **[OPINIÓN]** Una CSP en
Report-Only no protege de XSS; es un plan, no un control. Dado que hay múltiples
`dangerouslySetInnerHTML` (JSON-LD con datos, `LayersPanel` inyectando `l.svg`), conviene
promoverla a enforcing con nonces en lugar de `unsafe-inline`.

---

### H-7 · MEDIO — Comentario de configuración que describe un comportamiento inexistente

**[HECHO].** El encabezado de `next.config.mjs` dice:

> `// App de emergencia: que un error de tipos/lint no bloquee un build urgente.`
> `// (Igual corremos tsc/build en local; esto es una red de seguridad.)`

Pero **la configuración no contiene** `typescript.ignoreBuildErrors` ni
`eslint.ignoreDuringBuilds`. El comentario describe una "red de seguridad" que no existe
(probablemente se eliminó y el comentario quedó). Un colaborador nuevo creería que los
builds toleran errores de tipos cuando en realidad fallan. Comentario obsoleto y
engañoso: eliminarlo o restaurar la opción si de verdad se quería.

---

### H-8 · MEDIO — Sin pruebas automatizadas ni CI

**[HECHO].** 198 archivos versionados, **cero** archivos de test (`*.test.*`, `*.spec.*`,
`__tests__/`) y **cero** configuración de CI (`.github/`, etc.). `CONTRIBUTING.md`
describe un "flujo de verificación", pero es manual. Para un sistema con lógica de
enmascaramiento de PII, conciliación multi-fuente y rate-limiting —exactamente el tipo de
código donde un test habría atrapado H-1— la ausencia de pruebas es un riesgo estructural.
El `package.json` ni siquiera define script `test`.

---

### H-9 · BAJO/MEDIO — Confianza ciega en cabeceras de IP del cliente

**[HECHO].** `clientIp()` (`src/lib/ratelimit.ts`) confía en `CF-Connecting-IP` y, si no
está, en el primer valor de `X-Forwarded-For`, sin validar el origen. **[INFERENCIA]** Los
comentarios del propio código indican que `hook.acopiove.org` es un subdominio "DNS-only,
sin proxy de Cloudflare". Si la IP del origen es alcanzable directamente (fuera del CDN),
un atacante puede falsificar `CF-Connecting-IP` a piacere y así **evadir el rate-limit y
la protección de fuerza bruta del login** (que se apoya en `login:ip:<ip>`), o envenenar
los contadores de otras IPs. El rate-limit por email mitiga parcialmente el login, pero no
el resto de los buckets.

---

## 4. Evidencia de respaldo (reproducible)

Con la app corriendo en `:4100` y sin credenciales:

```bash
# H-1 y H-4: cédulas completas en la superficie pública
curl -s http://127.0.0.1:4100/api/personas | \
  python3 -c "import sys,json,re; d=json.load(sys.stdin); \
  u=[r for r in d['data'] if r.get('cedula') and '*' not in str(r['cedula']) and re.search(r'\d{6,}',str(r['cedula']))]; \
  print('unmasked:',len(u))"          # → unmasked: 26

# Contraste: la API pública documentada SÍ enmascara
curl -s 'http://127.0.0.1:4100/v1/personas?q=abreu'   # → cedula '***301', '***580', ...
```

Verificaciones estáticas:

- `git ls-files | wc -l` → 198; `grep` de tests/CI → ninguno.
- `grep -n ignoreBuildErrors next.config.mjs` → sin coincidencias (H-7).
- `.env` real **no** está versionado (correcto); `scripts/privado/`, `docs/internal/`,
  `rclone.conf`, `backups/` correctamente en `.gitignore`.
- `npm audit --omit=dev` → 0 vulnerabilidades.

---

## 5. Riesgos e implicaciones

1. **Legal / privacidad (H-1, H-4, H-5):** exposición masiva de documentos de identidad
   de personas vulnerables, incluidos potencialmente menores. En Venezuela y para la
   diáspora esto puede facilitar suplantación, extorsión o persecución. Es el riesgo que
   podría dañar irreversiblemente la credibilidad del proyecto.
2. **Operativo (H-2):** decisiones de vida o muerte tomadas sobre datos simulados.
3. **Seguridad de credenciales (H-3):** claves en el repo → si se publica el código
   "de historia limpia" (objetivo declarado en `dad9f0a`), esas claves viajan con él.
4. **Mantenibilidad (H-5, H-8):** dos algoritmos de conciliación divergentes y sin tests
   hacen que cualquier cambio en personas sea frágil; el propio H-1 es prueba de que ya
   se rompió una invariante crítica sin que nadie lo detectara.
5. **Confianza en documentación (H-1, H-7):** cuando `SEGURIDAD.md` afirma algo que el
   código no cumple, todo el resto del documento pierde autoridad ante un revisor.

---

## 6. Observaciones positivas

- **[HECHO]** RBAC sólido y **consistente**: se verificó que *todas* las rutas de mutación
  (`/api/admin/*`, `centros`, `telefonos`, sugerencias, aprobaciones) están protegidas con
  `requireRole`/`requireAuth`/`getSession`; las de mayor privilegio exigen `superadmin`.
- **[HECHO]** Webhooks fail-closed con `timingSafeEqual` y HMAC-SHA256 (Kapso) / token
  exacto (Telegram); comparación de longitud previa correcta.
- **[HECHO]** `JWT_SECRET` con fail-fast en producción (no firma con secreto de dev).
- **[HECHO]** Protección de fuerza bruta en login por IP **y** por email, con limpieza de
  contadores al éxito.
- **[HECHO]** Contribuciones públicas: honeypot + cola de moderación (`active=false`) +
  detección de duplicados. Buen diseño anti-abuso.
- **[HECHO]** La API pública `/v1` sí cumple sus promesas: enmascara, exige lookup,
  parametriza queries, versiona y documenta OpenAPI.
- **[HECHO]** Conciliación cuidadosa en `/api/busqueda-avanzada` (`personaKey`, evidencia
  fuerte) — el patrón correcto que debería regir todo el sistema.
- **[HECHO]** Degradación tolerante a fallos de las ~11 fuentes externas.
- **[HECHO]** Documentación amplia y estructurada (ARQUITECTURA, FUENTES, SEGURIDAD,
  auditorías previas); higiene de secretos en git bien pensada.
- **[HECHO]** 0 vulnerabilidades de dependencias.

---

## 7. Oportunidades de mejora

- **Unificar a una sola ruta de datos de personas.** `/api/personas` (870 líneas) debería
  reescribirse sobre las funciones ya saneadas de `personas-search.ts`, eliminando el
  camino crudo y el algoritmo de dedup por nombre. Una única fuente de verdad para PII.
- **Flag de mocks.** Encerrar todos los datos simulados tras `NODE_ENV !== 'production'`.
- **Secretos.** Mover las tres claves hardcodeadas a `.env` (sin fallback) y rotarlas.
- **Tests mínimos de invariantes.** Aunque sea sin framework: un script que llame a
  `/api/personas` y falle si aparece una cédula con ≥6 dígitos sin `*`. Añadir un CI que
  lo corra en cada push.
- **Reducir `any`.** 22 usos de `any`/`as any` en `src`; concentrados en los mappers de
  personas, justo donde ocurren los fallos de PII. Tipar las respuestas externas ayudaría.
- **`scripts/` fuera del typecheck.** `tsconfig.json` excluye `scripts`, por lo que los
  scripts de migración y carga no se verifican. Considerar un tsconfig aparte para ellos.
- **CSP a enforcing** con nonces; retirar `unsafe-inline`.

---

## 8. Recomendaciones priorizadas

| # | Prioridad | Acción |
|---|---|---|
| 1 | **Bloqueante** | Enmascarar cédulas y omitir ubicación de menores en `/api/personas` y `/api/busqueda-avanzada` (o migrarlas al camino ya saneado). No publicar/difundir hasta cerrarlo. |
| 2 | **Bloqueante (pre-open-source)** | Quitar/rotar las claves de terceros hardcodeadas (H-3). |
| 3 | Alta | Desactivar los mocks en producción (H-2). |
| 4 | Alta | Test de invariante anti-PII + CI mínimo (H-8). |
| 5 | Media | Unificar la deduplicación de personas en `personaKey` (H-5); eliminar `Math.random()` como clave. |
| 6 | Media | Corregir el comentario engañoso de `next.config.mjs` (H-7). |
| 7 | Media | Promover la CSP a enforcing (H-6). |
| 8 | Baja | Validar el origen antes de confiar en `CF-Connecting-IP`/`XFF`; restringir el origen a IPs del CDN (H-9). |
| 9 | Baja | Definir la licencia del código antes de publicar; resolver la relación con el `upstream` (fork de `GiorgyArmani/helpmap-venezuela`). |

---

## 9. Preguntas abiertas que merecen investigación

1. **¿Las fuentes upstream (SOS Venezuela, Localizados, hospitales) publican esas cédulas
   completas, o AcopioVE es quien las expone?** Si las cédulas llegan crudas de la fuente,
   el deber de enmascarar es aún más claro; si la fuente ya las publica, sigue siendo un
   incumplimiento de la promesa propia.
2. **¿La IP de origen es alcanzable sin pasar por Cloudflare?** De ello depende la
   severidad real de H-9 (bypass de rate-limit/fuerza bruta).
3. **¿Se planeaba `typescript.ignoreBuildErrors`?** El comentario de `next.config.mjs`
   sugiere que existió; conviene decidir si se restaura o se borra el comentario.
4. **Licencia y atribución del fork.** El README dice "licencia pendiente"; publicar un
   fork sin resolver la procedencia (`upstream`) es un riesgo legal abierto.
5. **`alojamiento` como tipo:** el esquema y el formulario lo soportan, pero hay 0 filas en
   la DB y el README no lo menciona. ¿Es una función a medio construir o abandonada?

---

## 10. Evaluación final del estado del proyecto

AcopioVE es un proyecto **maduro en intención y en su mayoría en ejecución**: la ingeniería
de autorización, webhooks, moderación y agregación está por encima de lo habitual en
proyectos de emergencia hechos a contrarreloj, y la documentación revela un equipo que
piensa en seguridad. Pero esa misma documentación hace una promesa concreta sobre datos de
personas —el activo más sensible del sistema— que **el código incumple en la superficie
más visible y sin autenticar**. La brecha no es teórica: se reproduce con un solo `curl`.

En su estado actual el proyecto **no está listo para ampliar su difusión ni para
publicarse como código abierto**. Cerrando el hallazgo H-1 (y con él H-4/H-5), retirando
las claves hardcodeadas y desactivando los mocks en producción, el proyecto pasaría de
"riesgoso" a "sólido": el resto de los problemas son de higiene y de deuda técnica
manejable. La prioridad absoluta es alinear la realidad del enmascaramiento de PII con lo
que el proyecto ya promete por escrito.
