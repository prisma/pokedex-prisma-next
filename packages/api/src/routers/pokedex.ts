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

  listPokemon: publicProcedure
    .input(listPokemonSchema)
    .handler(async function* ({ input }) {
      const client = createOrmClient(db.runtime());
      let query = client.pokemon!.orderBy((p) => p.dexNumber.asc());

      if (input.legendaryOnly) {
        query = query.where({ isLegendary: true });
      }

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

  byDexNumber: publicProcedure
    .input(z.object({ dexNumber: z.number().int().min(1).max(9999) }))
    .handler(async ({ input }) => {
      const client = createOrmClient(db.runtime());

      const pokemon = await client
        .pokemon!.byDexNumber(input.dexNumber)
        .include("spawnPoints", (sp) =>
          sp.orderBy((s) => s.encounterRate.desc()),
        )
        .find();

      return pokemon ?? null;
    }),

  typeBreakdown: publicProcedure.handler(async () => {
    const client = createOrmClient(db.runtime());
    const pokemon = client.pokemon!;

    const [primaryTotal, primaryLegendary, secondaryTotal, secondaryLegendary] =
      await Promise.all([
        pokemon.groupBy("primaryType").aggregate((agg) => ({
          total: agg.count(),
        })),
        pokemon
          .where({ isLegendary: true })
          .groupBy("primaryType")
          .aggregate((agg) => ({ legendary: agg.count() })),
        pokemon.groupBy("secondaryType").aggregate((agg) => ({
          total: agg.count(),
        })),
        pokemon
          .where({ isLegendary: true })
          .groupBy("secondaryType")
          .aggregate((agg) => ({ legendary: agg.count() })),
      ]);

    const breakdown = new Map<
      string,
      { type: string; total: number; legendary: number }
    >();

    const merge = (type: string, total: number, legendary: number) => {
      const existing = breakdown.get(type);
      if (existing) {
        existing.total += total;
        existing.legendary += legendary;
      } else {
        breakdown.set(type, { type, total, legendary });
      }
    };

    for (const row of primaryTotal) {
      merge(row.primaryType, row.total, 0);
    }
    for (const row of primaryLegendary) {
      const existing = breakdown.get(row.primaryType);
      if (existing) existing.legendary = row.legendary;
    }
    for (const row of secondaryTotal) {
      if (row.secondaryType != null) {
        merge(row.secondaryType, row.total, 0);
      }
    }
    for (const row of secondaryLegendary) {
      if (row.secondaryType != null) {
        const existing = breakdown.get(row.secondaryType);
        if (existing) existing.legendary += row.legendary;
      }
    }

    return Array.from(breakdown.values()).sort((a, b) => {
      if (b.total !== a.total) {
        return b.total - a.total;
      }
      return a.type.localeCompare(b.type);
    });
  }),

  teamBuilder: publicProcedure
    .input(teamBuilderSchema)
    .handler(async ({ input }) => {
      const trimmed = input.type?.trim() || null;
      const filterType = trimmed
        ? trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase()
        : null;
      const runtime = db.runtime();
      const kysely = db.kysely(runtime);

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

      // Pick top 2 per primaryType by totalStats, then top 6 overall.
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
