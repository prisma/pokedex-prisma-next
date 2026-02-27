# Prisma Next Pokedex Demo

A Pokédex built to showcase **Prisma Next** — a contract-first data access layer for PostgreSQL.

This demo highlights:

- **High-level query interface** — Prisma-like `findMany`, `findUnique`, `createMany`, etc.
- **Low-level query API** — raw SQL plans with CTEs + window functions
- **Contract-first schema** — TypeScript-defined, deterministic, machine-readable

## Quick Start

```bash
bun install
```

Configure `apps/server/.env`:

```bash
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DB_NAME
CORS_ORIGIN=http://localhost:3001
```

Initialize and run:

```bash
bun run db:init
bun run dev
```

- Web: http://localhost:3001
- API: http://localhost:3000

Open the web app and click **Import Pokemon** to seed the database from PokeAPI.

## Important Files

| File | Purpose |
|------|---------|
| `packages/db/prisma/contract.ts` | Prisma Next contract (Pokemon + SpawnPoint) |
| `packages/db/src/prisma/client.ts` | Prisma-like client delegates |
| `packages/db/src/prisma/db.ts` | Runtime bootstrap + connection |
| `packages/api/src/routers/pokedex.ts` | API routes (high-level + low-level queries) |
| `apps/web/src/routes/index.tsx` | Demo UI |

## Query Interface

### High-level (primary)

In `packages/api/src/routers/pokedex.ts`:

- `prisma.pokemon.findMany(...)` with filtering
- `prisma.pokemon.findUnique(...)`
- `prisma.pokemon.createMany(...)`
- `prisma.spawnPoint.findMany(...)` with relation lookups
- `prisma.*.count(...)`

### Low-level (team builder)

Also in `pokedex.ts` — the `teamBuilder` route uses:

- `db.sql.raw` to build a raw execution plan
- `db.runtime().connection().execute(plan)` to run it
- SQL CTEs and window functions (`row_number`, `dense_rank`) for ranked team drafting

## Scripts

- `bun run db:init` — emit contract + initialize schema
- `bun run db:emit` — emit contract artifacts
- `bun run db:verify` — verify marker/contract compatibility
- `bun run dev` — run web + server
