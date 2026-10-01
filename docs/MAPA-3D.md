# Mapa 3D — reporte de implementación

> Última actualización: 2026-07-02. Archivo de referencia para el módulo `/mapa-3d`.
> Código principal: `src/app/mapa-3d/Mapa3DView.tsx`.

---

## Estado general

| Área | Estado |
|------|--------|
| Capas de Personas en mapa 3D | Implementado y desplegado |
| Daño Satelital (SAR) | Activo por defecto |
| Bug parseo `/api/personas` | Corregido |
| Reorganización panel de capas | Hecho (misma taxonomía que `/busquedas`) |
| Buscador de personas (icono lupa) | Hecho |
| Orden de apilado (z-index) | `syncOverlayOrder()` |
| Carga VenezuelaRed en DB | 8 centros (+ docs) |
| Módulo de noticias (boletín) | Corregido (OpenRouter) |

---

## 1. Mapa 3D — arquitectura

**Ruta:** `/mapa-3d`  
**Archivo:** `src/app/mapa-3d/Mapa3DView.tsx`  
**Motor:** MapLibre GL JS (WebGL, independiente del mapa 2D Leaflet en `/busquedas`).

**Vista base:** edificios de Catia La Mar con `fill-extrusion` 3D (`danos-3d`), dataset
`/danos-catia-la-mar.json` (Microsoft AI for Good). Altura = % de daño estimado, no altura
real del edificio.

**Centro inicial:** `[-67.0207, 10.6084]`, zoom 16, pitch 60°, bearing -20°.

**Basemap:** OpenFreeMap (`https://tiles.openfreemap.org/styles/liberty`), sin API key.

---

## 2. Panel «Capas del mapa» — clasificación actual

El panel (antes «Más capas») replica la estructura de `/busquedas`:

### Daños (sección prioritaria, primera en el panel)

| Toggle | ID mapa | Fuente | Color | Default |
|--------|---------|--------|-------|---------|
| Daño Satelital (SAR) | `sar-terra-fill` / `sar-terra-line` | TerraVE API | `#06b6d4` | **ON** |
| Edificios Dañados (IA) | `danos-3d` | `/danos-catia-la-mar.json` | `#b91c1c` | ON |
| Daños Estructurales | `danos-estructurales` | `/api/personas` (`tipo: danos`) | `#db2777` | OFF |

### Personas

| Toggle | `tipo` en API | Color | Default |
|--------|---------------|-------|---------|
| Se busca | `desaparecido` | `#ef4444` | OFF |
| Localizados (Salud) | `localizado` | `#059669` | OFF |
| REDH AVAPRE | `redh` | `#ea580c` | OFF |
| Terremoto Venezuela | `ayudavenezuela` | `#16a34a` | OFF |

### Ayuda y necesidades

| Toggle | `tipo` | Color | Default |
|--------|--------|-------|---------|
| Venezuela Ayuda | `hub` | `#0891b2` | OFF |
| De Mano en Mano | `demano` | `#0d9488` | OFF |
| Centros de Insumos | `insumos` | `#8b5cf6` | OFF |

### Sismos y clima

| Toggle | Fuente | Default |
|--------|--------|---------|
| ShakeMap 2026 | `/shakemap-intensity.json` | OFF |
| Epicentros 2026 | GeoJSON inline | OFF |
| Réplicas 2026 | `/api/sismos` (USGS, refresh 5 min) | OFF |
| Terremoto 1967 | `/shakemap-1967-intensity.json` | OFF |
| Clima por ciudad | Open-Meteo | OFF |
| Alertas de desastres | GDACS | OFF |
| Lluvia | OpenWeatherMap raster (si `NEXT_PUBLIC_OPENWEATHER_KEY`) | OFF |

---

## 3. Capas de Personas — implementación técnica

### API unificada

`GET /api/personas` → respuesta **`{ data: Persona[], meta: {...} }`**.

> **Bug corregido (2026-07-02):** el mapa 3D leía `data.items` en lugar de `data.data`,
> lo que dejaba arrays vacíos y capas sin puntos. Helper actual:
> `parsePersonasRows(body)` → `body.data ?? body.items ?? []`.

### Clustering MapLibre nativo

Por cada capa activa de personas:

