# Seguridad y buenas prácticas — AcopioVE

> Aplicación pública con panel de administración y datos de personas: la superficie
> importa. Última revisión: 2026-07-12.

## Implementado

- **Auth cookie-only**: JWT (`jose`, HS256) en cookie httpOnly + secure (prod) +
  sameSite=lax, expira a los 7 días. `JWT_SECRET` con fail-fast en producción (aborta si
  falta; sin fallback inseguro). El login y `/me` no devuelven el token en el body.
- **RBAC**: `src/lib/guard.ts` (`requireRole`/`requireAuth`). Las rutas `/api/admin/*`
  (campañas, listas de contactos, plantillas) exigen rol `superadmin`; aprobar/eliminar
  centros también. El resto de mutaciones exige cualquier sesión válida.
- **Mutaciones protegidas**: todos los POST/PUT/DELETE de centros, teléfonos, pendientes
  y aprobaciones exigen sesión (401 sin auth, 403 sin rol).
- **CSP enforcing**: `Content-Security-Policy` en `next.config.mjs`, calibrada (hosts de
  Umami/GA en `script-src`, `worker-src blob:` para los workers de MapLibre en `/mapa-3d`);
  verificada en navegador (0 violaciones en home/`/busquedas`/`/mapa-3d`). Mantiene
  `unsafe-inline` en scripts; migrar a nonces queda pendiente.
- **Webhooks de bots firmados y fail-closed**: WhatsApp (`X-Webhook-Signature`,
  HMAC-SHA256) y Telegram (`X-Telegram-Bot-Api-Secret-Token`).
- **API pública v1**: solo lectura (más `POST /v1/submissions` moderado), CORS `*`,
  rate-limit por IP, queries parametrizadas (Drizzle) y validación de parámetros.
- **Rate-limit** (en memoria, por IP; lee `CF-Connecting-IP` detrás del CDN): login 6
  fallos/15 min por IP+email; submit público 8/10 min; GET públicos 60/min;
  `/api/personas` y `/api/busqueda-avanzada` 45/min. Honeypot en el submit.
- **Moderación**: toda contribución pública entra inactiva (`active=false`) y no se
  publica hasta que un admin la aprueba; detección de posibles duplicados para el revisor.
- **Validación Zod** en todos los inputs de escritura.
- **SQL**: Drizzle parametriza (sin inyección). **XSS**: React escapa; el HTML manual de
  los popups del mapa pasa por `esc()`.
- **Boletín de noticias**: `POST /api/news/summary` (generación paga vía OpenRouter)
  exige `X-Cron-Secret`; el `GET` público solo lee caché en disco.
- **Postgres** solo en localhost, auth scram-sha-256, DB y rol dedicados.
- **Headers**: HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy,
  Permissions-Policy restrictiva. HTTPS en todo el sitio.
- **CSRF**: cookie `sameSite=lax` mitiga POST cross-site.
- **Dependencias**: `npm audit --omit=dev` en 0 vulnerabilidades (verificado 2026-07-11).
- **Secretos fuera de git**: `.env`, credenciales, backups y snapshots con PII están
  gitignored (`.gitignore` incluye `docs/internal/` y `/data-privado/`). Las claves de
  terceros (daños de edificios, Ayuda Venezuela, Interp-Aid) se leen solo de entorno, sin
  fallback hardcodeado en el código.
- **Servicio no-root** con backups periódicos de la DB y copia off-site.

## Salvaguardas de PII (datos de personas)

- Cédulas siempre enmascaradas en cualquier salida pública (incluye `/api/personas` y
  `/busquedas`, no solo la API `/v1`; el enmascarado es central en el agregador).
- Sin teléfonos personales ni coordenadas GPS exactas de personas; ubicación general.
- Menores de edad sin ubicación.
- `/v1/personas` exige término de búsqueda (lookup); nunca volcado completo.
- Sin cifras agregadas de personas en contenido SEO/JSON-LD (fuentes no reconciliadas
  entre sí; publicar totales sería engañoso).
- La conciliación multi-fuente solo fusiona fichas con evidencia fuerte (cédula completa
  o nombre + lugar corroborado) para no mezclar PII de homónimos.
- **Gate anti-PII en cada deploy** (`npm run check:pii`, corre al final de `deploy.sh`):
  aborta si una superficie pública de personas expone una cédula sin enmascarar, datos
  simulados o campos internos. Los mocks solo se sirven fuera de producción.

## Pendiente / recomendado

1. **CSP: migrar a nonces**: ya está en enforcing; falta quitar `unsafe-inline` de
   `script-src` con nonces por request. (Bajo)
2. **Gestión de usuarios por UI**: hoy 1 superadmin, contraseña cambiable solo por DB;
   sin 2FA. (Bajo, funcional)
3. **Rate-limit en memoria**: se resetea al reiniciar y no se comparte entre procesos.
   Si se escala a varias instancias, mover a Redis. (Bajo)
4. **DMARC**: endurecer de `p=none` a `quarantine` tras revisar reportes. (Bajo)
5. **Endurecimiento del CDN**: certificado de origen + SSL estricto; restringir el
   origen a IPs del CDN. (Opcional)
