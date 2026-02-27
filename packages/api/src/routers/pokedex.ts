import prisma, { db, ensureDbConnected } from "@pokedex/db";
import z from "zod";

import { publicProcedure } from "../index";

type DemoPokemon = {
  dexNumber: number;
  name: string;
  primaryType: string;
  secondaryType: string | null;
  hp: number;
  attack: number;
  defense: number;
  speed: number;
  spriteUrl: string;
  isLegendary: boolean;
};

type DemoSpawnPoint = {
  dexNumber: number;
  label: string;
  region: string;
  latitude: number;
  longitude: number;
  encounterRate: number;
};

type SpawnPointRow = {
  id: number;
  pokemonId: number;
  label: string;
  region: string;
  latitude: number;
  longitude: number;
  encounterRate: number;
  createdAt?: string;
};

const DEMO_POKEMON: DemoPokemon[] = [
  {
    dexNumber: 1,
    name: "Bulbasaur",
    primaryType: "Grass",
    secondaryType: "Poison",
    hp: 45,
    attack: 49,
    defense: 49,
    speed: 45,
    spriteUrl:
      "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/1.png",
    isLegendary: false,
  },
  {
    dexNumber: 4,
    name: "Charmander",
    primaryType: "Fire",
    secondaryType: null,
    hp: 39,
    attack: 52,
    defense: 43,
    speed: 65,
    spriteUrl:
      "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/4.png",
    isLegendary: false,
  },
  {
    dexNumber: 6,
    name: "Charizard",
    primaryType: "Fire",
    secondaryType: "Flying",
    hp: 78,
    attack: 84,
    defense: 78,
    speed: 100,
    spriteUrl:
      "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/6.png",
    isLegendary: false,
  },
  {
    dexNumber: 7,
    name: "Squirtle",
    primaryType: "Water",
    secondaryType: null,
    hp: 44,
    attack: 48,
    defense: 65,
    speed: 43,
    spriteUrl:
      "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/7.png",
    isLegendary: false,
  },
  {
    dexNumber: 25,
    name: "Pikachu",
    primaryType: "Electric",
    secondaryType: null,
    hp: 35,
    attack: 55,
    defense: 40,
    speed: 90,
    spriteUrl:
      "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/25.png",
    isLegendary: false,
  },
  {
    dexNumber: 94,
    name: "Gengar",
    primaryType: "Ghost",
    secondaryType: "Poison",
    hp: 60,
    attack: 65,
    defense: 60,
    speed: 110,
    spriteUrl:
      "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/94.png",
    isLegendary: false,
  },
  {
    dexNumber: 131,
    name: "Lapras",
    primaryType: "Water",
    secondaryType: "Ice",
    hp: 130,
    attack: 85,
    defense: 80,
    speed: 60,
    spriteUrl:
      "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/131.png",
    isLegendary: false,
  },
  {
    dexNumber: 149,
    name: "Dragonite",
    primaryType: "Dragon",
    secondaryType: "Flying",
    hp: 91,
    attack: 134,
    defense: 95,
    speed: 80,
    spriteUrl:
      "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/149.png",
    isLegendary: false,
  },
  {
    dexNumber: 150,
    name: "Mewtwo",
    primaryType: "Psychic",
    secondaryType: null,
    hp: 106,
    attack: 110,
    defense: 90,
    speed: 130,
    spriteUrl:
      "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/150.png",
    isLegendary: true,
  },
  {
    dexNumber: 151,
    name: "Mew",
    primaryType: "Psychic",
    secondaryType: null,
    hp: 100,
    attack: 100,
    defense: 100,
    speed: 100,
    spriteUrl:
      "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/151.png",
    isLegendary: true,
  },
];

