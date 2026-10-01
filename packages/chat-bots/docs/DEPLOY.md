# Despliegue

Guía para poner `chat-bots` en producción detrás de un dominio público accesible por Kapso y Telegram.

## 1. Infraestructura mínima

| Componente | Rol |
|------------|-----|
| **app** | Express en `:3000` — webhooks + admin |
| **worker** | Proceso separado que envía campañas |
| **PostgreSQL** | Sesiones, listas, cola de broadcasts |

En Docker Compose los tres servicios vienen definidos. En PaaS (Railway, Fly, Render) despliega **dos procesos** (web + worker) con la misma imagen y `DATABASE_URL` compartida.

## 2. Base de datos

```bash
npm run db:migrate
```

Aplica `migrations/*.sql` en orden. Idempotente: registra migraciones en `schema_migrations`.

## 3. URL pública de webhooks

Kapso y Telegram deben poder hacer `POST` HTTPS a tu servidor. Recomendaciones:

- Usa un subdominio dedicado, p. ej. `https://hooks.tu-dominio.org`.
- Si usas Cloudflare, pon el subdominio en **DNS only** (gris) para webhooks de datacenter; el proxy naranja puede bloquear IPs de Meta/Telegram.
- Configura `WEBHOOK_PUBLIC_URL=https://hooks.tu-dominio.org` para el script de Telegram.

### WhatsApp (Kapso)

1. En Kapso, registra el webhook: `https://hooks.tu-dominio.org/webhooks/kapso`
2. Suscríbete al campo **messages** (mensajes entrantes).
3. Define `KAPSO_WEBHOOK_SECRET` y configúralo también en Kapso.
4. Verificación Meta (GET): el endpoint responde `hub.challenge` si `hub.verify_token` coincide con el secret.

Ver [WHATSAPP.md](./WHATSAPP.md).

### Telegram

```bash
WEBHOOK_PUBLIC_URL=https://hooks.tu-dominio.org npm run telegram:set-webhook
```

Registra `https://hooks.tu-dominio.org/webhooks/telegram` con `secret_token = TELEGRAM_WEBHOOK_SECRET`.

Ver [TELEGRAM.md](./TELEGRAM.md).

## 4. Procesos en producción

```bash
# Servidor
NODE_ENV=production npm start

# Worker (obligatorio para campañas)
NODE_ENV=production npm run worker
```

Supervisa ambos con systemd, PM2, o el scheduler del PaaS.

## 5. Health check

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

## 6. Seguridad

- **`ADMIN_API_KEY`**: obligatorio en producción. Header `X-Admin-Key: …` en todas las rutas `/admin/*`.
- **`KAPSO_WEBHOOK_SECRET`**: HMAC SHA-256 en header `X-Webhook-Signature`. Fail-closed si está configurado.
- **`TELEGRAM_WEBHOOK_SECRET`**: comparación exacta con `X-Telegram-Bot-Api-Secret-Token`.
- No expongas `/admin` sin TLS ni sin API key.
- La búsqueda de personas debe ir contra un endpoint **PII-seguro** (rate limit, sin datos sensibles innecesarios).

## 7. Escalado

- **app**: stateless; escala horizontalmente detrás de un load balancer.
- **worker**: un solo worker activo evita duplicar envíos; si necesitas más throughput, particiona campañas o usa un lock distribuido (no incluido en v1).
- **Postgres**: conexiones pooled vía `pg.Pool`.

## 8. Observabilidad

Logs en stdout:

- `[chat-bots] listening on :3000`
- `[worker] broadcast worker started`
- `[wa-bot] error …` / `[telegram-bot] error …`

Monitorea:

- Ratio `sent_count` / `fail_count` en `broadcasts`
- Respuestas 403 en webhooks (firma incorrecta)
- Latencia de `DATA_API_BASE_URL`

## 9. Checklist pre-lanzamiento

- [ ] `DATA_API_BASE_URL` responde `/puntos` y (opcional) `/personas`
- [ ] Migraciones aplicadas
- [ ] Webhook Kapso verificado (envía mensaje de prueba)
- [ ] Webhook Telegram verificado (`/start`)
- [ ] Worker corriendo
- [ ] Plantilla WhatsApp aprobada para campañas de prueba
- [ ] `ADMIN_API_KEY` rotada y guardada en el gestor de secretos
