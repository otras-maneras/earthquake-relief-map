# Contrato DATA API

`chat-bots` no consulta Postgres de puntos directamente. Toda la información geográfica y de personas llega por HTTP desde `DATA_API_BASE_URL`.

Ejemplo con el wrapper público de AcopioVE:

```env
DATA_API_BASE_URL=http://localhost:4100/v1
PERSONAS_SEARCH_PATH=/personas
BOT_SITE_URL=https://tu-mapa.org
```

Tu equipo de mapas puede implementar el mismo contrato en cualquier stack.

## Base URL

```
{DATA_API_BASE_URL}/…
```

Sin barra final en la variable de entorno. Timeout del cliente: **15 s**.

## Puntos / refugios / acopios

### Búsqueda por proximidad

```http
GET /puntos?tipo=refugio&near=-10.48,-66.90&radius=15&limit=3
GET /puntos?tipo=acopio&near=-10.48,-66.90&radius=15&limit=3
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `tipo` | string | `refugio`, `acopio` o `telefono` |
| `near` | string | `lat,lng` (decimal) |
| `radius` | number | Radio en km (default bot: 15) |
| `limit` | number | Máximo de resultados |

### Búsqueda por ciudad

```http
GET /puntos?tipo=refugio&ciudad=Caracas&limit=5
GET /puntos?tipo=acopio&ciudad=La Guaira&limit=5
```

Comparación case-insensitive recomendada en el servidor.

### Teléfonos de emergencia

```http
GET /puntos?tipo=telefono&limit=6
```

## Formato de respuesta (puntos)

El cliente acepta cualquiera de estas envolturas:

```json
[{ "id": "…", "nombre": "…", … }]
```

```json
{ "data": [{ … }] }
```

```json
{ "puntos": [{ … }] }
```

### Campos por ítem

| Campo API | Uso en el bot | Notas |
|-----------|---------------|-------|
| `id` | Identificador | Opcional |
| `nombre` | Título mostrado | **Requerido** |
| `descripcion` | Dirección / notas | Opcional |
| `ciudad` | Ciudad | Opcional |
| `telefono` | Contacto | Opcional |
| `estado` | `abierto`, `lleno`, `cerrado` | Default: `abierto` |
| `tipo` | `refugio`, `acopio`, `telefono` | |
| `lat` / `latitude` | Coordenada | **Requerido** (junto con lng) |
| `lng` / `longitude` | Coordenada | |
| `distance_km` / `distanceKm` | Distancia | Opcional; si falta, se calcula haversine |

### Ejemplo

```json
{
  "data": [
    {
      "id": "abc-123",
      "nombre": "Refugio Parroquial",
      "descripcion": "Av. Principal, local 2",
      "ciudad": "La Guaira",
      "telefono": "0412-0000000",
      "estado": "abierto",
      "tipo": "refugio",
      "lat": 10.601,
      "lng": -66.934,
      "distanceKm": 2.3
    }
  ]
}
```

## Personas (opcional, PII)

Si no quieres búsqueda de familiares, deja vacío:

```env
PERSONAS_SEARCH_PATH=
```

### Búsqueda

```http
GET /personas?q=maria+gonzalez&limit=5
```

La ruta es configurable (`PERSONAS_SEARCH_PATH`, default `/personas`).

### Respuesta

Array directo o `{ "data": [ … ] }`.

| Campo API | Campo interno | Descripción |
|-----------|---------------|-------------|
| `nombre` | `nombre` | |
| `estado` / `status` | `status` | p. ej. localizado, desaparecido |
| `ubicacion_general` / `lugar` | `lugar` | |
| `cedula` | `cedula` | Opcional |
| `observaciones` | `observaciones` | Opcional |
| `fuente` | `fuente` | URL o nombre de fuente |
| `tipo` | `tipo` | p. ej. `localizado` |

### Ejemplo

```json
{
  "data": [
    {
      "nombre": "Juan Pérez",
      "estado": "localizado",
      "ubicacion_general": "Hospital Central",
      "cedula": "V-12345678",
      "fuente": "https://…",
      "tipo": "localizado"
    }
  ]
}
```

## Recomendaciones de implementación

1. **Cache** corto (30–60 s) en el servidor de datos para picos de tráfico durante emergencias.
2. **Rate limiting** en `/personas` (más sensible que `/puntos`).
3. **CORS** no aplica (solo server-to-server).
4. Devuelve **JSON** con `Content-Type: application/json`.
5. Errores HTTP ≥ 400: el bot responde al usuario con mensaje genérico y registra el error en logs.

## Compatibilidad AcopioVE

El wrapper en `acopiove-api` expone `/v1/puntos` y `/v1/personas` con este contrato. Otros despliegues del monorepo `centros-acopio` pueden apuntar el bot a la misma API pública sin compartir base de datos.

## Prueba manual

```bash
export API=http://localhost:4100/v1

curl -s "$API/puntos?tipo=refugio&ciudad=Caracas&limit=2" | jq
curl -s "$API/puntos?tipo=telefono&limit=3" | jq
curl -s "$API/personas?q=test&limit=1" | jq
```