- Fuente GeoJSON con `cluster: true`, `clusterMaxZoom: 14`, `clusterRadius: 50`.
- Capas: `{id}-clusters` (círculos agrupados) y `{id}-punto` (puntos individuales).
- Sin capa `-count` de texto (evita errores 404 de glyphs `Noto Sans Bold`).
- Popup simplificado: nombre / estado / lugar, «+N más» si hay varias personas en el mismo punto.
- Sin filtros «Todos / Desap. / Loc.» del mapa 2D (decisión cerrada: overview 3D, detalle en `/busquedas`).
- Hub sin sub-toggle de ofertas en v1.

### Fetch compartido

`loadPersonasCache()` con caché en memoria 60 s (`personasCacheRef`). Usado por capas de
personas y por el buscador.

### Conteos aproximados en API (jul 2026, con coords)

| `tipo` | Total | En bbox Catia (~10.58–10.62, -67.04–-67.00) |
|--------|-------|---------------------------------------------|
| `desaparecido` | 74 | 17 |
| `localizado` | 74 | 1 |
| `danos` | 634 | 48 |
| `hub` | 733 | 32 |
| `ayudavenezuela` | 42 | 1 |
| `demano` | 11 | 0 |
| `insumos` | 1 | 0 |
| `redh` | **0** | 0 |

**Nota REDH:** capa legítimamente vacía si la API no devuelve registros `redh` — no es bug de render.

**Nota visibilidad «Se busca»:** puntos rojos (`#ef4444`) pueden perderse visualmente sobre
edificios 3D naranja/rojos del mismo lugar. Capas con color contrastante (hub cyan, danos
rosa) se ven mejor. Mejora pendiente opcional: estilo «anillo» blanco + borde rojo para
desaparecidos.

---

## 4. Daño Satelital (SAR) — TerraVE

- **Default:** activo al cargar la página.
- **Endpoint:** `https://terra-ve.vercel.app/api/satelital?lat_min=&lat_max=&lng_min=&lng_max=&limit=800`
- **Trigger:** `moveend` del mapa (recalcula bbox visible).
- **Render:** polígonos circulares aproximados por `area_m2`; fill `#06b6d4` opacidad 0.42,
  línea `#0891b2` ancho 2.5.
- **Prioridad z-index:** SAR queda encima de daños estructurales vía `syncOverlayOrder()`.

### 4.bis Capa "Daño probable (Sentinel-1)" nacional (2026-07-09)

Segunda capa satelital, independiente de TerraVE (toggle `showLikelyDmg`, apagada por
defecto, color `#b91c1c`):

- **Fuente:** FeatureServer ArcGIS público (sin API key) de Corey Scher (CUNY) y Jamon
  Van Den Hoek (Oregon State) — método coherence-change con Copernicus Sentinel-1.
  Constantes `LIKELY_DMG_LAYER` / `LIKELY_DMG_MIN_ZOOM` en `Mapa3DView.tsx`.
- **Alcance:** ~2,7M polígonos de edificios a escala nacional con `damage` (0/1) y
  `damage_probability`. Se consulta por bbox visible, solo `damage=1`, paginado a 2000
  por página y con zoom mínimo 13 para no traer el país entero.
- **Popup:** porcentaje de probabilidad + atribución; requiere verificación de campo.
- Esta capa nacional existe solo en `/mapa-3d`. Los mapas 2D (home y `/busquedas`)
  tienen sus propias capas de daño: TerraVE (`src/app/SarLayer.tsx` en la home,
  `SarLayer` embebido en `PersonasMap.tsx`) y Microsoft AI for Good
  (`DanosMicrosoftLayer.tsx`, Catia La Mar).

---

## 5. Orden de apilado (`syncOverlayOrder`)

Función central que eleva capas en este orden (de abajo hacia arriba):

1. Contexto sísmico/clima (shakemap, epicentros, réplicas, 1967, clima, alertas, lluvia)
2. `danos-estructurales`
3. `sar-terra-fill` / `sar-terra-line` ← prioridad entre overlays de daño
4. Capas cluster de personas (`personas-*-clusters`, `personas-*-punto`)
5. `persona-search-marker` (marcador del buscador)

La capa base `danos-3d` (extrusión 3D) permanece debajo de todos los overlays.

---

## 6. Buscador de personas

