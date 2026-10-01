#!/usr/bin/env bash
# ============================================================================
# Ejemplos de Consultas por Consola usando cURL
# ============================================================================
#
# Este archivo contiene ejemplos prácticos de llamadas HTTP a la API pública
# de AcopioVE para realizar consultas y descargar datos en diferentes formatos.
#
# Uso: chmod +x curl_examples.sh && ./curl_examples.sh
#

set -euo pipefail

API_URL="http://localhost:4100/v1"

echo "=== 1. Consultar Metadatos Generales ==="
curl -s "${API_URL}/meta" | jq .
echo -e "\n"

echo "=== 2. Buscar Puntos de Ayuda Cercanos (Geolocalizados) ==="
# Busca los 3 puntos más cercanos a Caracas en un radio de 10km
curl -s "${API_URL}/puntos?near=10.5061,-66.9146&radius=10&limit=3" | jq .
echo -e "\n"

echo "=== 3. Obtener Refugios en Formato GeoJSON ==="
# Descarga los refugios en formato compatible con visores geográficos (primeros 2 resultados)
curl -s "${API_URL}/puntos?tipo=refugios&format=geojson&limit=2" | jq .
echo -e "\n"

echo "=== 4. Descargar Directorio Unificado en CSV ==="
# Descarga el directorio en formato tabular plano
curl -s "${API_URL}/puntos?format=csv&limit=5"
echo -e "\n"

echo "=== 5. Búsqueda PII-Segura de Personas ==="
# Ejemplo de búsqueda de un nombre en el directorio de reunificación
curl -s "${API_URL}/personas?q=maria" | jq .
echo -e "\n"
