import { or } from "@prisma-next/sql-orm-client";
import { createOrmClient, db } from "@pokedex/db";
import { MAX_POKEMON, seedDatabase } from "@pokedex/db/prisma/seed";
import z from "zod";

import { publicProcedure } from "../index";

const seedSchema = z.object({
  forceReset: z.boolean().default(false),
  limit: z.number().int().min(1).max(MAX_POKEMON).default(MAX_POKEMON),
});

const listPokemonSchema = z.object({
  search: z.string().trim().min(1).max(32).optional(),
  type: z.string().trim().min(1).max(20).optional(),
  legendaryOnly: z.boolean().default(false),
  limit: z.number().int().min(1).max(1200).default(1200),
  delayMs: z.number().int().min(0).max(100).default(0),
});

const teamBuilderSchema = z.object({
  type: z.string().trim().min(1).max(20).optional(),
});

export const pokedexRouter = {
  importPokemon: publicProcedure
    .input(seedSchema)
    .handler(async ({ input }) => seedDatabase(input.limit, input.forceReset)),

  // ──────────────────────────────────────────────────────────────────
  // Feature: Streaming
  // .all() returns an AsyncIterable — use `for await...of` to yield
  // rows one-by-one to the client as they arrive from the database.
  // Prisma 7 has no streaming support.
  // ──────────────────────────────────────────────────────────────────
  listPokemon: publicProcedure
    .input(listPokemonSchema)
    .handler(async function* ({ input }) {
      const client = createOrmClient(db.runtime());

      // .orderBy() takes a callback with typed column accessors
      let query = client.pokemon!.orderBy((p) => p.dexNumber.asc());

      // .where() accepts an object for simple equality filters
      if (input.legendaryOnly) {
        query = query.where({ isLegendary: true });
      }

      // .where() also accepts a callback for complex filters with or()
      if (input.type) {
        query = query.where((p) =>
          or(
            p.primaryType.ilike(`%${input.type}%`),
            p.secondaryType.ilike(`%${input.type}%`),
          ),
        );
      }

      if (input.search) {
        query = query.where((p) =>
          or(
            p.name.ilike(`%${input.search}%`),
            p.primaryType.ilike(`%${input.search}%`),
            p.secondaryType.ilike(`%${input.search}%`),
          ),
        );
      }

      // .include() eagerly loads a relation, .take() limits rows,
      // .all() returns an AsyncIterable we can stream with yield
      const delayMs = input.delayMs;
      for await (const row of query
        .include("spawnPoints", (sp) => sp)
        .take(input.limit)
        .all()) {
        yield row;
        if (delayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }),

  // ──────────────────────────────────────────────────────────────────
  // Feature: Custom collection scopes
  // .byDexNumber() is a custom method on PokemonCollection (see db/src/index.ts).
  // Scopes are reusable query fragments — like Rails scopes.
  // Prisma 7 has no equivalent pattern.
  // ──────────────────────────────────────────────────────────────────
  byDexNumber: publicProcedure
    .input(z.object({ dexNumber: z.number().int().min(1).max(9999) }))
    .handler(async ({ input }) => {
      const client = createOrmClient(db.runtime());

      // .byDexNumber() is a custom scope, .include() loads the relation,
      // .find() returns a single result (or undefined)
      return await client
        .pokemon!.byDexNumber(input.dexNumber)
        .include("spawnPoints", (sp) =>
          sp.orderBy((s) => s.encounterRate.desc()),
        )
        .find();
    }),

  // ──────────────────────────────────────────────────────────────────
  // Feature: groupBy().aggregate()
  // Type-safe aggregation without raw SQL. Chain .groupBy() with
  // .aggregate() to get counts, sums, etc. grouped by column.
  // .legendary() is a custom scope that adds .where({isLegendary: true}).
  // ──────────────────────────────────────────────────────────────────
  typeBreakdown: publicProcedure.handler(async () => {
    const client = createOrmClient(db.runtime());
    const pokemon = client.pokemon!;

    // Run 4 aggregations in parallel: total + legendary counts for both type columns
    const [primaryTotal, primaryLegendary, secondaryTotal, secondaryLegendary] =
      await Promise.all([
        pokemon.groupBy("primaryType").aggregate((agg) => ({
          total: agg.count(),
        })),
        pokemon
          .legendary() // custom scope: .where({ isLegendary: true })
          .groupBy("primaryType")
          .aggregate((agg) => ({ legendary: agg.count() })),
        pokemon.groupBy("secondaryType").aggregate((agg) => ({
          total: agg.count(),
        })),
        pokemon
          .legendary()
          .groupBy("secondaryType")
          .aggregate((agg) => ({ legendary: agg.count() })),
      ]);

    // Merge primary + secondary type counts into a single map
    const breakdown = new Map<
      string,
      { type: string; total: number; legendary: number }
    >();

    const merge = (type: string | null, total: number, legendary: number) => {
      if (type == null) return;
      const existing = breakdown.get(type);
      if (existing) {
        existing.total += total;
        existing.legendary += legendary;
      } else {
        breakdown.set(type, { type, total, legendary });
      }
    };

    for (const row of primaryTotal) merge(row.primaryType, row.total, 0);
    for (const row of secondaryTotal) merge(row.secondaryType, row.total, 0);
    for (const row of primaryLegendary) merge(row.primaryType, 0, row.legendary);
    for (const row of secondaryLegendary) merge(row.secondaryType, 0, row.legendary);

    return Array.from(breakdown.values()).sort(
      (a, b) => b.total - a.total || a.type.localeCompare(b.type),
    );
  }),

  // ──────────────────────────────────────────────────────────────────
  // Feature: Kysely escape hatch
  // db.kysely() gives a fully typed Kysely instance derived from the
  // Prisma Next contract — write raw SQL DSL when the ORM isn't enough.
  // Unlike $queryRaw, Kysely queries are type-checked.
  // ──────────────────────────────────────────────────────────────────
  teamBuilder: publicProcedure
    .input(teamBuilderSchema)
    .handler(async ({ input }) => {
      const trimmed = input.type?.trim() || null;
      const filterType = trimmed
        ? trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase()
        : null;

      // db.kysely() returns a Kysely instance typed from the contract schema
      const kysely = db.kysely(db.runtime());

      let query = kysely
        .selectFrom("pokemon")
        .select([
          "dexNumber",
          "name",
          "primaryType",
          "secondaryType",
          "hp",
          "attack",
          "defense",
          "speed",
          "isLegendary",
        ]);

      if (filterType) {
        query = query.where((eb) =>
          eb.or([
            eb("primaryType", "=", filterType),
            eb("secondaryType", "=", filterType),
          ]),
        );
      }

      const rows = await query.execute();

      const withStats = rows.map((row) => ({
        ...row,
        totalStats: row.hp + row.attack + row.defense + row.speed,
      }));

      // Pick top 2 per primaryType by totalStats, then top 6 overall
      const sorted = withStats.sort((a, b) => b.totalStats - a.totalStats);
      const countByType = new Map<string, number>();
      const team = [];

      for (const row of sorted) {
        const count = countByType.get(row.primaryType) ?? 0;
        if (count < 2) {
          team.push(row);
          countByType.set(row.primaryType, count + 1);
          if (team.length >= 6) break;
        }
      }

      return team;
    }),
};