**Activación:** icono de lupa debajo del botón «Volver» (esquina superior izquierda).

**Comportamiento:**

1. Abre panel flotante con campo de búsqueda.
2. Precarga `/api/personas` al abrir.
3. Filtra por nombre, cédula, lugar, observaciones, status, category, fuente.
4. Muestra hasta 25 resultados con ubicación.
5. Al hacer clic en un resultado:
   - `map.easeTo()` al punto (zoom 17)
   - Marcador `persona-search-marker` (círculo blanco, borde azul)
   - Popup con nombre, tipo y lugar

---

## 7. Bugs corregidos en esta iteración

| Bug | Causa | Fix |
|-----|-------|-----|
| Capas Personas vacías | Parse `data.items` en vez de `data.data` | `parsePersonasRows()` |
| Daños Estructurales vacíos | Mismo parse incorrecto | Mismo helper |
| Daños Estructurales no refrescaba al re-toggle | `if (map.getSource(ID)) return` sin `setData` | `src.setData(fc)` si ya existe |
| Clusters sin número visible | Capa symbol con font inexistente | Eliminada capa `-count`; radio del cluster escalado por `point_count` |
| Puntos bajo edificios 3D | Orden de capas | `syncOverlayOrder()` + `raiseLayersOnTop()` |

---

## 8. Carga de datos VenezuelaRed (sesión previa)

**Doc detallado:** `docs/CARGA-VENEZUELARED.md`  
**Entrada en fuentes:** `docs/FUENTES.md`

- Fuente: venezuelared.com (VenezuelaHelp), sin API pública; datos embebidos en Next.js.
- **8 centros cargados** en DB (`fuente: venezuelared.com (VenezuelaHelp)`).
- **2 pendientes coords** (documentados, no cargados): Los Mangos animal, IRDA.
- **22 zonas** clasificadas como otro modelo (no `acopio`/`refugio`).
- También se cargaron **12 centros de Julieta** (FL, TX, Caracas, SV, Dogspital, etc.).
- Total API centros tras carga: ~703 → ~723.

---

## 9. Módulo de noticias (sesión previa)

**Archivos:** `src/lib/news.ts`, `src/app/NewsModal.tsx`

**Problema:** boletín congelado desde 29-jun por error OpenRouter **402** (`max_tokens`
default 65536 vs créditos).

**Correcciones desplegadas:**

- Modelo default: `google/gemini-2.5-flash` (env `OPENROUTER_NEWS_MODEL`).
- `max_tokens: 8192` (env `OPENROUTER_NEWS_MAX_TOKENS`).
- Fechas de publicación en viñetas: `Hace X horas · pub. DD/MM/AAAA HH:MM`.
- RSS normaliza `[FECHA_PUBLICACION]` a hora Venezuela.
- `NewsModal` muestra fecha `pub.` en cabecera de cada tarjeta.

---

## 10. Deploy y pruebas

**Regla del proyecto:** no buildear/reiniciar manualmente en prod. Usar:

```bash
./scripts/deploy.sh
```

El script: permisos → build como `acopiove` → restart `centros-acopio` → health check :4100.

**Verificación local recomendada:**

```bash
npx tsc --noEmit
```

**Checks manuales en `/mapa-3d`:**

- [ ] SAR activo al cargar (polígonos cyan visibles en Catia)
- [ ] Panel «Capas del mapa» con 4 secciones ordenadas
- [ ] Toggle «Se busca» muestra puntos (alejar zoom si hace falta)
- [ ] «Daños Estructurales» muestra puntos rosas (~48 en Catia)
- [ ] Buscador (lupa) → escribir «Catia» → resultados → clic vuela al punto
- [ ] Sin errores críticos en consola (warnings de fonts OpenFreeMap son conocidos y no bloquean)

**Para desarrollo aislado** (no tocar prod en :4100):

```bash
git worktree add /tmp/perf-test HEAD
rsync -a --exclude node_modules --exclude .next --exclude .git <ruta-del-proyecto>/ /tmp/perf-test/
cp .env /tmp/perf-test/.env
cd /tmp/perf-test && npm ci
npx next dev -p 4200 -H 127.0.0.1
```

---

## 11. Decisiones de producto (cerradas)