const DEMO_SPAWN_POINTS: DemoSpawnPoint[] = [
  {
    dexNumber: 1,
    label: "Botanical Loop",
    region: "Golden Gate Park",
    latitude: 37.7694,
    longitude: -122.4862,
    encounterRate: 79,
  },
  {
    dexNumber: 4,
    label: "Desert Trailhead",
    region: "Papago Park",
    latitude: 33.4588,
    longitude: -111.9495,
    encounterRate: 71,
  },
  {
    dexNumber: 6,
    label: "Observatory Ridge",
    region: "Los Angeles",
    latitude: 34.1184,
    longitude: -118.3004,
    encounterRate: 54,
  },
  {
    dexNumber: 7,
    label: "Harbor Deck",
    region: "Chicago Waterfront",
    latitude: 41.8917,
    longitude: -87.6078,
    encounterRate: 77,
  },
  {
    dexNumber: 25,
    label: "Neon Plaza",
    region: "Times Square",
    latitude: 40.758,
    longitude: -73.9855,
    encounterRate: 88,
  },
  {
    dexNumber: 94,
    label: "Old Quarter Alley",
    region: "New Orleans",
    latitude: 29.9584,
    longitude: -90.0644,
    encounterRate: 63,
  },
  {
    dexNumber: 131,
    label: "Fog Pier",
    region: "Seattle Waterfront",
    latitude: 47.6073,
    longitude: -122.3426,
    encounterRate: 67,
  },
  {
    dexNumber: 149,
    label: "Summit Outlook",
    region: "Rocky Mountain",
    latitude: 40.3428,
    longitude: -105.6836,
    encounterRate: 42,
  },
  {
    dexNumber: 150,
    label: "Restricted Airspace",
    region: "Nevada Test Range",
    latitude: 37.235,
    longitude: -115.8111,
    encounterRate: 16,
  },
  {
    dexNumber: 151,
    label: "Hidden Garden",
    region: "Honolulu",
    latitude: 21.3069,
    longitude: -157.8583,
    encounterRate: 11,
  },
];

