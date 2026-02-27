# `@pokedex/db` Structure

This package is split so Prisma Next files are easy to find:

Structure follows the same separation used in Prisma Next examples: runtime setup and ORM client logic are kept in separate modules.

- `prisma/contract.ts`
  Source-of-truth contract definition (tables, models, relations).
- `prisma-next.config.ts`
  Prisma Next config used by the CLI.
- `prisma/generated/`
  Emitted artifacts from `prisma-next contract emit`:
  - `contract.json`
  - `contract.d.ts`
- `src/prisma/db.ts`
  Prisma Next runtime bootstrap (`db`) and connection lifecycle helper.
- `src/prisma/query.ts`
  Where/select/include/orderBy translation for Prisma-style query args.
- `src/prisma/client.ts`
  Prisma-style model delegates (`findMany`, `create`, `update`, etc.).
- `src/index.ts`
  Small package entrypoint that exports `db`, `ensureDbConnected`, and default `prisma`.

## Common Commands

From repo root:

```bash
bun run db:emit
bun run db:init
bun run db:verify
```
