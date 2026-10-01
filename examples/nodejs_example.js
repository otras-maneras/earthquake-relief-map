// ============================================================================
// Ejemplo de Consumo de la API de AcopioVE en NodeJS (Fetch API)
// ============================================================================
//
// Este script independiente demuestra cómo consultar el directorio unificado
// de ayuda de AcopioVE, realizar filtros geográficos por cercanía e imprimir
// los resultados de forma estructurada en la consola.
//
// Requisitos: NodeJS v18 o superior (para soporte nativo de fetch).
// Uso: node nodejs_example.js
//

const API_URL = "http://localhost:4100/v1/puntos";

async function fetchNearbyAid(lat, lng, radiusKm = 10) {
  // Construimos los parámetros de búsqueda geolocalizada
  const params = new URLSearchParams({
    near: `${lat},${lng}`,
    radius: radiusKm.toString(),
    limit: "5" // Limitar a los 5 puntos más cercanos
  });

  const url = `${API_URL}?${params.toString()}`;

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "AcopioVE-NodeJS-Client/1.0"
      }
    });

    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status}`);
    }

    const result = await response.json();
    const puntos = result.data || [];

    console.log(`Búsqueda en un radio de ${radiusKm}km alrededor de (Lat: ${lat}, Lng: ${lng}):`);
    console.log(`Total encontrados: ${result.meta?.count || puntos.length}\n`);

    puntos.forEach((p, idx) => {
      console.log(`${idx + 1}. [${p.tipo.toUpperCase()}] ${p.nombre}`);
      if (p.ciudad) {
        console.log(`   Ubicación: ${p.ciudad}, ${p.pais}`);
      }
      if (p.telefono) {
        console.log(`   Contacto: ${p.telefono}`);
      }
      if (p.descripcion) {
        console.log(`   Detalle: ${p.descripcion}`);
      }
      console.log(`   Fuente: ${p.fuente} (${p.fuente_url})`);
      console.log("-".repeat(50));
    });

  } catch (error) {
    console.error("Error al realizar la consulta a la API:", error.message);
  }
}

// Coordenadas de ejemplo: Caracas Centro (Plaza Bolívar)
const latCaracas = 10.5061;
const lngCaracas = -66.9146;

fetchNearbyAid(latCaracas, lngCaracas, 5);
