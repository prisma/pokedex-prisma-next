# Prisma Next Pokedex Demo

A full-stack Pokédex built to showcase **Prisma Next** in a realistic app flow.

This demo intentionally highlights:

- **High-level query interface** for most application logic (main focus)
- **Low-level query API** for one targeted case
- **PostGIS** extension for geospatial spawn lookups

## What This Showcases

- Prisma Next contract-first schema in `packages/db/prisma/contract.ts`
- High-level model queries via the Prisma-like interface in `@pokedex/db`
- Low-level raw plan execution with `db.sql.raw` + `runtime.execute(...)`
- PostGIS functions: `ST_DWithin` and `ST_DistanceSphere`

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

3. Initialize database + PostGIS

```bash
bun run db:init
```

This runs:

- contract emit
- `prisma-next db init`
- `CREATE EXTENSION IF NOT EXISTS postgis`

4. Start the app

```bash
bun run dev
```

- Web: [http://localhost:3001](http://localhost:3001)
- Server/API: [http://localhost:3000](http://localhost:3000)

5. Open **Pokedex** in the top nav and click **Seed Demo**.

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

- `packages/api/src/routers/pokedex.ts` (`nearestSpawns` route)

Uses:

- `db.sql.raw` to build a raw execution plan
- `db.runtime().execute(plan)` to run it
- PostGIS spatial functions for distance/radius search

## PostGIS Usage

PostGIS is enabled by:

- `packages/db/scripts/ensure-postgis.ts`
- `db:init` script in `packages/db/package.json`

Geospatial query (demo endpoint):

- `ST_DWithin(...::geography, ...::geography, radiusMeters)`
- `ST_DistanceSphere(pointA, pointB)`

## Important Files

- `packages/db/prisma/contract.ts` - Prisma Next contract (Pokemon + SpawnPoint models)
- `packages/db/scripts/ensure-postgis.ts` - extension bootstrap
- `packages/db/src/index.ts` - runtime + high-level interface bridge
- `packages/api/src/routers/pokedex.ts` - demo API surface
- `apps/web/src/routes/pokedex.tsx` - demo UI

## Useful Scripts

- `bun run db:emit` - emit contract artifacts
- `bun run db:init` - init DB and ensure PostGIS
- `bun run db:verify` - verify marker/contract compatibility
- `bun run db:postgis` - manually ensure PostGIS only
- `bun run dev` - run web + server

## Notes

- This is a demo app designed for readability and query-surface clarity.
- If your Postgres provider disallows `CREATE EXTENSION`, pre-enable PostGIS on the database.
