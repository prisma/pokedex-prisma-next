import { or } from "@prisma-next/sql-orm-client";
import { createOrmClient, db } from "@pokedex/db";
import { MAX_POKEMON, seedDatabase } from "@pokedex/db/seed";
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
    .handler(async ({ input }) => {
      const client = createOrmClient(db.runtime());
      const pokemon = client.pokemon!;

      let query = pokemon.orderBy((p: any) => p.dexNumber.asc());

      if (input.legendaryOnly) {
        query = query.where({ isLegendary: true });
      }

      if (input.type) {
        query = query.where((p: any) =>
          or(
            p.primaryType.ilike(`%${input.type}%`),
            p.secondaryType.ilike(`%${input.type}%`),
          ),
        );
      }

      if (input.search) {
        query = query.where((p: any) =>
          or(
            p.name.ilike(`%${input.search}%`),
            p.primaryType.ilike(`%${input.search}%`),
            p.secondaryType.ilike(`%${input.search}%`),
          ),
        );
      }

      const withSpawns = query
        // @ts-expect-error — relation types don't resolve with complex contracts
        .include("spawnPoints", (sp: any) => sp);

      const rows = await withSpawns.take(input.limit).all();

      return [...rows];
    }),

  byDexNumber: publicProcedure
    .input(z.object({ dexNumber: z.number().int().min(1).max(9999) }))
    .handler(async ({ input }) => {
      const client = createOrmClient(db.runtime());

      const pokemon = await client.pokemon!
        .where({ dexNumber: input.dexNumber })
        // @ts-expect-error — relation types don't resolve with complex contracts
        .include("spawnPoints", (sp: any) =>
          sp.orderBy((s: any) => s.encounterRate.desc()),
        )
        .find();

      return pokemon ?? null;
    }),

  typeBreakdown: publicProcedure.handler(async () => {
    const client = createOrmClient(db.runtime());

    const allPokemon = await client.pokemon!
      .select("primaryType", "secondaryType", "isLegendary")
      .all();

    const breakdown = new Map<
      string,
      { type: string; total: number; legendary: number }
    >();

    const upsertType = (typeValue: string, isLegendary: boolean) => {
      const existing = breakdown.get(typeValue);
      if (!existing) {
        breakdown.set(typeValue, {
          type: typeValue,
          total: 1,
          legendary: isLegendary ? 1 : 0,
        });
        return;
      }

      existing.total += 1;
      if (isLegendary) {
        existing.legendary += 1;
      }
    };

    for (const row of allPokemon) {
      upsertType(row.primaryType, row.isLegendary);
      if (row.secondaryType) {
        upsertType(row.secondaryType, row.isLegendary);
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
      const filterType = input.type?.trim().toLowerCase() || null;
      const kysely = db.kysely(db.runtime()) as any;

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
        query = query.where((eb: any) =>
          eb.or([
            eb(eb.fn("lower", ["primaryType"]), "=", filterType),
            eb(eb.fn("lower", ["secondaryType"]), "=", filterType),
          ]),
        );
      }

      const rows: any[] = await query.execute();

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
