# Ingesta multicanal (Frente A)

Cola de entrada unificada para WhatsApp (API Oficial o cliente alternativo Baileys) y Telegram: normaliza mensajes, reenvía **foto / video / documento / notas de voz** a la API de bandeja del equipo de mapas y envía autorespuesta genérica sin marca.

## Flujo

```
Usuario ──► Webhook/Socket ──► inbound_messages (Postgres)
                                     │
                           ┌─────────┴──────────┐
                           │                    │
                     routed_bot            received
                  (texto/ubicación)    (photo/video/doc/audio)
                           │                    │
                     Bot de búsqueda      ingest-worker
                     (menú/refugios)           │
                                          ┌────┴────┐
                                          │         │
                                     INBOX_API   Auto-reply
                                     (bandeja)   (A4)
```

## Variables de entorno

```env
# Autorespuesta (A4) — texto genérico, sin marca
INBOUND_AUTO_REPLY=true
INBOUND_AUTO_REPLY_TEXT=Recibimos tu mensaje. Referencia: {ref}. Lo revisaremos pronto.

# API de bandeja del equipo de mapas
INBOX_API_URL=https://hub.ejemplo.org/api/inbound/messages
INBOX_API_KEY=secreto-compartido
INBOX_API_KEY_HEADER=X-Inbox-Key

# Si true, falla el job si el forward HTTP no responde 2xx
INBOX_FORWARD_REQUIRED=false

# Si true, envía multipart (JSON payload + archivos binarios)
INBOX_FORWARD_MULTIPART=false
```

## Contrato hacia la bandeja (`POST INBOX_API_URL`)

### Modo JSON (default)

Header de autenticación: el configurado en `INBOX_API_KEY_HEADER` (default `X-Inbox-Key`).

```json
{
  "ref": "A1B2C3",
  "channel": "whatsapp",
  "sender_id": "584121234567",
  "sender_name": null,
  "message_type": "photo",
  "text": "Caption opcional",
  "received_at": "2026-07-05T17:30:00.000Z",
  "location": null,
  "attachments": [
    {
      "type": "photo",
      "mime": "image/jpeg",
      "file_name": null,
      "caption": "Caption opcional",
      "download_url": "https://..."
    }
  ]
}
```

`download_url` es una URL temporal resuelta vía Kapso/Meta o Telegram (`getFile`). La bandeja puede descargar el binario desde ahí.

### Modo multipart (`INBOX_FORWARD_MULTIPART=true`)

| Campo | Contenido |
|-------|-----------|
| `payload` | String JSON con el mismo esquema de arriba |
| `files` | Uno o más archivos binarios (mismo orden que attachments con URL) |

## Tipos soportados en v1

| Canal | Tipos ingesta + forward |
|-------|-------------------------|
| WhatsApp | `image` → photo, `video`, `document`, `audio` / `voice` → document |
| Telegram | `photo`, `video`, `document`, `voice` / `audio` → document |

Texto, ubicación y botones siguen yendo al **bot de búsqueda** existente. Se registran en `inbound_messages` con estado `routed_bot` (auditoría A3) pero **no** reciben autorespuesta de ingesta ni forward.

## Estados (`inbound_messages.status`)

| Estado | Significado |
|--------|-------------|
| `received` | Medio en cola, pendiente de worker |
| `processing` | Worker trabajando |
| `processed` | Forward + ack completados (o forward omitido si no hay URL) |
| `failed` | Error en worker |
| `routed_bot` | Texto/ubicación/botones → bot conversacional |
| `logged` | Otros tipos, solo auditoría |

## Admin

```http
GET /admin/inbound?status=received&limit=50
GET /admin/inbound/:id
```

Header: `X-Admin-Key`.

## Migración

```bash
npm run db:migrate
```

Aplica `migrations/002_inbound.sql`.

## Worker

El proceso `npm run worker` ejecuta en paralelo:

1. Cola de **campañas salientes** (broadcasts)
2. Cola de **ingesta** (medios entrantes)

Sin worker, los medios quedan en `received` y no hay autorespuesta ni forward.

## Prueba local

1. Configura `INBOX_API_URL` apuntando a un webhook de prueba (webhook.site, mock server).
2. Envía una foto al bot de Telegram o WhatsApp.
3. Verifica `GET /admin/inbound` → `status: processed`, `ack_ref` en la respuesta al usuario.

## Compatibilidad futura (Frente B)

La tabla guarda `text_body`, `message_type` y `raw_payload` para enchufar NLU después. El worker puede ampliarse para clasificar intents antes del forward.
