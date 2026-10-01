# Telegram

Bot paralelo al de WhatsApp con la misma lógica de datos, sin ventanas de 24 h ni plantillas.

## Variables

```env
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=
WEBHOOK_PUBLIC_URL=https://hooks.tu-dominio.org
```

Crea el bot con [@BotFather](https://t.me/BotFather) y copia el token.

## Registrar webhook

Con el servidor accesible por HTTPS:

```bash
WEBHOOK_PUBLIC_URL=https://hooks.tu-dominio.org npm run telegram:set-webhook
```

Equivalente manual:

```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://hooks.tu-dominio.org/webhooks/telegram",
    "secret_token": "tu-TELEGRAM_WEBHOOK_SECRET",
    "allowed_updates": ["message", "callback_query"]
  }'
```

## Endpoint

```http
POST /webhooks/telegram
X-Telegram-Bot-Api-Secret-Token: <TELEGRAM_WEBHOOK_SECRET>
Content-Type: application/json
```

Si `TELEGRAM_WEBHOOK_SECRET` está vacío (solo dev), no se exige el header.

## Formato de mensajes

Telegram usa **HTML** (`parse_mode: HTML`):

- `<b>negrita</b>`, `<i>cursiva</i>`
- Texto dinámico escapado con `escapeHtml`

Enlaces a Google Maps en respuestas de ubicación.

## Teclados

- **Inline** (botones bajo el mensaje): menú Refugio / Acopio / Buscar familiar.
- **Reply** (teclado persistente): botón «Compartir ubicación» al pedir ciudad/ubicación.

`callback_data` limitado a **64 bytes**; búsquedas largas usan prefijo `bf_`.

## Comandos de usuario

| Entrada | Acción |
|---------|--------|
| `/start`, `/menu`, `menu` | Menú principal |
| `/telefonos`, `telefonos` | Teléfonos de emergencia |
| Pin de ubicación | Refugios/acopios cercanos |
| Texto (ciudad) | Búsqueda por ciudad según tipo activo |
| Nombre / cédula | Búsqueda de personas (si habilitada) |

## Sesiones

Tabla `telegram_sessions`:

- `chat_id` — PK
- `tipo` — `refugio`, `acopio`, `buscar_familiar` o null
- `last_update_id` — deduplicación de updates

Separada de `wa_sessions` para no mezclar canales.

## Diferencias vs WhatsApp

| | WhatsApp | Telegram |
|---|----------|----------|
| Marca en bienvenida | Opcional (`BOT_BRANDED_WELCOME`) | Genérica |
| Ubicación | Botón nativo Meta | Teclado `request_location` |
| Campañas salientes | Plantillas Kapso | No incluido (solo WA/email) |
| Webhook auth | HMAC SHA-256 | Secret token exacto |

## Polling (desarrollo local)

Este paquete usa **webhook**, no long polling. Para probar en local:

- [ngrok](https://ngrok.com) o similar → expone `localhost:3000`
- Configura `WEBHOOK_PUBLIC_URL` con la URL ngrok
- Ejecuta `npm run telegram:set-webhook`

## Troubleshooting

| Síntoma | Acción |
|---------|--------|
| 403 | `TELEGRAM_WEBHOOK_SECRET` no coincide |
| Bot no recibe updates | `getWebhookInfo` en API Telegram |
| Botón no responde | Verificar `callback_query` en `allowed_updates` |
| HTML roto | Caracteres `<` sin escapar en datos dinámicos |

```bash
curl -s "https://api.telegram.org/bot<TOKEN>/getWebhookInfo" | jq
```
