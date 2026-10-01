# Fuentes de Información y Enlaces de Datos

Este documento detalla el listado completo de fuentes externas, sitios web, plataformas y organizaciones cuyos datos han sido utilizados, centralizados o integrados en la plataforma AcopioVE.

---

## 1. Plataformas y Bases de Datos Principales

*   **acopiovzla.com**
    *   *Enlace:* [https://acopiovzla.com](https://acopiovzla.com)
    *   *Datos extraídos:* Base de datos de 146 centros de acopio activos a nivel nacional (Venezuela) y en comunidades organizadas en el exterior.
    *   *Estado:* Datos procesados y cargados en la base de datos de centros de asistencia.

*   **infoayudavenezuela.site** (y espejo **redh.avapre.com**)
    *   *Enlaces:* [https://www.infoayudavenezuela.site/refugios](https://www.infoayudavenezuela.site/refugios) · [https://redh.avapre.com/directory/acopio](https://redh.avapre.com/directory/acopio)
    *   *Datos extraídos:* Ubicación y contactos de refugios y centros de primera respuesta habilitados en zonas afectadas (Caracas, Carabobo, Falcón, Lara, etc.) mediante la API REST de Supabase compartida por ambos dominios.
    *   *Estado:* Nuevos refugios importados y contactos asociados cargados en las listas de difusión de WhatsApp (Kapso).

*   **centrosayudavenezuela.org**
    *   *Enlace:* [https://centrosayudavenezuela.org](https://centrosayudavenezuela.org)
    *   *Datos extraídos:* Directorio general de centros de acopio iniciales y coordinadores locales.
    *   *Estado:* Centralizado en la base de datos.

*   **RefugioVE**
    *   *Enlace:* [https://refugio-ve.vercel.app](https://refugio-ve.vercel.app)
    *   *Datos extraídos:* Indexación de refugios temporales y condiciones de capacidad de albergues.
    *   *Estado:* Centralizado en la base de datos de refugios.

*   **ayudasismove.org (Venezuela Conecta)**
    *   *Enlace:* [https://ayudasismove.org](https://ayudasismove.org)
    *   *Datos extraídos:* Puntos de conectividad de emergencia en zonas de desastre.
    *   *Estado:* Integrado en el mapa general.

*   **ayudavenezuela.help**
    *   *Enlace:* [https://ayudavenezuela.help](https://ayudavenezuela.help)
    *   *Datos extraídos:* Registro de campañas de asistencia humanitaria y logística internacional.
    *   *Estado:* Mapeado en la red internacional de acopio.

*   **ayudahumanitariavenezuela.org**
    *   *Enlace:* [https://ayudahumanitariavenezuela.org](https://ayudahumanitariavenezuela.org)
    *   *Datos extraídos:* Centros de distribución de insumos médicos de primera necesidad.
    *   *Estado:* Mapeado en la red nacional de salud y primeros auxilios.

*   **venezuelared.com (VenezuelaHelp)**
    *   *Enlace:* [https://venezuelared.com](https://venezuelared.com)
    *   *Datos extraídos:* Directorio de zonas afectadas, refugios (humanos y animales) y centros de acopio en Aragua y Carabobo, con insumos requeridos por punto. Sin API pública (datos embebidos en el sitio Next.js); revisión y carga manual.
    *   *Estado:* Cargados manualmente 8 puntos sin solapamiento (2 acopios, 4 refugios humanos, 2 refugios animales). Detalle y verificación de duplicados en `docs/archivo/CARGA-VENEZUELARED.md`.

*   **Venezuela Sin IP + directorio confirmado (aporte externo del dueño)**
    *   *Datos extraídos:* Directorio "Venezuela Sin IP" (PDF transcrito, 95 centros, incluye red internacional "Operación Todos con Vzla") y un listado de 39 centros confirmados operando, ambos sin API — carga manual puntual.
    *   *Estado:* 22 centros nuevos cargados y aprobados; 14 teléfonos completados/corregidos en centros existentes; 28 centros confirmados (`last_confirmed_at`). Detalle completo en `docs/archivo/CARGA-VENEZUELA-SIN-IP-Y-DIRECTORIO-2026-07.md`.

*   **USGS (U.S. Geological Survey)**
    *   *Enlace:* [https://earthquake.usgs.gov](https://earthquake.usgs.gov)
    *   *Datos extraídos:* Registro oficial de sismicidad, magnitudes y réplicas recientes.
    *   *Estado:* Integración API en tiempo real en la capa del mapa interactivo.

---

## 2. Redes de Apoyo y Contactos Adicionales

*   **Interp-Aid**
    *   *Datos:* Registro de 1,878 traductores e intérpretes voluntarios para soporte remoto en idiomas.
    *   *Estado:* Base de datos sincronizada en la sección de intérpretes (/interpretes y /interpretes/en).

*   **Prensa y Radio Local**
    *   *El Diario:* [@Eldiario](https://x.com/eldiario) en redes sociales (Verificación y reportes de campo).
    *   *Circuito Éxitos y La Mega:* [@exitos991](https://x.com/exitos991) y [@lamega967](https://x.com/lamega967) (Reportes radiales e insumos solicitados en directo).

*   **Organizaciones Civiles y Gremiales:**
    *   *Fedeagro / Comité de Damas:* Aliados en la zona de Barinas y occidente.
    *   *Cámara de Comercio e Industrias de Bolívar:* Coordinador logístico del estado Bolívar.
    *   *Colegio de Médicos de Maracaibo:* Coordinación médica en el estado Zulia.
    *   *Rotaract Santo Ángel:* Apoyo logístico local en el estado Bolívar (San Félix, Puerto Ordaz).

---

## 3. APIs en vivo agregadas automáticamente

El **catálogo canónico** de las APIs que se consultan en tiempo real (endpoint exacto,
formato, tipo de acceso y qué capa alimenta) es la página pública
**[/docs/fuentes](https://acopiove.org/docs/fuentes)** (código:
`src/app/docs/fuentes/page.tsx`). Este documento no duplica ese detalle; resumen:

*   **Agregadas por `/api/personas`** (servidor, caché 60 s, tolerantes a fallos):
    SOS Venezuela, Localizados Venezuela, CIVIS Venezuela, Mapa de Daños
    (terremotovenezuela.com), Reporte VE, Centros de Insumos VE, Venezuela Ayuda (Hub),
    Terremoto Venezuela (REST), REDH AVAPRE y De Mano en Mano.
*   **On-demand en búsqueda** (por nombre o cédula, sin volcado): ReportaVNZLA y
    **Venezuela Reporta** (`venezuelareporta.org/api-abierta` — atribución obligatoria;
    además aporta sitios con coordenadas vía `/api/v1/sitios`).
*   **Capas de mapa**: USGS (ShakeMap y réplicas), TerraVE (daño satelital Sentinel-1),
    Microsoft AI for Good vía OCHA HDX (edificios dañados de Catia La Mar, snapshot en
    `public/danos-catia-la-mar.json`), OpenWeatherMap (lluvia), Open-Meteo (clima) y
    GDACS (alertas).

> Nota: AcopioVE es la **fuente de verdad** de los centros de acopio, refugios y teléfonos propios; esas no son fuentes externas sino datos gestionados por la plataforma.