- Popup Personas en 3D: simplificado (sin filtros Todos/Desap/Loc del 2D).
- Hub Venezuela Ayuda: un solo toggle, sin sub-capa «ofertas» en v1.
- SAR: capa prioritaria, activa por defecto, primera en sección Daños.
- Buscador: panel lateral con icono, no panel inferior como `/busquedas`.

---

## 12. Pendientes opcionales (no bloquean)

- [ ] Estilo alto contraste para capa «Se busca» (anillo blanco sobre fondo rojo 3D).
- [ ] Sub-toggle «ofertas» para hub (paridad con `/busquedas`).
- [ ] Cargar Los Mangos animal con coords OSM (`10.2475501, -67.6065831`).
- [ ] IRDA: descartar o usar con cautela (solapamiento 110 m con Comando ConVzla).
- [ ] Poblar datos REDH si la fuente vuelve a estar disponible.

---

## 13. Archivos clave

| Archivo | Rol |
|---------|-----|
| `src/app/mapa-3d/Mapa3DView.tsx` | Vista 3D, capas, buscador, panel |
| `src/app/api/personas/route.ts` | API unificada personas/reportes |
| `src/app/busquedas/PersonasMap.tsx` | Referencia 2D (SAR `updateSar`, clustering Leaflet) |
| `src/app/busquedas/PersonasClient.tsx` | Referencia UI capas y buscador 2D |
| `public/danos-catia-la-mar.json` | Dataset edificios IA Microsoft |
| `docs/CARGA-VENEZUELARED.md` | Handoff carga manual VenezuelaRed |
| `docs/FUENTES.md` | Catálogo de fuentes de datos |
| `src/lib/news.ts` | Generación boletín noticias |

---

## 14. Helpers principales en `Mapa3DView.tsx`

```ts
parsePersonasRows(body)      // body.data ?? body.items ?? []
loadPersonasCache()          // fetch /api/personas con caché 60s
syncOverlayOrder(map)        // orden z-index de overlays
groupPersonasFeatures(items) // agrupa por coord exacta para popups multi-persona
addClusterSource(map, id, fc, color)
bindClusterInteractions(map, id)
flyToPersona(p)              // buscador → vuela + marcador + popup
```

---

## 15. Adiciones de la sesión #14 (2026-07-02)

**Control de zoom/brújula reposicionado:** `NavigationControl` movido de `top-right` a
`bottom-left` — chocaba con el panel «Capas del mapa».

**4 modos de vista nuevos** (íconos debajo del botón de lupa, esquina superior izquierda):

| Ícono | Estado | Qué hace | Notas técnicas |
|-------|--------|----------|-----------------|
| `Box` | `flatView` | Toggle `pitch` 0↔60 vía `map.easeTo()` | Activo (3D) por defecto |
| `Mountain` | `showTerrain` | Relieve real del terreno | DEM público AWS/Mapzen "terrarium" (`elevation-tiles-prod`), sin API key, `map.setTerrain({source, exaggeration: 1.5})` |
| `Flame` | `showHeatmap` | Densidad de reportes | `type: 'heatmap'`, reusa `loadPersonasCache()` |
| `Sun` | `showSky` | Cielo + iluminación | `map.setSky({...})` + `map.setLight({...})` — **ojo:** en esta versión de MapLibre (`5.24`) `sky` NO es un layer de `addLayer({type:'sky'})` (eso rompe el tipo), es una propiedad de estilo separada vía `setSky`/`getSky` con paint keys distintas (`sky-color`, `horizon-color`, `fog-color`, `fog-ground-blend`, no `sky-type`/`sky-atmosphere-sun` del spec viejo de Mapbox) |

**Verificación:** cada ícono probado por separado sin errores de consola. Activar terreno +
heatmap + cielo **a la vez** con los 9.128 edificios extruidos en pantalla satura el
renderizado por software (swiftshader) del entorno de pruebas headless — no se pudo
confirmar si afecta hardware real, pero cada modo individual funciona bien (uso esperado).

**Fix de búsqueda con acentos:** `matchesPersonaSearch()` no normalizaba diacríticos
("María" vs "Maria" daban resultados distintos). Ahora usa `normalizeSearchText()` de
`src/lib/text.ts` (compartido con `/busquedas`). Ver también sesión #14 en
la bitácora operativa del autor (no publicada).

---

*Fin del reporte.*
