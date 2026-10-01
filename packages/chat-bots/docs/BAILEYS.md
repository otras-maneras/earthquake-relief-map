# Integración con Baileys (WhatsApp Web alternativo)

Para despliegues comunitarios o donde no se cuente con acceso a la API oficial de WhatsApp Cloud (Meta/Kapso), se provee integración nativa con **Baileys**, una librería en Node.js que levanta una sesión de WhatsApp Web mediante la simulación de lectura de código QR.

---

## Requisitos de Dependencias

Las dependencias clave ya se encuentran declaradas en `package.json`:
- `@whiskeysockets/baileys`
- `pino` (logger requerido por Baileys)
- `qrcode-terminal` (para renderizar el código QR en consola)

Instálalas ejecutando:
```bash
npm install
```

---

## Configuracion y Variables de Entorno

Puedes coexistir con Kapso/Meta o configurar el bot para usar exclusivamente Baileys. Si usas Baileys, debes inicializar el socket y redireccionar las respuestas salientes.

Asegúrate de agregar la variable de contacto al archivo `.env` para el botón de WhatsApp en la plantilla de correo de campañas:
```env
# Número de teléfono del bot para el botón en los correos electrónicos
WHATSAPP_CONTACT_NUMBER=584121234567
```

---

## Como Iniciar el Bot con Baileys

1. Crea un script de arranque o agrega una función de inicialización en el punto de entrada principal `src/index.ts`:

```typescript
import { initBaileysSocket } from './channels/baileys.js';

// Inicializar el socket de WhatsApp Web (Baileys)
const sock = await initBaileysSocket();
```

2. Ejecuta el servidor en modo desarrollo:
```bash
npm run dev
```

3. **Autenticación (QR Code):**
   - En la primera ejecución, se imprimirá un código QR en la consola de la terminal.
   - Escanéalo usando la aplicación de WhatsApp en tu teléfono móvil en **Dispositivos Vinculados**.
   - Los datos de sesión se guardarán localmente en la carpeta `auth_info_baileys/`. **Nunca subas esta carpeta al control de versiones.**

---

## Persistencia de Sesion y Docker/VPS

La autenticación actual utiliza `useMultiFileAuthState('auth_info_baileys')` la cual crea archivos locales JSON.
- **En VPS/Ubuntu (Seguro):** Los archivos locales persistirán sin problemas en la carpeta siempre que no borres el directorio.
- **En Docker:** Asegúrate de montar un volumen persistente para la carpeta `/app/chat-bots/auth_info_baileys` en tu `docker-compose.yml` para evitar perder la sesión tras recrear el contenedor:

```yaml
services:
  bots:
    build: .
    volumes:
      - ./auth_info_baileys:/app/chat-bots/auth_info_baileys
```

---

## Mecanismos Antispam / Anti-ban en Baileys

El worker de campañas incluye salvaguardas avanzadas cuando se utiliza Baileys para prevenir el baneo del número de WhatsApp por los algoritmos de detección de Meta:

1. **Simulación de Escritura (Typing State):** Antes de enviar cada mensaje, el bot envía un evento de presencia `composing` durante un lapso aleatorio de 1 a 2 segundos, y luego lo apaga antes de despachar el texto. Esto simula el comportamiento de un cliente humano real.
2. **Retardo Aleatorio (Jitter):** En lugar de enviar a intervalos fijos, introduce un retardo aleatorio de 3 a 6 segundos tras cada mensaje despachado.
3. **Pausas de Lote Configurables:** El worker procesa los mensajes en lotes. Por defecto, al alcanzar 30 mensajes consecutivos (`BROADCAST_BATCH_LIMIT`), el proceso se detiene y descansa 90 segundos (`BROADCAST_BATCH_REST_MS`) antes de continuar.

Puedes personalizar los límites de los lotes en tu archivo `.env`:
```env
# Límite de mensajes por lote en campañas
BROADCAST_BATCH_LIMIT=30
# Tiempo de descanso entre lotes (en milisegundos, ej. 90000 = 90s)
BROADCAST_BATCH_REST_MS=90000
```
