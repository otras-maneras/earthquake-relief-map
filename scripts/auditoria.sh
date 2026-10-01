#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────
# scripts/auditoria.sh — Colector READ-ONLY de señales para la auditoría.
# No modifica DB, archivos, servicios ni envía mensajes. Imprime evidencia
# empírica para interpretar siguiendo docs/auditorias/PLAYBOOK.md.
#
# Uso:   ./scripts/auditoria.sh            # consola
#        ./scripts/auditoria.sh > out.txt  # guardar evidencia
#
# Requiere según sección: psql, curl, dig, jq, npx/npm, systemctl.
# Lee DATABASE_URL/KAPSO_API_KEY desde el entorno o desde .env sin imprimirlos.
# ──────────────────────────────────────────────────────────────────────────
set -uo pipefail
IFS=$'\n\t'
cd "$(dirname "$0")/.." || exit 1

APP="${APP:-https://acopiove.org}"
API="${API:-https://api.acopiove.org}"
ENV_FILE="${ENV_FILE:-.env}"

hr(){ printf '\n=== %s ===\n' "$1"; }
have(){ command -v "$1" >/dev/null 2>&1; }
not_verified(){ printf 'NO VERIFICADO (%s)' "$1"; }

env_value(){
  local key="$1" line value
  [ -f "$ENV_FILE" ] || return 1
  line="$(awk -v key="$key" 'index($0, key "=") == 1 { print; exit }' "$ENV_FILE" 2>/dev/null)" || return 1
  [ -n "$line" ] || return 1
  value="${line#*=}"
  value="${value%$'\r'}"
  case "$value" in
    \"*\") value="${value#\"}"; value="${value%\"}" ;;
    \'*\') value="${value#\'}"; value="${value%\'}" ;;
  esac
  printf '%s' "$value"
}

DB="${DATABASE_URL:-$(env_value DATABASE_URL || true)}"
KAPSO_API_KEY="${KAPSO_API_KEY:-$(env_value KAPSO_API_KEY || true)}"

q(){
  local sql="$1"
  if [ -z "$DB" ]; then not_verified "DATABASE_URL faltante"; return 0; fi
  if ! have psql; then not_verified "psql no disponible"; return 0; fi
  psql "$DB" -tAc "$sql" 2>/dev/null || not_verified "query falló"
}

http_probe(){
  local url="$1"
  if ! have curl; then not_verified "curl no disponible"; return 0; fi
  curl -s -o /dev/null -w '%{http_code} %{time_total}s' --max-time 15 "$url" 2>/dev/null \
    || not_verified "curl falló"
}

print_headers(){
  local url="$1" pattern="$2"
  if ! have curl; then not_verified "curl no disponible"; printf '\n'; return 0; fi
  curl -sI --max-time 15 "$url" 2>/dev/null \
    | awk -v re="$pattern" 'BEGIN{IGNORECASE=1} $0 ~ re { print; found=1 } END{ if (!found) print "NO VERIFICADO (headers no encontrados)" }'
}

txt_record(){
  local host="$1" pattern="${2:-.}"
  if ! have dig; then not_verified "dig no disponible"; return 0; fi
  dig +short TXT "$host" 2>/dev/null \
    | tr -d '"' \
    | awk -v re="$pattern" 'BEGIN{IGNORECASE=1} $0 ~ re { print; found=1; exit } END{ if (!found) print "AUSENTE" }'
}

count_test_files(){
  if have rg; then
    rg --files src -g '*.test.ts' -g '*.test.tsx' 2>/dev/null | wc -l | tr -d ' '
  else
    find src -name '*.test.ts*' 2>/dev/null | wc -l | tr -d ' '
  fi
}

untracked_count(){
  if ! have git; then not_verified "git no disponible"; return 0; fi
  git status --short 2>/dev/null | awk '$1 == "??" { count++ } END{ print count + 0 }'
}

hr "1. SALUD DEL SISTEMA"
if have systemctl; then
  echo "service:   $(systemctl is-active centros-acopio 2>/dev/null || not_verified "systemd falló")"
  systemctl show centros-acopio -p NRestarts -p ActiveEnterTimestamp -p User 2>/dev/null \
    || not_verified "systemctl show falló"
else
  echo "service:   $(not_verified "systemctl no disponible")"
fi
echo "local4100: $(http_probe http://localhost:4100/)"
echo "db ping:   $(q 'select 1')"

hr "2. CALIDAD DE DATOS"
echo "centros activos:   $(q 'select count(*) from centros where active')"
echo "refugios:          $(q "select count(*) from centros where active and tipo='refugio'")"
echo "telefonos activos: $(q 'select count(*) from telefonos where active')"
echo "paises:            $(q 'select count(distinct pais) from centros where active')"
echo "fuentes:           $(q 'select count(distinct fuente) from centros where active')"
echo "sin contacto:      $(q "select count(*) from centros where active and (contacto is null or contacto='')")"
echo "% sin contacto:    $(q "select round(100.0*count(*) filter (where contacto is null or contacto='')/count(*),2) from centros where active")"
echo "sin recibe:        $(q "select count(*) from centros where active and (recibe is null or recibe::text='[]' or recibe::text='\"\"')")"
echo "estado != abierto: $(q "select count(*) from centros where active and estado is distinct from 'abierto'")"
echo "placeholder coords:$(q 'select count(*) from centros where active and latitude=10.4880 and longitude=-66.9350')"
echo "grupos coords dup: $(q 'select count(*) from (select latitude, longitude from centros where active group by latitude, longitude having count(*) > 1) s')"
echo "users panel:       $(q 'select count(*) from users')"
echo "submissions pend.: $(q "select count(*) from centros where active='f'")"

hr "3. PRODUCCIÓN (HTTP)"
for u in "$APP/" "$APP/sitemap.xml" "$APP/robots.txt" "$APP/llms.txt" "$API/v1/puntos" "$API/v1/centros" "$API/v1/personas?q=test"; do
  printf "%-45s %s\n" "$u" "$(http_probe "$u")"
done

hr "4. EDGE CACHE (api.acopiove.org)"
print_headers "$API/v1/puntos" "cf-cache-status|cache-control|^vary:"

hr "5. HEADERS DE SEGURIDAD"
print_headers "$APP/" "strict-transport|x-frame|x-content-type|referrer-policy|permissions-policy|content-security"

hr "6. CÓDIGO Y DEPENDENCIAS"
if have npx; then
  printf "tsc --noEmit: "
  npx tsc --noEmit >/dev/null 2>&1 && echo "OK (0 errores)" || echo "FALLA"
else
  echo "tsc --noEmit: $(not_verified "npx no disponible")"
fi

if have npm; then
  audit_json="$(npm audit --omit=dev --json 2>/dev/null || true)"
  if [ -n "$audit_json" ] && have jq; then
    printf '%s\n' "$audit_json" \
      | jq -r '.metadata.vulnerabilities | "vulns: total=\(.total) low=\(.low) moderate=\(.moderate) high=\(.high) critical=\(.critical)"' 2>/dev/null \
      || echo "npm audit: NO VERIFICADO (salida no parseable)"
  else
    npm audit --omit=dev 2>/dev/null | awk 'BEGIN{IGNORECASE=1} /vulnerabilit|severity/ { print; count++ } count == 3 { exit }'
  fi
else
  echo "npm audit: $(not_verified "npm no disponible")"
fi

[ -f .eslintrc.js ] || [ -f .eslintrc.json ] || [ -f eslint.config.mjs ] || [ -f eslint.config.js ] \
  && echo "eslint: configurado" || echo "eslint: NO configurado"
echo "test files: $(count_test_files)"
echo "untracked:  $(untracked_count)"
echo "componentes mas grandes:"
find src -name '*.tsx' -exec wc -l {} + 2>/dev/null \
  | awk '$2 != "total" { print }' \
  | sort -rn \
  | head -4

hr "7. INFRA / BACKUPS"
echo "ultimo dump local:"
ls -t backups/*.sql.gz 2>/dev/null | head -1 || echo "AUSENTE"
echo "off-site (rclone.conf): $([ -f rclone.conf ] && echo presente || echo AUSENTE)"
[ -f scripts/backup.log ] && echo "backup.log ultimo sync:" && awk '/Sincronizaci.n de storage completada/ { line=$0 } END{ if (line) print line; else print "NO VERIFICADO (sin marca de sync)" }' scripts/backup.log

hr "8. COMUNICACIONES"
echo "SPF raiz:    $(txt_record acopiove.org spf)"
echo "DMARC:       $(txt_record _dmarc.acopiove.org dmarc)"
echo "Resend DKIM: $(txt_record resend._domainkey.acopiove.org .)"
echo "send.* SPF:  $(txt_record send.acopiove.org spf)"
echo "plantillas WhatsApp (Kapso):"
if [ -z "$KAPSO_API_KEY" ]; then
  echo "  $(not_verified "KAPSO_API_KEY faltante")"
elif ! have curl || ! have jq; then
  echo "  $(not_verified "curl/jq no disponible")"
else
  curl -s --max-time 15 -H "X-API-Key: $KAPSO_API_KEY" "https://app.kapso.ai/api/v1/whatsapp_templates" 2>/dev/null \
    | jq -r '.data[]? | "  - \(.name): \(.status)"' 2>/dev/null \
    | head -10
fi

hr "9. LIGHTHOUSE (opcional, ~2min — requiere google-chrome)"
echo "Correr a mano si se quiere score fresco:"
echo "  npx --yes lighthouse@latest $APP/ --only-categories=performance,accessibility,seo,best-practices \\"
echo "    --quiet --chrome-flags='--headless --no-sandbox --disable-gpu' --output=json --output-path=/tmp/lh.json"
echo "  jq -r '.categories|to_entries[]|\"\(.key): \((.value.score*100)|round)\"' /tmp/lh.json"

hr "FIN"
