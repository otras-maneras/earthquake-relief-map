# earthquake-relief-map

> **Estado: proyecto cerrado y archivado (octubre 2026).** Código MIT, datos CC-BY-4.0.
> Sin mantenimiento activo; los servicios en vivo (`acopiove.org`, `api.acopiove.org`) fueron dados de baja.
>
> **EN:** Archived open-source monorepo from the 2026 Venezuela earthquake response: a map, directory and
> API of donation centers, shelters and emergency hotlines (716 centers, 24 countries), plus WhatsApp/Telegram
> bots and a news summarizer. MIT code, CC-BY-4.0 data. No longer maintained.

## Estructura

```
apps/web/               App Next.js 16 + PostgreSQL: sitio, panel admin y API pública /v1
packages/chat-bots/     Bots de WhatsApp/Telegram y campañas salientes (Node, standalone)
packages/news-summarizer/  Boletín de prensa sintetizado con IA (Node, standalone)
examples/               Clientes de ejemplo de la API (curl, Node, Python, Leaflet, webhook)
data/                   Snapshot final de datos abiertos (CSV/JSON/GeoJSON, CC-BY-4.0)
docs/                   Arquitectura, seguridad/PII, fuentes y auditorías
scripts/                Deploy, backup, auditoría, gate anti-PII y generador de snapshots
deploy/                 Unidad systemd de ejemplo
```

Cada app/paquete tiene su propio `package.json` y lockfile (versiones de TypeScript y Node distintas),
sin *workspaces*. Desde la raíz, `npm run <dev|build|typecheck|db:push|check:pii>` delega en `apps/web`
y `npm run install:all` instala todo.

## Puesta en marcha (apps/web)

```bash
cp apps/web/.env.example apps/web/.env   # mínimo: DATABASE_URL y JWT_SECRET
npm run install:all
npm run db:push          # crea las tablas (Drizzle)
npm run db:seed          # superadmin inicial
npm run dev              # http://localhost:4100  ·  API en /v1
```

`npm run build` necesita un Postgres accesible con el esquema creado, incluso en CI.
Los bots y el resumidor se arrancan por separado; ver el README de cada paquete.
Las integraciones externas (personas, daños, noticias IA, WhatsApp/correo/Telegram) son opcionales y se apagan
sin su clave; varias dependen de servicios de terceros que pueden haber cambiado o desaparecido.

## Datos

[`data/`](data) contiene los 716 centros y 78 teléfonos del 2026-10-01 (CSV, JSON, GeoJSON). Pueden estar
desactualizados. Regenerable desde una instancia propia con `scripts/generate-snapshots.sh`.

## Privacidad

Los datos de personas **nunca se persistían**: se consultaban en vivo y se conciliaban en memoria, con cédulas
enmascaradas y sin ubicación de menores. Mantén esas salvaguardas y corre `npm run check:pii` antes de desplegar.
Ver [`docs/SEGURIDAD.md`](docs/SEGURIDAD.md).

## Licencias

- Código: [MIT](LICENSE). Datos de `data/`: **CC-BY-4.0** — "Datos: AcopioVE (acopiove.org)".
- Las marcas de terceros (HelpMaps y otras fuentes) pertenecen a sus dueños.

Documentación: [`docs/`](docs/README.md) · Contribuir: [`CONTRIBUTING.md`](CONTRIBUTING.md) · Seguridad: [`SECURITY.md`](SECURITY.md)
