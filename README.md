# earthquake-relief-map (AcopioVE)

> **Estado: proyecto cerrado y archivado (octubre 2026).** Código bajo MIT, datos bajo CC-BY-4.0.
> Sin mantenimiento activo. Los servicios en vivo (`acopiove.org`, `api.acopiove.org`) fueron dados de baja.
>
> **EN:** Archived open-source platform built during the 2026 Venezuela earthquake response:
> a directory and API of donation centers, shelters and emergency hotlines (716 centers, 24 countries).
> MIT code, CC-BY-4.0 data. No longer maintained.

Plataforma humanitaria creada para el terremoto de Venezuela de 2026: directorio y API de
centros de acopio, refugios y líneas de emergencia para Venezuela y la diáspora, más un agregador
de búsqueda de personas, capas científicas (USGS, GDACS, satélite), mapa 2D/3D y boletín de prensa con IA.

## Qué hay aquí

- `src/` — app **Next.js 16** (App Router, TypeScript, Tailwind 3) + **PostgreSQL** con Drizzle.
- `data/` — **snapshot final de datos abiertos** (CSV/JSON/GeoJSON, CC-BY-4.0). Ver `data/README.md`.
- `docs/` — arquitectura, seguridad/PII, fuentes de datos, auditorías y el [resumen del proyecto](docs/RESUMEN-PROYECTO.md).
- `scripts/` — deploy, backup, auditoría y gate anti-PII. `deploy/` — unidad systemd de ejemplo.

## Puesta en marcha

```bash
npm install
cp .env.example .env     # mínimo: DATABASE_URL y JWT_SECRET
npm run db:push          # crea las tablas (Drizzle)
npm run db:seed          # crea el superadmin inicial
npm run dev              # http://localhost:4100
```

**Nota:** `npm run build` prerrenderiza páginas que consultan la base, así que necesita un Postgres
accesible (con el esquema ya creado por `db:push`), incluso en CI.

Para reimportar los datos, usa los archivos de `data/` como base. Las integraciones externas
(personas, daños, noticias IA, WhatsApp/correo/Telegram) son opcionales y se apagan sin su clave;
varias dependen de servicios de terceros que pueden haber cambiado o desaparecido.

## Privacidad

Los datos de personas **nunca se persistían**: se consultaban en vivo y se conciliaban en memoria,
con cédulas enmascaradas y sin ubicación de menores. Mantén esas salvaguardas y corre
`npm run check:pii` antes de desplegar. Ver [`docs/SEGURIDAD.md`](docs/SEGURIDAD.md).

## Licencias

- Código: [MIT](LICENSE).
- Datos de `data/`: **CC-BY-4.0** — "Datos: AcopioVE (acopiove.org)".
- Las marcas de terceros (HelpMaps y otras fuentes) pertenecen a sus dueños.

Contribuir: [`CONTRIBUTING.md`](CONTRIBUTING.md).
