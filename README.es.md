# earthquake-relief-map

[English](README.md) | **Español**

> **Estado: proyecto cerrado y archivado (octubre 2026).** Código MIT, datos CC-BY-4.0.
> Sin mantenimiento activo; los servicios en vivo (`acopiove.org`, `api.acopiove.org`) fueron dados de baja.

## Qué es

**AcopioVE** fue una plataforma de respuesta humanitaria construida durante el terremoto de Venezuela de 2026.
Resolvía un problema concreto: la información de ayuda estaba dispersa en decenas de grupos y sitios, y nadie sabía
**dónde entregar una donación, dónde había un refugio abierto o a quién llamar**. AcopioVE reunió y verificó esa
información, la publicó como datos abiertos y la hizo consultable por personas, apps y bots.

Llegó a **716 centros en 22 países** (664 centros de acopio y 52 refugios), 78 líneas de emergencia verificadas y
una red de 1.878 intérpretes voluntarios, con coordinación para la diáspora.

## Qué hace

- **Directorio y mapa de centros de acopio y refugios.** Cada punto indica qué recibe, qué necesita ahora, horario,
  contacto y cuándo se confirmó por última vez. Los clusters del mapa se colorean por **frescura de la
  verificación** (verde: confirmado esta semana · ámbar: vigente · rojo: sin actualizar), no por cantidad.
- **Filtro por insumo y por país**, para orientar envíos desde la diáspora (agua, alimentos, higiene, medicinas…).
- **API pública de solo lectura (`/v1`)** en JSON, GeoJSON y CSV, con rate limit y caché de borde. Ver [API](#api).
- **Búsqueda de personas (reunificación).** Consulta en paralelo a las organizaciones de origen y concilia
  resultados en memoria, **sin almacenar nada**, con cédulas enmascaradas y sin ubicación de menores.
- **Capas científicas y satelitales:** ShakeMap y réplicas (USGS), alertas globales (GDACS), clima (Open-Meteo),
  evaluación de daños (Microsoft AI for Good / OCHA HDX) y un visor 3D de edificios dañados.
- **Boletín de prensa con IA:** resume medios nacionales e internacionales (BBC Mundo, DW, OCHA, ReliefWeb,
  Efecto Cocuyo…) para contrarrestar rumores.
- **Panel de administración** con moderación de aportes ciudadanos, roles y campañas de actualización
  de datos por WhatsApp, correo y Telegram.
- **Bots de WhatsApp y Telegram** que responden con el centro o refugio más cercano y buscan familiares.
- **SEO y accesibilidad:** directorios renderizados en servidor, ligeros para conexiones precarias.

## API

Base: `http://localhost:4100/v1` en tu instancia (el servicio público ya no existe).

| Endpoint | Devuelve |
|---|---|
| `GET /v1/centros`, `/v1/centros/{id}` | Centros de acopio y refugios |
| `GET /v1/telefonos` | Líneas de emergencia y brigadas |
| `GET /v1/puntos` | Vista unificada (acopio, refugio, salud, teléfono) |
| `GET /v1/personas?q=` | Búsqueda de personas reportadas, PII-segura |
| `POST /v1/submissions` | Sugerir un punto (entra a una cola de moderación) |
| `GET /v1/meta`, `/v1/openapi.json` | Conteos y especificación OpenAPI 3.1 |

Filtros: `tipo`, `estado`, `ciudad`, `pais`, `updatedSince`, `near=lat,lng&radius=km`, `limit`, `offset`,
`format=json|geojson|csv`. Ejemplos en [`examples/`](examples).

```bash
curl 'http://localhost:4100/v1/puntos?tipo=refugio&near=10.49,-66.88&radius=15&limit=3'
```

## Estructura

```
apps/web/                  App Next.js 16 + PostgreSQL: sitio, panel admin y API pública /v1
packages/chat-bots/        Bots de WhatsApp/Telegram y campañas salientes (Node, standalone)
packages/news-summarizer/  Boletín de prensa sintetizado con IA (Node, standalone)
examples/                  Clientes de ejemplo de la API (curl, Node, Python, Leaflet, webhook)
data/                      Snapshot final de datos abiertos (CSV/JSON/GeoJSON, CC-BY-4.0)
docs/                      Arquitectura, seguridad/PII, fuentes y auditorías
scripts/                   Deploy, backup, auditoría, gate anti-PII y generador de snapshots
deploy/                    Unidad systemd de ejemplo
```

Cada app/paquete tiene su propio `package.json` y lockfile (versiones de TypeScript y Node distintas), sin
*workspaces*. Desde la raíz, `npm run <dev|build|typecheck|db:push|check:pii>` delega en `apps/web` y
`npm run install:all` instala todo.

**Stack:** Next.js 16 (App Router, React 19, TypeScript), Tailwind 3, PostgreSQL + Drizzle ORM, MapLibre GL y
Leaflet, auth con JWT (`jose`) + bcrypt y RBAC por rol.

## Puesta en marcha

```bash
cp apps/web/.env.example apps/web/.env   # mínimo: DATABASE_URL y JWT_SECRET
npm run install:all
npm run db:push          # crea las tablas (Drizzle)
npm run db:seed          # superadmin inicial
npm run dev              # http://localhost:4100  ·  API en /v1
```

Requiere Node 20+ y PostgreSQL. `npm run build` necesita un Postgres accesible con el esquema creado, incluso
en CI. Los bots y el resumidor se arrancan por separado; ver el README de cada paquete.

Las integraciones externas (personas, daños, noticias IA, WhatsApp/correo/Telegram) son **opcionales** y se
apagan sin su clave. Varias dependen de servicios de terceros que pueden haber cambiado o desaparecido.

## Datos

[`data/`](data) contiene los 716 centros y 78 teléfonos del 2026-10-01 (CSV, JSON, GeoJSON). Pueden estar
desactualizados: nadie los verifica ya. Regenerable desde una instancia propia con `scripts/generate-snapshots.sh`.
Para cargarlos en una base nueva, usa estos archivos como punto de partida.

## Privacidad

Los datos de personas **nunca se persistían**: se consultaban en vivo y se conciliaban en memoria, con cédulas
enmascaradas y sin ubicación de menores. Si lo despliegas, mantén esas salvaguardas y corre `npm run check:pii`
antes de cada despliegue. Ver [`docs/SEGURIDAD.md`](docs/SEGURIDAD.md).

## Licencias

- Código: [MIT](LICENSE). Datos de `data/`: **CC-BY-4.0**, atribución "Datos: AcopioVE (acopiove.org)".
- Las marcas de terceros (HelpMaps y otras fuentes) pertenecen a sus dueños.

Documentación: [`docs/`](docs/README.md) · Contribuir: [`CONTRIBUTING.md`](CONTRIBUTING.md) · Seguridad: [`SECURITY.md`](SECURITY.md)
