# Ejemplos de consumo de la API

Clientes mínimos para la API `/v1` (curl, Node, Python, Leaflet y un webhook de WhatsApp).

La API **ya no está alojada públicamente** (`api.acopiove.org` se dio de baja). Levanta tu
propia instancia (`npm run dev` en la raíz → `http://localhost:4100/v1`) o usa el snapshot
estático de [`../data`](../data). Todos los ejemplos apuntan a `http://localhost:4100/v1`;
cambia la URL si tu instancia está en otro sitio.

| Archivo | Qué muestra |
|---|---|
| `curl_examples.sh` | Consultas básicas con filtros |
| `nodejs_example.js` | Búsqueda por cercanía (Node ≥ 18) |
| `python_example.py` | Lo mismo en Python |
| `leaflet_example.html` | Mapa Leaflet con el GeoJSON de `/v1/puntos` |
| `whatsapp_webhook.js` | Webhook que responde con centros cercanos |

Referencia completa: [`apps/web/src/app/v1/openapi.json`](../apps/web/src/app/v1/) y [`docs/fuentes-datos-api.md`](../docs/fuentes-datos-api.md).
