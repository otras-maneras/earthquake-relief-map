# Chat Bots - Canales de comunicación y automatización

Paquete standalone para desplegar bots de emergencia humanitaria sin acoplamiento rígido. Incluye:

- **Bandeja y bots de WhatsApp**: Soporte tanto para la API oficial (vía Kapso / Meta Cloud API) como alternativa local mediante cliente web (Baileys).
- **Bot entrante Telegram**: Misma lógica conversacional adaptada al protocolo de Telegram.
- **Campañas salientes**: Soporte básico para retransmisión de comunicados (difusiones) y alertas de emergencia vía plantillas de WhatsApp o correo electrónico (Resend).

Los datos de centros y puntos se obtienen de forma dinámica mediante peticiones HTTP contra una API externa (DATA_API_BASE_URL), manteniendo el bot agnóstico del almacenamiento.

---

## Indice de Documentacion

Para facilitar la lectura en un solo lugar, este documento consolida todas las guías del paquete. Las secciones individuales también se encuentran en archivos independientes en la carpeta docs/.

1. [Despliegue y Arquitectura](#1-despliegue-y-arquitectura) (docs/DEPLOY.md)
2. [Ingesta Multicanal - Frente A](#2-ingesta-multicanal---frente-a) (docs/INGEST.md)
3. [WhatsApp Oficial - Kapso](#3-whatsapp-oficial---kapso) (docs/WHATSAPP.md)
4. [WhatsApp Alternativo - Baileys y Antispam](#4-whatsapp-alternativo---baileys-y-antispam) (docs/BAILEYS.md)
5. [Telegram](#5-telegram) (docs/TELEGRAM.md)
6. [API Admin - Campañas y Contactos](#6-api-admin---campanas-y-contactos) (docs/API-ADMIN.md)
7. [Contrato DATA API](#7-contrato-data-api) (docs/DATA-API.md)
8. [Integracion de Concepto Legacy](#8-integracion-de-concepto-legacy) (docs/chatbot-whatsapp.md)

---

## Requisitos Generales

- Node.js >= 18
- PostgreSQL 14+
- Acceso a proveedor de mensajería (Kapso, Telegram o sesión local de WhatsApp para Baileys)
- API pública de puntos/refugios compatible con el contrato de datos

---

## Inicio rapido

```bash
cd chat-bots
cp .env.example .env
# Editar .env con credenciales y DATA_API_BASE_URL

npm install
npm run db:migrate
npm run dev          # Servidor HTTP (webhooks + admin) e inicialización de sockets
npm run worker       # Cola de tareas/mensajes en segundo plano
```

Con Docker:

```bash
cp .env.example .env
docker compose up -d --build
docker compose exec app npm run db:migrate
```

---

## 1. Despliegue y Arquitectura

Guía para poner chat-bots en producción detrás de un dominio público accesible por Kapso y Telegram.

### 1.1 Infraestructura minima

| Componente | Rol |
|------------|-----|
| app | Express en :3000 — webhooks + admin |
| worker | Proceso separado que envía campañas |
| PostgreSQL | Sesiones, listas, cola de broadcasts |

En Docker Compose los tres servicios vienen definidos. En PaaS (Railway, Fly, Render) despliega dos procesos (web + worker) con la misma imagen y DATABASE_URL compartida.

### 1.2 Base de datos

```bash
npm run db:migrate
```

Aplica migrations/*.sql en orden. Idempotente: registra migraciones en schema_migrations.

### 1.3 URL publica de webhooks

Kapso y Telegram deben poder hacer POST HTTPS a tu servidor. Recomendaciones:

- Usa un subdominio dedicado, p. ej. https://hooks.tu-dominio.org.
- Si usas Cloudflare, pon el subdominio en DNS only (gris) para webhooks de datacenter; el proxy naranja puede bloquear IPs de Meta/Telegram.
- Configura WEBHOOK_PUBLIC_URL=https://hooks.tu-dominio.org para el script de Telegram.

#### WhatsApp (Kapso)

1. En Kapso, registra el webhook: https://hooks.tu-dominio.org/webhooks/kapso
2. Suscríbete al campo messages (mensajes entrantes).
3. Define KAPSO_WEBHOOK_SECRET y configúralo también en Kapso.
4. Verificación Meta (GET): el endpoint responde hub.challenge si hub.verify_token coincide con el secret.

#### Telegram

```bash
WEBHOOK_PUBLIC_URL=https://hooks.tu-dominio.org npm run telegram:set-webhook
```

Registra https://hooks.tu-dominio.org/webhooks/telegram con secret_token = TELEGRAM_WEBHOOK_SECRET.

### 1.4 Procesos en produccion

```bash
# Servidor
NODE_ENV=production npm start

# Worker (obligatorio para campañas)
NODE_ENV=production npm run worker
```

Supervisa ambos con systemd, PM2, o el scheduler del PaaS.

### 1.5 Health check

```bash
curl -s https://hooks.tu-dominio.org/health | jq
```

Respuesta esperada:

```json
{
  "ok": true,
  "service": "chat-bots",
  "whatsapp": true,
  "telegram": true
}
```

### 1.6 Seguridad

- ADMIN_API_KEY: obligatorio en producción. Header X-Admin-Key en todas las rutas /admin/*.
- KAPSO_WEBHOOK_SECRET: HMAC SHA-256 en header X-Webhook-Signature. Fail-closed si está configurado.
- TELEGRAM_WEBHOOK_SECRET: comparación exacta con X-Telegram-Bot-Api-Secret-Token.
- No expongas /admin sin TLS ni sin API key.
- La búsqueda de personas debe ir contra un endpoint PII-seguro (rate limit, sin datos sensibles innecesarios).

### 1.7 Escalado

- app: stateless; escala horizontalmente detrás de un load balancer.
- worker: un solo worker activo evita duplicar envíos; si necesitas más throughput, particiona campañas o usa un lock distribuido (no incluido en v1).
- Postgres: conexiones pooled vía pg.Pool.

### 1.8 Observabilidad

Logs en stdout:

- [chat-bots] listening on :3000
- [worker] broadcast worker started
- [wa-bot] error ... / [telegram-bot] error ...

Monitorea:

- Ratio sent_count / fail_count en broadcasts
- Respuestas 403 en webhooks (firma incorrecta)
- Latencia de DATA_API_BASE_URL

---

## 2. Ingesta Multicanal - Frente A

Cola de entrada unificada para WhatsApp (API Oficial o cliente alternativo Baileys) y Telegram: normaliza mensajes, reenvía foto / video / documento / notas de voz a la API de bandeja del equipo de mapas y envía autorespuesta genérica sin marca.

### 2.1 Flujo

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

### 2.2 Variables de entorno

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

### 2.3 Contrato hacia la bandeja (POST INBOX_API_URL)

#### Modo JSON (default)

Header de autenticación: el configurado en INBOX_API_KEY_HEADER (default X-Inbox-Key).

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

download_url es una URL temporal resuelta vía Kapso/Meta o Telegram (getFile). La bandeja puede descargar el binario desde ahí.

#### Modo multipart (INBOX_FORWARD_MULTIPART=true)

| Campo | Contenido |
|-------|-----------|
| payload | String JSON con el mismo esquema de arriba |
| files | Uno o más archivos binarios (mismo orden que attachments con URL) |

### 2.4 Tipos soportados en v1

| Canal | Tipos ingesta + forward |
|-------|-------------------------|
| WhatsApp | image -> photo, video, document, audio / voice -> document |
| Telegram | photo, video, document, voice / audio -> document |

Texto, ubicación y botones siguen yendo al bot de búsqueda existente. Se registran en inbound_messages con estado routed_bot (auditoría A3) pero no reciben autorespuesta de ingesta ni forward.

### 2.5 Estados (inbound_messages.status)

| Estado | Significado |
|--------|-------------|
| received | Medio en cola, pendiente de worker |
| processing | Worker trabajando |
| processed | Forward + ack completados (o forward omitido si no hay URL) |
| failed | Error en worker |
| routed_bot | Texto/ubicación/botones -> bot conversacional |
| logged | Otros tipos, solo auditoría |

### 2.6 Admin

```http
GET /admin/inbound?status=received&limit=50
GET /admin/inbound/:id
```

Header: X-Admin-Key.

---

## 3. WhatsApp Oficial - Kapso

Integración con Kapso sobre la WhatsApp Cloud API de Meta.

### 3.1 Variables

```env
KAPSO_API_KEY=
KAPSO_PHONE_NUMBER_ID=
KAPSO_WABA_ID=
KAPSO_WEBHOOK_SECRET=
DEFAULT_PHONE_COUNTRY=58
```

Obtén las credenciales en el panel Kapso tras conectar un número de WhatsApp Business.

### 3.2 Webhook

| | |
|---|---|
| URL | https://tu-dominio/webhooks/kapso |
| GET | Verificación Meta (hub.mode=subscribe) |
| POST | Mensajes entrantes + estados de entrega |

#### Firma

Si KAPSO_WEBHOOK_SECRET está definido, cada POST debe incluir:

```http
X-Webhook-Signature: sha256=<hex>
```

HMAC-SHA256 del cuerpo raw con el secret. Sin firma válida -> 403. También se acepta X-Hub-Signature-256 (formato Meta).

#### Formatos de payload soportados

1. Meta estándar: entry[].changes[].value.messages[]
2. Kapso v2: data.message (mensaje suelto)

Estados de entrega: entry[].changes[].value.statuses[] o data.status.

### 3.3 Bot entrante (sesión 24 h)

Cuando un usuario escribe primero, el bot responde con:
- Texto libre (sendText)
- Botones de respuesta rápida (sendButtons, máx. 3)
- Solicitud de ubicación nativa (sendLocationRequest)

No requiere plantillas aprobadas porque opera dentro de la ventana de conversación.

#### Menú principal

Botones:
- tipo_refugio -> flujo refugios
- tipo_acopio -> flujo acopios
- buscar_familiar -> búsqueda de personas (si PERSONAS_SEARCH_PATH está configurado)

Comandos de texto: menu, telefonos, etc.

### 3.4 Campañas salientes (plantillas)

Fuera de la ventana de 24 h, Meta exige plantillas pre-aprobadas.

1. Crea la plantilla en Kapso / Meta Business Manager.
2. Espera estado APPROVED.
3. Lista plantillas: GET /admin/templates.
4. Encola campaña: POST /admin/broadcasts con templateName y defaultVars.

El worker envía vía:

```
POST https://api.kapso.ai/meta/whatsapp/v24.0/{phone_number_id}/messages
X-API-Key: ...
```

---

## 4. WhatsApp Alternativo - Baileys y Antispam

Para despliegues comunitarios o donde no se cuente con acceso a la API oficial de WhatsApp Cloud (Meta/Kapso), se provee integración nativa con Baileys, una librería en Node.js que levanta una sesión de WhatsApp Web mediante la simulación de lectura de código QR.

### 4.1 Variables de Entorno

```env
WHATSAPP_CONTACT_NUMBER=584121234567
BROADCAST_BATCH_LIMIT=30
BROADCAST_BATCH_REST_MS=90000
```

### 4.2 Cómo Iniciar el Bot con Baileys

1. Crea un script de arranque o agrega una función de inicialización en el punto de entrada principal src/index.ts:

```typescript
import { initBaileysSocket } from './channels/baileys.js';

// Inicializar el socket de WhatsApp Web (Baileys)
const sock = await initBaileysSocket();
```

2. Ejecuta el servidor:
```bash
npm run dev
```

3. Autenticación (QR Code):
   - En la primera ejecución, se imprimirá un código QR en la consola de la terminal.
   - Escanéalo usando la aplicación de WhatsApp en tu teléfono móvil en Dispositivos Vinculados.
   - Los datos de sesión se guardarán localmente en la carpeta auth_info_baileys/. Nunca subas esta carpeta al control de versiones.

### 4.3 Persistencia de Sesión y Docker/VPS

La autenticación actual utiliza useMultiFileAuthState('auth_info_baileys') la cual crea archivos locales JSON.
- En VPS/Ubuntu: Los archivos locales persistirán sin problemas en la carpeta siempre que no borres el directorio.
- En Docker: Asegúrate de montar un volumen persistente para la carpeta /app/chat-bots/auth_info_baileys en tu docker-compose.yml para evitar perder la sesión tras recrear el contenedor:

```yaml
services:
  bots:
    build: .
    volumes:
      - ./auth_info_baileys:/app/chat-bots/auth_info_baileys
```

### 4.4 Mecanismos Antispam / Anti-ban en Baileys

El worker de campañas incluye salvaguardas avanzadas cuando se utiliza Baileys para prevenir el baneo del número de WhatsApp por los algoritmos de detección de Meta:

1. **Simulación de Escritura (Typing State):** Antes de enviar cada mensaje, el bot envía un evento de presencia composing durante un lapso aleatorio de 1 a 2 segundos, y luego lo apaga antes de despachar el texto. Esto simula el comportamiento de un cliente humano real.
2. **Retardo Aleatorio (Jitter):** En lugar de enviar a intervalos fijos, introduce un retardo aleatorio de 3 a 6 segundos tras cada mensaje despachado.
3. **Pausas de Lote Configurables:** El worker procesa los mensajes en lotes. Por defecto, al alcanzar 30 mensajes consecutivos (BROADCAST_BATCH_LIMIT), el proceso se detiene y descansa 90 segundos (BROADCAST_BATCH_REST_MS) antes de continuar.

---

## 5. Telegram

Bot paralelo al de WhatsApp con la misma lógica de datos, sin ventanas de 24 h ni plantillas.

### 5.1 Variables

```env
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=
WEBHOOK_PUBLIC_URL=https://hooks.tu-dominio.org
```

Crea el bot con @BotFather y copia el token.

### 5.2 Registrar webhook

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

### 5.3 Endpoint

```http
POST /webhooks/telegram
X-Telegram-Bot-Api-Secret-Token: <TELEGRAM_WEBHOOK_SECRET>
Content-Type: application/json
```

Si TELEGRAM_WEBHOOK_SECRET está vacío (solo dev), no se exige el header.

### 5.4 Formato de mensajes

Telegram usa HTML (parse_mode: HTML):
- <b>negrita</b>, <i>cursiva</i>
- Texto dinámico escapado con escapeHtml

Enlaces a Google Maps en respuestas de ubicación.

### 5.5 Teclados

- Inline (botones bajo el mensaje): menú Refugio / Acopio / Buscar familiar.
- Reply (teclado persistente): botón Compartir ubicación al pedir ciudad/ubicación.

callback_data limitado a 64 bytes; búsquedas largas usan prefijo bf_.

### 5.6 Comandos de usuario

| Entrada | Acción |
|---------|--------|
| /start, /menu, menu | Menú principal |
| /telefonos, telefonos | Teléfonos de emergencia |
| Pin de ubicación | Refugios/acopios cercanos |
| Texto (ciudad) | Búsqueda por ciudad según tipo activo |
| Nombre / cédula | Búsqueda de personas (si habilitada) |

### 5.7 Sesiones

Tabla telegram_sessions:
- chat_id — PK
- tipo — refugio, acopio, buscar_familiar o null
- last_update_id — deduplicación de updates

Separada de wa_sessions para no mezclar canales.

---

## 6. API Admin - Campañas y Contactos

Todas las rutas bajo /admin requieren autenticación:

```http
X-Admin-Key: tu-clave-secreta
```

Alternativa: Authorization: Bearer tu-clave-secreta.

### 6.1 Listas de contactos

#### GET /admin/contact-lists

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

#### POST /admin/contact-lists

```json
{
  "name": "Voluntarios Caracas",
  "description": "Coordinadores zona este"
}
```

#### GET /admin/contact-lists/:id/contacts

Contactos de una lista.

#### POST /admin/contact-lists/:id/contacts

```json
{
  "phone": "584121234567",
  "name": "María",
  "email": "maria@ejemplo.org"
}
```

### 6.2 Plantillas WhatsApp

#### GET /admin/templates

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

### 6.3 Campañas (broadcasts)

#### GET /admin/broadcasts

Últimas 50 campañas con contadores.

#### GET /admin/broadcasts/:id

Detalle + destinatarios.

#### POST /admin/broadcasts

Encola una campaña. El worker la procesa en FIFO.

##### WhatsApp (plantilla)

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

##### Email (opcional, Resend)

```json
{
  "name": "Boletín coordinadores",
  "type": "email",
  "subject": "Actualización de refugios",
  "body": "Hola {nombre},\n\nResumen del día...",
  "listId": "uuid"
}
```

### 6.4 Estados

#### Campaña (broadcasts.status)

| Valor | Significado |
|-------|-------------|
| queued | En cola, worker no la ha tomado |
| sending | Worker activo |
| done | Todos los destinatarios procesados |

#### Destinatario (broadcast_recipients.status)

| Valor | Significado |
|-------|-------------|
| pending | Pendiente de envío |
| sending | Reservado por worker |
| sent | Mensaje aceptado |
| delivered | Confirmación de entrega |
| read | Usuario leyó |
| failed | Error de envío o entrega |

---

## 7. Contrato DATA API

chat-bots no consulta Postgres de puntos directamente. Toda la información geográfica y de personas llega por HTTP desde DATA_API_BASE_URL.

### 7.1 Puntos / refugios / acopios

#### Búsqueda por proximidad

```http
GET /puntos?tipo=refugio&near=-10.48,-66.90&radius=15&limit=3
GET /puntos?tipo=acopio&near=-10.48,-66.90&radius=15&limit=3
```

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| tipo | string | refugio, acopio o telefono |
| near | string | lat,lng (decimal) |
| radius | number | Radio en km (default bot: 15) |
| limit | number | Máximo de resultados |

#### Búsqueda por ciudad

```http
GET /puntos?tipo=refugio&ciudad=Caracas&limit=5
GET /puntos?tipo=acopio&ciudad=La Guaira&limit=5
```

### 7.2 Formato de respuesta (puntos)

El cliente acepta cualquiera de estas envolturas:

```json
[{ "id": "...", "nombre": "...", ... }]
```

```json
{ "data": [{ ... }] }
```

```json
{ "puntos": [{ ... }] }
```

#### Campos por ítem

| Campo API | Uso en el bot | Notas |
|-----------|---------------|-------|
| id | Identificador | Opcional |
| nombre | Título mostrado | Requerido |
| descripcion | Dirección / notas | Opcional |
| ciudad | Ciudad | Opcional |
| telefono | Contacto | Opcional |
| estado | abierto, lleno, cerrado | Default: abierto |
| tipo | refugio, acopio, telefono | |
| lat / latitude | Coordenada | Requerido (junto con lng) |
| lng / longitude | Coordenada | |
| distance_km / distanceKm | Distancia | Opcional |

---

## 8. Integracion de Concepto Legacy

Guía conceptual de bajo nivel para integraciones a nivel de script webhook plano de WhatsApp.

### 8.1 Arquitectura del Flujo

El patrón de mensajería interactiva sigue un flujo de tres actores:

1. Usuario: Envía un mensaje (de texto, comando o comparte ubicación GPS) al número de WhatsApp.
2. Pasarela (Meta/Kapso): Recibe el mensaje y realiza una petición POST (evento de webhook) a tu servidor de aplicaciones.
3. Tu Webhook: Procesa el texto o las coordenadas, realiza una petición GET a la API de AcopioVE para buscar los datos correspondientes, construye un texto legible de respuesta y le indica a Kapso que lo envíe de vuelta al usuario.

### 8.2 Consumir la API de AcopioVE según la solicitud

Cuando tu servidor reciba el webhook, parsea el contenido y consulta el endpoint correspondiente de api.acopiove.org/v1/:

- **Refugios o Centros Cercanos:** Si el usuario comparte su ubicación de WhatsApp, extrae las coordenadas latitude y longitude y llama al endpoint unificado:
  ```http
  GET http://localhost:4100/v1/puntos?tipo=refugio&near=lat,lng&radius=15&limit=3
  ```
- **Líneas de Emergencia:** Si el usuario escribe palabras clave como "emergencia" o "telefono", consulta:
  ```http
  GET http://localhost:4100/v1/puntos?tipo=telefono&limit=5
  ```
- **Búsqueda de Familiares (Reunificación):** Si el usuario escribe "buscar Juan Pérez", consulta:
  ```http
  GET http://localhost:4100/v1/personas?q=Juan%20Perez
  ```

#
