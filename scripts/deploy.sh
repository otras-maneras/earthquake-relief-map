#!/usr/bin/env bash
# Deploy de AcopioVE en el VPS. Encierra la "regla de deploy" en un comando:
#   permisos de .next → build COMO acopiove (nunca root) → restart → health check.
# Uso:  ./scripts/deploy.sh
set -euo pipefail

cd "$(dirname "$0")/../apps/web"   # app Next.js (apps/web)
APP="${APP_SERVICE:-earthquake-relief-map}"
PORT=4100

echo "▶ Deploy $(date '+%F %T')  ·  commit $(git rev-parse --short HEAD 2>/dev/null || echo '?')"

# 1. Permisos correctos de .next (evita EACCES si quedó algo root de un 'dev').
echo "· Ajustando permisos de .next…"
sudo chown -R "${APP_USER:-acopiove}":"${APP_USER:-acopiove}" .next 2>/dev/null || true

# 2. Build SIEMPRE como acopiove (si se buildea root, .next queda root y rompe el ISR).
echo "· Compilando como acopiove…"
sudo -u "${APP_USER:-acopiove}" -H npm run build

# 3. Reiniciar el servicio.
echo "· Reiniciando el servicio…"
sudo systemctl restart "$APP"

# 4. Verificar que volvió a levantar y responde.
sleep 3
if systemctl is-active --quiet "$APP" && curl -fsS -o /dev/null "http://localhost:$PORT"; then
  echo "✅ Deploy OK — $APP activo y respondiendo en :$PORT"
else
  echo "❌ Algo falló. Revisar:  journalctl -u $APP -n 50 --no-pager  |  logs/web.log"
  exit 1
fi

# 5. Gate anti-PII: aborta ruidosamente si el servicio en vivo expone cédulas,
#    datos simulados o campos internos por las superficies públicas de personas.
echo "· Verificando invariante anti-PII…"
if npm run --silent check:pii; then
  echo "✅ Anti-PII OK"
else
  echo "❌ ALERTA: el servicio en vivo expone PII. Revisar de inmediato."
  exit 1
fi
