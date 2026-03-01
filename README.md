# Prisma Next Pokedex Demo

A Pokédex built to showcase **Prisma Next** — a contract-first data access layer for PostgreSQL.

## Highlights

- **ORM collections with custom scopes** — chainable `.where()`, `.include()`, `.orderBy()`, reusable query fragments like `.legendary()` and `.search()`
- **Streaming** — `.all()` returns an `AsyncIterable`, stream rows to the client as they arrive
- **Type-safe aggregations** — `.groupBy().aggregate()` without raw SQL
- **Kysely escape hatch** — `db.kysely()` gives a fully typed Kysely instance derived from the contract
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

## Project Structure

```
apps/
  server/          Hono + oRPC API server
  web/             React + TanStack Router frontend
packages/
  api/             API router definitions (oRPC procedures)
  db/              Prisma Next contract, runtime, ORM collections, seed
  config/          Shared TypeScript config
```

## Important Files

| File | Purpose |
|------|---------|
| `packages/db/src/prisma/contract.ts` | Prisma Next contract (Pokemon + SpawnPoint tables, models, relations) |
| `packages/db/src/prisma/db.ts` | Runtime bootstrap + connection |
| `packages/db/src/index.ts` | ORM collections with custom scopes (`PokemonCollection`, `SpawnPointCollection`) |
| `packages/db/src/prisma/seed.ts` | Seed script — fetches from PokeAPI, bulk inserts with `createCount()` |
| `packages/api/src/routers/pokedex.ts` | API routes showcasing each Prisma Next feature |

## Features Demonstrated

### ORM Collections with Custom Scopes

Defined in `packages/db/src/index.ts`. Collections are reusable, composable query builders — like Rails scopes:

```typescript
class PokemonCollection extends Collection<Contract, "Pokemon"> {
  legendary()    { return this.where({ isLegendary: true }); }
  byType(type)   { return this.where((p) => or(p.primaryType.ilike(...), ...)); }
  search(term)   { return this.where((p) => or(p.name.ilike(...), ...)); }
}
```

### Streaming

`listPokemon` in `pokedex.ts` streams rows with `for await...of`:

```typescript
for await (const row of query.include("spawnPoints", (sp) => sp).take(limit).all()) {
  yield row;
}
```

### groupBy + aggregate

`typeBreakdown` runs type-safe aggregations without raw SQL:

```typescript
pokemon.groupBy("primaryType").aggregate((agg) => ({ total: agg.count() }))
```

### Kysely Escape Hatch

`teamBuilder` uses `db.kysely()` for a fully typed Kysely query when the ORM isn't enough:

```typescript
const kysely = db.kysely(db.runtime());
kysely.selectFrom("pokemon").select([...]).where(...).execute();
```

## Scripts

| Script | Description |
|--------|-------------|
| `bun run dev` | Run web + server |
| `bun run db:init` | Emit contract + initialize schema |
| `bun run db:emit` | Emit contract artifacts |
| `bun run db:push` | Push schema to database |
| `bun run db:verify` | Verify marker/contract compatibility |
| `bun run db:studio` | Open Prisma Studio |
