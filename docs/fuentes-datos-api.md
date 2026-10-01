# Fuentes de Informacion y APIs de Datos Integradas

Este documento detalla el catalogo de APIs de datos y plataformas externas que se integran y agregan en tiempo real dentro del ecosistema de AcopioVE. 

La unificacion de estas fuentes permite ofrecer un buscador consolidado para tareas de reunificacion de personas, localizacion de refugios y deteccion de danos estructurales en zonas afectadas.

---

## 1. APIs de Datos Integradas en Tiempo Real

Estas fuentes externas se consultan directamente desde el servidor, se normalizan a un esquema comun y se presentan a traves del mapa de busquedas de la aplicacion. A continuacion, se documentan sus especificaciones de acceso directo:

### SOS Venezuela
* **Proposito:** Registro de personas desaparecidas y localizadas.
* **URL base de API:** `https://sosvenezuela2026.com/api`
* **Ejemplo de peticion directa (cURL):**
  ```bash
  # Obtener listado paginado de personas
  curl -s "https://sosvenezuela2026.com/api/persons/list?offset=0&limit=100"
  
  # Obtener estadisticas globales
  curl -s "https://sosvenezuela2026.com/api/persons/stats"
  ```
* **Formato:** JSON

### Localizados Venezuela
* **Proposito:** Directorio de personas ubicadas con vida en albergues y hospitales.
* **URL de API:** `https://localizadosvenezuela.com/api/v1/localizados`
* **Ejemplo de peticion directa (cURL):**
  ```bash
  # Obtener personas localizadas con limite de resultados
  curl -s "https://localizadosvenezuela.com/api/v1/localizados?page=1&limit=100"
  ```
* **Formato:** JSON

### CIVIS Venezuela
* **Proposito:** Directorio de puntos de salud activos y telefonos de cuerpos de emergencia.
* **URL de API:** `https://civisvenezuela.com/api/puntos`
* **Ejemplo de peticion directa (cURL):**
  ```bash
  # Consultar la totalidad de puntos de salud indexados
  curl -s "https://civisvenezuela.com/api/puntos"
  ```
* **Formato:** JSON

### Mapa de Danos (terremotovenezuela.com)
* **Proposito:** Registro de edificios con dano estructural severo, parcial o total.
* **URL de API:** `https://jckifxsdlnsvbztxydes.supabase.co/rest/v1/buildings`
* **Header de Autenticacion:** `apikey: <TU_CLAVE_PUBLISHABLE>`
* **Ejemplo de peticion directa (cURL):**
  ```bash
  # Obtener listado de edificios danados ordenados por actualizacion
  curl -s -H "apikey: <TU_CLAVE_PUBLISHABLE>" \
    "https://jckifxsdlnsvbztxydes.supabase.co/rest/v1/buildings?select=id,name,address,city,zone,lat,lng,damage_level,status,last_updated_at&order=last_updated_at.desc"
  ```
* **Formato:** JSON (PostgREST de Supabase)

### Hub Venezuela Ayuda
* **Proposito:** Agregador central que integra reportes de diversas plataformas en categorias de desaparecidos, check-ins a salvo, voluntariados y solicitudes de ayuda.
* **URL de API:** `https://terremoto.hazlohoy.org/api/v1/reports`
* **Ejemplo de peticion directa (cURL):**
  ```bash
  # Buscar reportes de personas desaparecidas (missing_person)
  curl -s "https://terremoto.hazlohoy.org/api/v1/reports?type=missing_person&limit=100"

  # Buscar reportes de check-ins a salvo (checkin)
  curl -s "https://terremoto.hazlohoy.org/api/v1/reports?type=checkin&limit=100"
  ```
* **Formato:** JSON

### ResponseGrid
* **Proposito:** Necesidades criticas y solicitudes validadas directamente en el terreno.
* **URL de API:** `https://api.responsegrid.app/emergencies`
* **Ejemplo de peticion directa (cURL):**
  ```bash
  # 1. Obtener la lista de emergencias activas para identificar el ID
  curl -s "https://api.responsegrid.app/emergencies"
  
  # 2. Consultar las necesidades validadas de una emergencia especifica (reemplazar {id})
  curl -s "https://api.responsegrid.app/emergencies/{id}/public/needs"
  ```
