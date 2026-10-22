# earthquake-relief-map

**English** | [Español](README.es.md)

> **Status: closed and archived project (October 2026).** MIT code, CC-BY-4.0 data.
> No longer maintained; the live services (`acopiove.org`, `api.acopiove.org`) have been shut down.

## What it is

**AcopioVE** was a humanitarian response platform built during the 2026 Venezuela earthquake.
It solved a concrete problem: relief information was scattered across dozens of groups and sites, and nobody knew
**where to drop off a donation, which shelters were open, or who to call**. AcopioVE collected and verified that
information, published it as open data, and made it searchable by people, apps and bots.

It reached **716 centers in 22 countries** (664 donation centers and 52 shelters), 78 verified emergency hotlines and
a network of 1,878 volunteer interpreters, with coordination for the diaspora.

## What it does

- **Directory and map of donation centers and shelters.** Each point shows what it accepts, what it needs right now,
  opening hours, contact details and when it was last confirmed. Map clusters are colored by **verification
  freshness** (green: confirmed this week · amber: still current · red: not updated), not by count.
- **Filter by supply type and by country**, to guide shipments from the diaspora (water, food, hygiene, medicine…).
- **Public read-only API (`/v1`)** in JSON, GeoJSON and CSV, with rate limiting and edge caching. See [API](#api).
- **People search (family reunification).** Queries the source organizations in parallel and reconciles the
  results in memory, **storing nothing**, with masked national ID numbers and no location data for minors.
- **Scientific and satellite layers:** ShakeMap and aftershocks (USGS), global alerts (GDACS), weather (Open-Meteo),
  damage assessment (Microsoft AI for Good / OCHA HDX) and a 3D viewer of damaged buildings.
- **AI news briefing:** summarizes national and international outlets (BBC Mundo, DW, OCHA, ReliefWeb,
  Efecto Cocuyo…) to counter rumors.
- **Admin panel** with moderation of citizen submissions, roles, and data-update campaigns
  via WhatsApp, email and Telegram.
- **WhatsApp and Telegram bots** that reply with the nearest center or shelter and search for relatives.
- **SEO and accessibility:** server-rendered directories, lightweight for poor connections.

## API

Base: `http://localhost:4100/v1` on your own instance (the public service no longer exists).
Endpoint and parameter names are in Spanish, as in the original API.

| Endpoint | Returns |
|---|---|
| `GET /v1/centros`, `/v1/centros/{id}` | Donation centers and shelters |
| `GET /v1/telefonos` | Emergency hotlines and rescue teams |
| `GET /v1/puntos` | Unified view (donation center, shelter, health, phone) |
| `GET /v1/personas?q=` | Search for reported people, PII-safe |
| `POST /v1/submissions` | Suggest a point (goes into a moderation queue) |
| `GET /v1/meta`, `/v1/openapi.json` | Counts and OpenAPI 3.1 specification |

Filters: `tipo` (type), `estado` (state), `ciudad` (city), `pais` (country), `updatedSince`,
`near=lat,lng&radius=km`, `limit`, `offset`, `format=json|geojson|csv`. Examples in [`examples/`](examples).

```bash
curl 'http://localhost:4100/v1/puntos?tipo=refugio&near=10.49,-66.88&radius=15&limit=3'
```

## Structure

```
apps/web/                  Next.js 16 + PostgreSQL app: website, admin panel and public /v1 API
packages/chat-bots/        WhatsApp/Telegram bots and outbound campaigns (Node, standalone)
packages/news-summarizer/  AI-generated news briefing (Node, standalone)
examples/                  Sample API clients (curl, Node, Python, Leaflet, webhook)
data/                      Final open-data snapshot (CSV/JSON/GeoJSON, CC-BY-4.0)
docs/                      Architecture, security/PII, sources and audits (in Spanish)
scripts/                   Deploy, backup, audit, anti-PII gate and snapshot generator
deploy/                    Sample systemd unit
```

Each app/package has its own `package.json` and lockfile (different TypeScript and Node versions), with no
*workspaces*. From the root, `npm run <dev|build|typecheck|db:push|check:pii>` delegates to `apps/web` and
`npm run install:all` installs everything.

**Stack:** Next.js 16 (App Router, React 19, TypeScript), Tailwind 3, PostgreSQL + Drizzle ORM, MapLibre GL and
Leaflet, JWT auth (`jose`) + bcrypt and role-based access control.

## Getting started

```bash
cp apps/web/.env.example apps/web/.env   # minimum: DATABASE_URL and JWT_SECRET
npm run install:all
npm run db:push          # creates the tables (Drizzle)
npm run db:seed          # initial superadmin
npm run dev              # http://localhost:4100  ·  API at /v1
```

Requires Node 20+ and PostgreSQL. `npm run build` needs a reachable Postgres with the schema already created, even
in CI. The bots and the summarizer are started separately; see each package's README.

External integrations (people search, damage data, AI news, WhatsApp/email/Telegram) are **optional** and turn
off without their key. Several depend on third-party services that may have changed or disappeared.

## Data

[`data/`](data) contains the 716 centers and 78 hotlines as of 2026-10-01 (CSV, JSON, GeoJSON). They may be
out of date: nobody verifies them anymore. They can be regenerated from your own instance with
`scripts/generate-snapshots.sh`. To load them into a new database, use these files as a starting point.

## Privacy

People data was **never persisted**: it was queried live and reconciled in memory, with masked national ID numbers
and no location data for minors. If you deploy it, keep those safeguards and run `npm run check:pii`
before every deployment. See [`docs/SEGURIDAD.md`](docs/SEGURIDAD.md) (in Spanish).

## Licenses

- Code: [MIT](LICENSE). Data in `data/`: **CC-BY-4.0**, attribution "Data: AcopioVE (acopiove.org)".
- Third-party trademarks (HelpMaps and other sources) belong to their owners.

Documentation: [`docs/`](docs/README.md) · Contributing: [`CONTRIBUTING.md`](CONTRIBUTING.md) · Security: [`SECURITY.md`](SECURITY.md)
