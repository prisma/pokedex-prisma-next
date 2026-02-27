# Prisma Next Pokedex Demo

A full-stack Pokédex built to showcase **Prisma Next** in a realistic app flow.

This demo intentionally highlights:

- **High-level query interface** for most application logic (main focus)
- **Low-level query API** for one targeted case
- **Standard PostgreSQL** compatibility (no database extensions required)

## What This Showcases

- Prisma Next contract-first schema in `packages/db/prisma/contract.ts`
- High-level model queries via the Prisma-like interface in `@pokedex/db`
- Low-level raw plan execution with `db.sql.raw` + `runtime.execute(...)`
- Team Builder Analyzer using SQL CTEs + window functions

## Quick Start

1. Install dependencies

```bash
bun install
```

2. Configure environment variables in `apps/server/.env`

Required:

- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `CORS_ORIGIN`

3. Initialize database

```bash
bun run db:init
```

This emits `prisma/generated/contract.json` from `packages/db/prisma/contract.ts`, then runs `prisma-next db init`.

4. Start the app

```bash
bun run dev
```

- Web: [http://localhost:3001](http://localhost:3001)
- Server/API: [http://localhost:3000](http://localhost:3000)

5. Open [http://localhost:3001](http://localhost:3001) and click **Import Pokemon**.

## Run The App

From the project root:

```bash
cd /Users/aman/dev/test/pokedex
bun install
bun run db:init
bun run dev
```

Then open:

- Web app: [http://localhost:3001](http://localhost:3001)
- API server: [http://localhost:3000](http://localhost:3000)

### Environment File Example

Create `apps/server/.env` with:

```bash
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DB_NAME
BETTER_AUTH_SECRET=replace_with_a_long_secret
BETTER_AUTH_URL=http://localhost:3000
CORS_ORIGIN=http://localhost:3001
```

### Common Setup Issue

If `bun run db:init` fails with `PN-RTM-3000` / marker mismatch, your target DB already has a different Prisma Next marker.

Use a fresh empty database (recommended) and run:

```bash
bun run db:init
```

If you want to reuse the same database, clear only the Prisma Next marker schema, then re-run init:

```bash
cd /Users/aman/dev/test/pokedex/packages/db
bun -e 'import dotenv from "dotenv"; import path from "node:path"; import { Pool } from "pg"; dotenv.config({ path: path.join("..","..","apps","server",".env") }); const pool = new Pool({ connectionString: process.env.DATABASE_URL }); await pool.query("DROP SCHEMA IF EXISTS prisma_contract CASCADE;"); await pool.end(); console.log("Dropped prisma_contract schema");'
cd /Users/aman/dev/test/pokedex
bun run db:init
```

## Query Interface Breakdown

### High-level interface (primary)

Main logic lives in:

- `packages/api/src/routers/pokedex.ts`

Examples:

- `prisma.pokemon.findMany(...)` with filtering + includes
- `prisma.pokemon.findUnique(...)`
- `prisma.pokemon.createMany(...)`
- `prisma.spawnPoint.createMany(...)`
- `prisma.*.count(...)`

### Low-level interface (targeted demo)

Also in:

- `packages/api/src/routers/pokedex.ts` (`teamBuilder` route)

Uses:

- `db.sql.raw` to build a raw execution plan
- `db.runtime().connection().execute(plan)` to run it
- SQL CTEs and window functions (`row_number`, `dense_rank`) for ranked team drafting

## Important Files

- `packages/db/prisma/contract.ts` - Prisma Next contract (Pokemon + SpawnPoint models)
- `packages/db/prisma-next.config.ts` - Prisma Next config
- `packages/db/prisma/generated/*` - emitted contract artifacts used by runtime (`contract.json`, `contract.d.ts`)
- `packages/db/src/prisma/db.ts` - runtime bootstrap + connection helper
- `packages/db/src/prisma/*` - Prisma-style client delegate internals (`client.ts`, `query.ts`, etc.)
- `packages/db/src/index.ts` - package entrypoint exports (`db`, `ensureDbConnected`, default `prisma`)
- `packages/api/src/routers/pokedex.ts` - demo API surface
- `apps/web/src/routes/index.tsx` - demo UI (main page)

## Useful Scripts

- `bun run db:emit` - emit contract artifacts
- `bun run db:init` - initialize schema and marker
- `bun run db:verify` - verify marker/contract compatibility
- `bun run dev` - run web + server

## Notes

- This is a demo app designed for readability and query-surface clarity.
- No PostGIS or other extensions are required.