function normalizeNumber(value: unknown): number {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function buildPokemonWhere(input: {
  search?: string | undefined;
  type?: string | undefined;
  legendaryOnly: boolean;
}) {
  const filters: unknown[] = [];

  if (input.legendaryOnly) {
    filters.push({ isLegendary: true });
  }

  if (input.type) {
    filters.push({
      OR: [
        { primaryType: { contains: input.type, mode: "insensitive" } },
        { secondaryType: { contains: input.type, mode: "insensitive" } },
      ],
    });
  }

  if (input.search) {
    filters.push({
      OR: [
        { name: { contains: input.search, mode: "insensitive" } },
        { primaryType: { contains: input.search, mode: "insensitive" } },
        { secondaryType: { contains: input.search, mode: "insensitive" } },
      ],
    });
  }

  if (filters.length === 0) {
    return undefined;
  }

  if (filters.length === 1) {
    return filters[0];
  }

  return { AND: filters };
}

async function executeLowLevelPlan<Row>(plan: unknown): Promise<Row[]> {
  await ensureDbConnected();

  const connection = await db.runtime().connection();
  try {
    return (await connection.execute(plan as never).toArray()) as Row[];
  } finally {
    await connection.release();
  }
}

async function withSpawnPoints<T extends { id: number }>(
  pokemonRows: T[],
): Promise<Array<T & { spawnPoints: SpawnPointRow[] }>> {
  if (pokemonRows.length === 0) {
    return [];
  }

  const pokemonIds = pokemonRows.map((pokemon) => pokemon.id);
  const spawnPoints = (await prisma.spawnPoint.findMany({
    where: {
      pokemonId: {
        in: pokemonIds,
      },
    },
    orderBy: [{ encounterRate: "desc" }],
  })) as SpawnPointRow[];

  const spawnPointsByPokemonId = new Map<number, SpawnPointRow[]>();
  for (const spawnPoint of spawnPoints) {
    const existing = spawnPointsByPokemonId.get(spawnPoint.pokemonId);
    if (existing) {
      existing.push(spawnPoint);
      continue;
    }
    spawnPointsByPokemonId.set(spawnPoint.pokemonId, [spawnPoint]);
  }

  return pokemonRows.map((pokemon) => ({
    ...pokemon,
    spawnPoints: spawnPointsByPokemonId.get(pokemon.id) ?? [],
  }));
}

const seedSchema = z.object({
  forceReset: z.boolean().default(false),
});

const listPokemonSchema = z.object({
  search: z.string().trim().min(1).max(32).optional(),
  type: z.string().trim().min(1).max(20).optional(),
  legendaryOnly: z.boolean().default(false),
  limit: z.number().int().min(1).max(30).default(30),
});

const teamBuilderSchema = z.object({
  battleStyle: z
    .enum(["balanced", "offense", "defense", "speed"])
    .default("balanced"),
  preferredType: z.string().trim().min(1).max(20).optional(),
  allowLegendary: z.boolean().default(false),
  limit: z.number().int().min(3).max(6).default(6),
});

export const pokedexRouter = {
  seedDemo: publicProcedure.input(seedSchema).handler(async ({ input }) => {
    const pokemonCount = await prisma.pokemon.count();

    if (pokemonCount > 0 && !input.forceReset) {
      return {
        seeded: false,
        pokemonCount,
        spawnPointCount: await prisma.spawnPoint.count(),
        message: "Demo data already exists. Pass forceReset=true to reseed.",
      };
    }

    if (pokemonCount > 0) {
      await prisma.spawnPoint.deleteMany();
      await prisma.pokemon.deleteMany();
    }

    await prisma.pokemon.createMany({
      data: DEMO_POKEMON,
    });

    const idMapRows = await prisma.pokemon.findMany({
      select: {
        id: true,
        dexNumber: true,
      },
    });

    const pokemonIdByDexNumber = new Map<number, number>(
      idMapRows.map((row: { id: number; dexNumber: number }) => [
        row.dexNumber,
        row.id,
      ]),
    );

    const spawnPointRows = DEMO_SPAWN_POINTS.map((spawn) => {
      const pokemonId = pokemonIdByDexNumber.get(spawn.dexNumber);
      if (!pokemonId) {
        throw new Error(
          `Missing seeded pokemon for dexNumber ${spawn.dexNumber}`,
        );
      }

      return {
        pokemonId,
        label: spawn.label,
        region: spawn.region,
        latitude: spawn.latitude,
        longitude: spawn.longitude,
        encounterRate: spawn.encounterRate,
      };
    });

    await prisma.spawnPoint.createMany({
      data: spawnPointRows,
    });

    return {
      seeded: true,
      pokemonCount: DEMO_POKEMON.length,
      spawnPointCount: spawnPointRows.length,
      message: "Pokedex demo data is ready.",
    };
  }),

  listPokemon: publicProcedure
    .input(listPokemonSchema)
    .handler(async ({ input }) => {
      const where = buildPokemonWhere(input);

      const pokemonRows = await prisma.pokemon.findMany({
        where,
        orderBy: [{ dexNumber: "asc" }],
        take: input.limit,
      });

      return await withSpawnPoints(pokemonRows as Array<{ id: number }>);
    }),

  byDexNumber: publicProcedure
    .input(z.object({ dexNumber: z.number().int().min(1).max(9999) }))
    .handler(async ({ input }) => {
      const pokemon = await prisma.pokemon.findUnique({
        where: {
          dexNumber: input.dexNumber,
        },
      });

      if (!pokemon) {
        return null;
      }

      const [pokemonWithSpawnPoints] = await withSpawnPoints([
        pokemon as { id: number },
      ]);
      return pokemonWithSpawnPoints ?? null;
    }),

  typeBreakdown: publicProcedure.handler(async () => {
    const pokemon = await prisma.pokemon.findMany({
      select: {
        primaryType: true,
        secondaryType: true,
        isLegendary: true,
      },
      orderBy: [{ dexNumber: "asc" }],
    });

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

    for (const row of pokemon as Array<{
      primaryType: string;
      secondaryType: string | null;
      isLegendary: boolean;
    }>) {
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
      const preferredType = input.preferredType?.trim().toLowerCase() || null;
      const hasPreferredType = preferredType !== null;
      const preferredTypeValue = preferredType ?? "";

      // Low-level raw SQL plan that uses CTEs + window functions to generate a balanced team draft.
      const plan = db.sql.raw`
      WITH candidate_pool AS (
        SELECT
          p.id,
          p."dexNumber",
          p.name,
          p."primaryType",
          p."secondaryType",
          p.hp,
          p.attack,
          p.defense,
          p.speed,
          p."isLegendary",
          (
            CASE
              WHEN ${input.battleStyle} = 'offense' THEN p.attack * 0.48 + p.speed * 0.27 + p.hp * 0.15 + p.defense * 0.10
              WHEN ${input.battleStyle} = 'defense' THEN p.defense * 0.45 + p.hp * 0.30 + p.attack * 0.15 + p.speed * 0.10
              WHEN ${input.battleStyle} = 'speed' THEN p.speed * 0.50 + p.attack * 0.25 + p.hp * 0.15 + p.defense * 0.10
              ELSE (p.attack + p.defense + p.speed + p.hp) / 4.0
            END
          ) AS "battleScore",
          CASE
            WHEN p.speed >= p.attack AND p.speed >= p.defense THEN 'Closer'
            WHEN p.defense >= p.attack AND p.defense >= p.speed THEN 'Tank'
            ELSE 'Bruiser'
          END AS "teamRole"
        FROM "pokemon" p
        WHERE (${input.allowLegendary} = TRUE OR p."isLegendary" = FALSE)
          AND (
            ${hasPreferredType} = FALSE
            OR lower(p."primaryType") = ${preferredTypeValue}
            OR lower(coalesce(p."secondaryType", '')) = ${preferredTypeValue}
          )
      ),
      ranked AS (
        SELECT
          cp.*,
          row_number() OVER (
            PARTITION BY cp."primaryType"
            ORDER BY cp."battleScore" DESC, cp.speed DESC, cp.attack DESC
          ) AS "typeRank",
          dense_rank() OVER (
            ORDER BY cp."battleScore" DESC
          ) AS "overallRank"
        FROM candidate_pool cp
      ),
      team AS (
        SELECT *
        FROM ranked
        WHERE "typeRank" <= 2
        ORDER BY "battleScore" DESC, speed DESC, attack DESC
        LIMIT ${input.limit}
      )
      SELECT
        t.*,
        (
          SELECT count(DISTINCT t2."primaryType")
          FROM team t2
        ) AS "uniquePrimaryTypes"
      FROM team t
      ORDER BY t."battleScore" DESC, t.speed DESC, t.attack DESC;
    `;

      const rows = (await executeLowLevelPlan(plan)) as Array<{
        id: number;
        dexNumber: number;
        name: string;
        primaryType: string;
        secondaryType: string | null;
        hp: number;
        attack: number;
        defense: number;
        speed: number;
        isLegendary: boolean;
        battleScore: number | string;
        teamRole: string;
        typeRank: number | string;
        overallRank: number | string;
        uniquePrimaryTypes: number | string;
      }>;

      const picks = rows.map((row) => ({
        id: row.id,
        dexNumber: row.dexNumber,
        name: row.name,
        primaryType: row.primaryType,
        secondaryType: row.secondaryType,
        hp: row.hp,
        attack: row.attack,
        defense: row.defense,
        speed: row.speed,
        isLegendary: row.isLegendary,
        battleScore: Number(normalizeNumber(row.battleScore).toFixed(1)),
        teamRole: row.teamRole,
        typeRank: Math.round(normalizeNumber(row.typeRank)),
        overallRank: Math.round(normalizeNumber(row.overallRank)),
      }));

      const typeCoverage = new Set<string>();
      for (const pick of picks) {
        typeCoverage.add(pick.primaryType);
        if (pick.secondaryType) {
          typeCoverage.add(pick.secondaryType);
        }
      }

      return {
        summary: {
          battleStyle: input.battleStyle,
          preferredType,
          requestedSize: input.limit,
          generatedSize: picks.length,
          uniquePrimaryTypes: rows[0]
            ? Math.round(normalizeNumber(rows[0].uniquePrimaryTypes))
            : 0,
          averageBattleScore:
            picks.length === 0
              ? 0
              : Number(
                  (
                    picks.reduce((total, pick) => total + pick.battleScore, 0) /
                    picks.length
                  ).toFixed(1),
                ),
          legendaryCount: picks.filter((pick) => pick.isLegendary).length,
          typeCoverage: Array.from(typeCoverage).sort((a, b) =>
            a.localeCompare(b),
          ),
        },
        picks,
      };
    }),
};
