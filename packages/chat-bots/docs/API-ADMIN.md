# API Admin — campañas y contactos

Todas las rutas bajo `/admin` requieren autenticación:

```http
X-Admin-Key: tu-clave-secreta
```

Alternativa: `Authorization: Bearer tu-clave-secreta`.

Base URL de ejemplo: `https://hooks.tu-dominio.org`.

## Listas de contactos

### `GET /admin/contact-lists`

Lista todas las listas.

```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Voluntarios Caracas",
      "description": null,
      "created_at": "2026-07-05T12:00:00.000Z"
    }
  ]
}
```

### `POST /admin/contact-lists`

```json
{
  "name": "Voluntarios Caracas",
  "description": "Coordinadores zona este"
}
```

### `GET /admin/contact-lists/:id/contacts`

Contactos de una lista.

### `POST /admin/contact-lists/:id/contacts`

```json
{
  "phone": "584121234567",
  "name": "María",
  "email": "maria@ejemplo.org"
}
```

`phone` en formato internacional (solo dígitos). El worker normaliza con `DEFAULT_PHONE_COUNTRY` (58 por defecto).

## Plantillas WhatsApp

### `GET /admin/templates`

Proxy a Kapso: plantillas aprobadas del WABA configurado.

```json
{
  "data": [
    {
      "name": "alerta_emergencia",
      "language": "es",
      "status": "APPROVED"
    }
  ]
}
```

## Campañas (broadcasts)

### `GET /admin/broadcasts`

Últimas 50 campañas con contadores.

### `GET /admin/broadcasts/:id`

Detalle + destinatarios.

### `POST /admin/broadcasts`

Encola una campaña. El worker la procesa en FIFO.

#### WhatsApp (plantilla)

```json
{
  "name": "Alerta sismo zona costera",
  "type": "whatsapp",
  "templateName": "alerta_emergencia",
  "templateLang": "es",
  "defaultVars": ["Equipo de Mapas", "Revisar refugios activos"],
  "listId": "uuid-de-lista"
}
```

O destinatarios inline:

```json
{
  "name": "Prueba",
  "type": "whatsapp",
  "templateName": "alerta_emergencia",
  "templateLang": "es",
  "defaultVars": ["Hola"],
  "recipients": [
    { "phone": "584121234567", "name": "Ana", "vars": ["Ana", "Mensaje personal"] }
  ]
}
```

- `vars` por destinatario sobrescribe `defaultVars` si no está vacío.
- Las variables se mapean a parámetros posicionales `{{1}}`, `{{2}}`, … del cuerpo de la plantilla Meta.

#### Email (opcional, Resend)

```json
{
  "name": "Boletín coordinadores",
  "type": "email",
  "subject": "Actualización de refugios",
  "body": "Hola {nombre},\n\nResumen del día…",
  "listId": "uuid"
}
```

Requiere `RESEND_API_KEY`, `RESEND_FROM_EMAIL`.

## Estados

### Campaña (`broadcasts.status`)

| Valor | Significado |
|-------|-------------|
| `queued` | En cola, worker no la ha tomado |
| `sending` | Worker activo |
| `done` | Todos los destinatarios procesados |

### Destinatario (`broadcast_recipients.status`)

| Valor | Significado |
|-------|-------------|
| `pending` | Pendiente de envío |
| `sending` | Reservado por worker |
| `sent` | Kapso aceptó el mensaje |
| `delivered` | Confirmación Meta |
| `read` | Usuario leyó |
| `failed` | Error de envío o entrega |

Los estados `delivered` / `read` / `failed` se actualizan vía webhook Kapso en `POST /webhooks/kapso`.

## Ingesta entrante (Frente A)

Ver [INGEST.md](../INGEST.md). Endpoints:

- `GET /admin/inbound?status=received&limit=50`
- `GET /admin/inbound/:id`

## Ejemplo curl completo

```bash
export BASE=https://hooks.tu-dominio.org
export KEY=tu-admin-key

# Crear lista
LIST=$(curl -s -X POST "$BASE/admin/contact-lists" \
  -H "X-Admin-Key: $KEY" -H "Content-Type: application/json" \
  -d '{"name":"Prueba"}' | jq -r '.data.id')

# Añadir contacto
curl -s -X POST "$BASE/admin/contact-lists/$LIST/contacts" \
  -H "X-Admin-Key: $KEY" -H "Content-Type: application/json" \
  -d '{"phone":"584121234567","name":"Test"}'

# Encolar campaña
curl -s -X POST "$BASE/admin/broadcasts" \
  -H "X-Admin-Key: $KEY" -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Prueba plantilla\",
    \"type\": \"whatsapp\",
    \"templateName\": \"hello_world\",
    \"templateLang\": \"es\",
    \"defaultVars\": [\"Equipo\"],
    \"listId\": \"$LIST\"
  }"
```

## Errores comunes

| HTTP | Causa |
|------|-------|
| 401 | `X-Admin-Key` incorrecto |
| 400 | Falta `templateName` en campaña WhatsApp |
| 400 | Lista vacía o sin `recipients` |
| 503 | `ADMIN_API_KEY` no configurado en el servidor |
