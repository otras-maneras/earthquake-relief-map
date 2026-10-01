#!/usr/bin/env bash
# Regenera data/ (snapshot abierto) desde una instancia en ejecución de la API /v1.
# Uso: API_URL=http://localhost:4100/v1 ./scripts/generate-snapshots.sh   (requiere curl, jq)
set -euo pipefail
cd "$(dirname "$0")/.."
API_URL="${API_URL:-http://localhost:4100/v1}"
curl -fsS "$API_URL/meta" >/dev/null || { echo "La API en $API_URL no responde." >&2; exit 1; }
ATTR="Datos: AcopioVE (acopiove.org), CC-BY-4.0 — snapshot $(date +%F)"

fetch_all() { # $1=endpoint → array JSON con todos los registros (paginado de 500)
  local off=0 out='[]' page
  while :; do
    page=$(curl -fsS "$API_URL/$1?limit=500&offset=$off")
    out=$(jq -s '.[0] + .[1].data' <(echo "$out") <(echo "$page"))
    [ "$(echo "$page" | jq '.data | length')" -lt 500 ] && break
    off=$((off+500))
  done
  echo "$out"
}

# 'responsable' (nombres de personas) se omite a propósito.
centros=$(fetch_all centros | jq 'map(del(.responsable))')
telefonos=$(fetch_all telefonos)

wrap() { jq --arg a "$ATTR" '{license:"CC-BY-4.0",attribution:$a,count:length,data:.}'; }
echo "$centros"   | wrap > data/centros.json
echo "$telefonos" | wrap > data/telefonos.json
echo "$centros" | jq -r '(.[0]|keys_unsorted) as $k | $k, (.[]|[.[$k[]]|if type=="array" or type=="object" then tojson else . end])|@csv' > data/centros.csv
echo "$telefonos" | jq -r '(.[0]|keys_unsorted) as $k | $k, (.[]|[.[$k[]]])|@csv' > data/telefonos.csv
echo "$centros" | jq --arg a "$ATTR" '{type:"FeatureCollection",license:"CC-BY-4.0",attribution:$a,
  features:[.[]|select(.lat!=null and .lng!=null)|{type:"Feature",geometry:{type:"Point",coordinates:[.lng,.lat]},properties:del(.lat,.lng)}]}' > data/centros.geojson
echo "OK: $(echo "$centros" | jq length) centros, $(echo "$telefonos" | jq length) teléfonos → data/"
