# WhatsApp vía Kapso

Integración con [Kapso](https://kapso.ai) sobre la **WhatsApp Cloud API** de Meta.

## Variables

```env
KAPSO_API_KEY=
KAPSO_PHONE_NUMBER_ID=
KAPSO_WABA_ID=
KAPSO_WEBHOOK_SECRET=
DEFAULT_PHONE_COUNTRY=58
```

Obtén las credenciales en el panel Kapso tras conectar un número de WhatsApp Business.

## Webhook

| | |
|---|---|
| **URL** | `https://tu-dominio/webhooks/kapso` |
| **GET** | Verificación Meta (`hub.mode=subscribe`) |
| **POST** | Mensajes entrantes + estados de entrega |

### Firma

Si `KAPSO_WEBHOOK_SECRET` está definido, cada POST debe incluir:

```http
X-Webhook-Signature: sha256=<hex>
```

HMAC-SHA256 del cuerpo raw con el secret. Sin firma válida → **403**.

También se acepta `X-Hub-Signature-256` (formato Meta).

### Formatos de payload soportados

1. **Meta estándar**: `entry[].changes[].value.messages[]`
2. **Kapso v2**: `data.message` (mensaje suelto)

Estados de entrega: `entry[].changes[].value.statuses[]` o `data.status`.

## Bot entrante (sesión 24 h)

Cuando un usuario escribe primero, el bot responde con:

- Texto libre (`sendText`)
- Botones de respuesta rápida (`sendButtons`, máx. 3)
- Solicitud de ubicación nativa (`sendLocationRequest`)

No requiere plantillas aprobadas porque opera **dentro de la ventana de conversación**.

### Menú principal

Botones:

- `tipo_refugio` → flujo refugios
- `tipo_acopio` → flujo acopios
- `buscar_familiar` → búsqueda de personas (si `PERSONAS_SEARCH_PATH` está configurado)

Comando de texto: `menu`, `telefonos`, etc.

## Campañas salientes (plantillas)

Fuera de la ventana de 24 h, Meta exige **plantillas pre-aprobadas**.

1. Crea la plantilla en Kapso / Meta Business Manager.
2. Espera estado `APPROVED`.
3. Lista plantillas: `GET /admin/templates`.
4. Encola campaña: `POST /admin/broadcasts` con `templateName` y `defaultVars`.

El worker envía vía:

```
POST https://api.kapso.ai/meta/whatsapp/v24.0/{phone_number_id}/messages
X-API-Key: …
```

Throttle interno: ~350 ms entre mensajes.

## Normalización de teléfonos

`584121234567` — formato wa-id (solo dígitos, código país).

Heurística Venezuela (`DEFAULT_PHONE_COUNTRY=58`):

- `0412…` → `58412…`
- Números locales de 10 dígitos → antepone `58`

## Marca en mensajes

```env
BOT_NAME=Asistente de Emergencia
BOT_BRANDED_WELCOME=true   # incluye nombre en bienvenida WA
BOT_SITE_URL=https://tu-mapa.org
```

Telegram usa textos genéricos por defecto (sin marca).

## Migración desde el ejemplo `examples/whatsapp_webhook.js`

El ejemplo en la raíz del repo es un **webhook mínimo** sin sesiones ni campañas. Este paquete lo reemplaza con:

- Estado conversacional en Postgres
- Búsqueda HTTP de puntos
- Cola de campañas + worker
- API admin

Para producción usa `chat-bots/` en lugar del script de ejemplo.

## Troubleshooting

| Síntoma | Acción |
|---------|--------|
| 403 en webhook | Revisar secret y header de firma |
| Bot no responde | Verificar suscripción al campo `messages` en Kapso |
| Plantilla rechazada | Revisar categoría UTILITY vs MARKETING en Meta |
| `send failed HTTP 131026` | Usuario no tiene WhatsApp o número inválido |
| Duplicados | Idempotencia por `wa_sessions.last_msg_id` |
