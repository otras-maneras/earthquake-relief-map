# apps/web

Aplicación **Next.js 16** (App Router, TypeScript, Tailwind 3) con **PostgreSQL + Drizzle**.
Incluye el sitio, el panel de administración y la **API pública `/v1`** (`src/app/v1/*`).

```bash
cp .env.example .env     # mínimo: DATABASE_URL y JWT_SECRET
npm ci
npm run db:push          # crea las tablas
npm run db:seed          # superadmin inicial
npm run dev              # http://localhost:4100
```

`npm run build` necesita un Postgres accesible con el esquema creado (prerrenderiza páginas con consultas).
Documentación: [`../../docs`](../../docs).