* **Formato:** JSON

### Terremoto Venezuela (REST API)
* **Proposito:** Registro de ingresos de pacientes en centros hospitalarios y búsqueda de desaparecidos.
* **URL de API:** `https://ayudavenezuela.online/api/v1/desaparecidos`
* **Ejemplo de peticion directa (cURL):**
  ```bash
  # Buscar personas reportadas por nombre (requiere credencial)
  curl -s -H "X-API-Key: TU_API_KEY" "https://ayudavenezuela.online/api/v1/desaparecidos?nombre=Nombre&limit=10"
  ```
* **Formato:** JSON

### REDH AVAPRE
* **Proposito:** Red de Ayuda Hospitalaria para registrar personas desaparecidas e ingresadas en centros de salud.
* **URL de API:** `https://api-redh.avapre.com/api/v1/public/missing-persons`
* **Ejemplo de peticion directa (cURL):**
  ```bash
  # Obtener el listado unificado de personas de la REDH
  curl -s "https://api-redh.avapre.com/api/v1/public/missing-persons?limit=100"
  ```
* **Formato:** JSON

### De Mano en Mano
* **Proposito:** Requerimientos de insumos y cobertura médica por hospital de campaña/emergencia.
* **URL de API:** `https://script.google.com/macros/s/AKfycbzX5pI5pnPazsDU8jPrrMbFpAxra149rNbjDWyYTwC_jhWTZORG_V3onD5LVd-fe8eY3g/exec`
* **Ejemplo de peticion directa (cURL):**
  ```bash
  # Obtener el tablero de necesidades
  curl -L -s "https://script.google.com/macros/s/AKfycbzX5pI5pnPazsDU8jPrrMbFpAxra149rNbjDWyYTwC_jhWTZORG_V3onD5LVd-fe8eY3g/exec"
  ```
* **Formato:** JSON (Google Apps Script)

### ReportaVNZLA
* **Proposito:** Busqueda on-demand de personas desaparecidas/localizadas; agrega desaparecidosterremotovenezuela.com y venezuelatebusca.com (~61k registros).
* **URL de API:** `https://reportavnzla.com/api/v1/personas`
* **Ejemplo de peticion directa (cURL):**
  ```bash
  # Buscar por nombre (lookup, no volcado masivo)
  curl -s "https://reportavnzla.com/api/v1/personas?q=Gonzalez&limit=25&page=0"
  ```
* **Formato:** JSON

### TerraVE (Datos Satelitales SAR)
* **Proposito:** Capa de afectación estructural y zonas de derrumbe obtenidas de radar satelital (SAR) Sentinel-1 GRD.
* **URL de API:** `https://terra-ve.vercel.app/api/satelital`
* **Ejemplo de peticion directa (cURL):**
  ```bash
  # Obtener poligonos de afectacion dentro de un Bounding Box
  curl -s "https://terra-ve.vercel.app/api/satelital?lat_min=10.4&lat_max=10.6&lng_min=-67.1&lng_max=-66.8&limit=100"
  ```
* **Formato:** JSON

---

## 2. Bases de Datos de Referencia Estatica

Adicionalmente, se importan y actualizan periodicamente datos de soporte tecnico de las siguientes organizaciones:

* **USGS (U.S. Geological Survey):** Integracion de la API de sismicidad en tiempo real para graficar epicentros, intensidades instrumentales (ShakeMaps) y replicas.
* **Interp-Aid:** Directorio de traductores e interpretes voluntarios para soporte telefonico e internacional multilingue.
* **acopiovzla.com, RefugioVE e infoayudavenezuela.site:** Consolidacion de inventarios historicos iniciales de centros de acopio y capacidades de refugios temporales antes del despliegue del mapa unificado.
* **venezuelared.com (VenezuelaHelp):** Directorio de refugios (humanos y animales) y centros de acopio en Aragua y Carabobo. Sin API publica; revision manual de duplicados y carga puntual de los registros sin solapamiento.
