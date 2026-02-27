import prisma, { db, ensureDbConnected } from "@pokedex/db";
import z from "zod";

import { publicProcedure } from "../index";

type SeedPokemon = {
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

type SeedSpawnPoint = {
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

type PokeApiSpeciesCatalogResponse = {
  count: number;
};

type PokeApiPokemonResponse = {
  id: number;
  name: string;
  stats: Array<{
    base_stat: number;
    stat: { name: string };
  }>;
  types: Array<{
    slot: number;
    type: { name: string };
  }>;
  sprites: {
    front_default: string | null;
    other?: {
      "official-artwork"?: {
        front_default: string | null;
      };
    };
  };
};

type PokeApiSpeciesResponse = {
  is_legendary: boolean;
  is_mythical: boolean;
};

const POKEAPI_BASE_URL = "https://pokeapi.co/api/v2";
const POKEAPI_SEED_CONCURRENCY = 25;
const POKEAPI_MAX_LIMIT = 1025;
const CREATE_MANY_BATCH_SIZE = 500;

const SPAWN_REGIONS: Array<{ region: string; latitude: number; longitude: number }> = [
  { region: "Golden Gate Park", latitude: 37.7694, longitude: -122.4862 },
  { region: "Los Angeles", latitude: 34.0522, longitude: -118.2437 },
  { region: "Seattle Waterfront", latitude: 47.6073, longitude: -122.3426 },
  { region: "Rocky Mountain", latitude: 40.3428, longitude: -105.6836 },
  { region: "Chicago Waterfront", latitude: 41.8917, longitude: -87.6078 },
  { region: "Times Square", latitude: 40.758, longitude: -73.9855 },
  { region: "New Orleans", latitude: 29.9584, longitude: -90.0644 },
  { region: "Honolulu", latitude: 21.3069, longitude: -157.8583 },
];

function chunkArray<T>(items: readonly T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }
  return chunks;
}

async function mapWithConcurrency<T, TResult>(
  items: readonly T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<TResult>,
): Promise<TResult[]> {
  if (items.length === 0) {
    return [];
  }

  const results = new Array<TResult>(items.length);
  let currentIndex = 0;
  const workerCount = Math.max(1, Math.min(concurrency, items.length));

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (true) {
        const itemIndex = currentIndex;
        if (itemIndex >= items.length) {
          return;
        }
        currentIndex += 1;

        results[itemIndex] = await mapper(items[itemIndex]!, itemIndex);
      }
    }),
  );

  return results;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `PokeAPI request failed (${response.status} ${response.statusText}) for ${url}`,
    );
  }

  return (await response.json()) as T;
}

function formatDisplayName(value: string): string {
  return value
    .split("-")
    .map((segment) =>
      segment.length > 0 ? segment[0]!.toUpperCase() + segment.slice(1) : segment,
    )
    .join(" ");
}

function readStat(stats: PokeApiPokemonResponse["stats"], statName: string): number {
  const stat = stats.find((item) => item.stat.name === statName);
  return stat?.base_stat ?? 0;
}

function mapPokeApiPokemon(
  pokemon: PokeApiPokemonResponse,
  species: PokeApiSpeciesResponse,
): SeedPokemon {
  const sortedTypes = [...pokemon.types].sort((a, b) => a.slot - b.slot);
  const primaryType = formatDisplayName(sortedTypes[0]?.type.name ?? "Unknown");
  const secondaryType = sortedTypes[1]?.type.name
    ? formatDisplayName(sortedTypes[1].type.name)
    : null;

  const spriteUrl =
    pokemon.sprites.other?.["official-artwork"]?.front_default ??
    pokemon.sprites.front_default ??
    `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokemon.id}.png`;

  return {
    dexNumber: pokemon.id,
    name: formatDisplayName(pokemon.name),
    primaryType,
    secondaryType,
    hp: readStat(pokemon.stats, "hp"),
    attack: readStat(pokemon.stats, "attack"),
    defense: readStat(pokemon.stats, "defense"),
    speed: readStat(pokemon.stats, "speed"),
    spriteUrl,
    isLegendary: species.is_legendary || species.is_mythical,
  };
}

function createSpawnPointForPokemon(pokemon: SeedPokemon): SeedSpawnPoint {
  const region =
    SPAWN_REGIONS[(pokemon.dexNumber - 1) % SPAWN_REGIONS.length] ?? SPAWN_REGIONS[0]!;
  const latitudeJitter = ((pokemon.dexNumber * 17) % 90) / 1000 - 0.045;
  const longitudeJitter = ((pokemon.dexNumber * 31) % 90) / 1000 - 0.045;
  const totalStats = pokemon.hp + pokemon.attack + pokemon.defense + pokemon.speed;
  const baseRate = 92 - Math.floor(totalStats / 10);
  const rarityPenalty = pokemon.isLegendary ? 35 : 0;
  const encounterRate = Math.max(
    4,
    Math.min(95, baseRate - rarityPenalty + (pokemon.dexNumber % 7)),
  );

  return {
    dexNumber: pokemon.dexNumber,
    label: `${pokemon.name} Habitat`,
    region: region.region,
    latitude: Number((region.latitude + latitudeJitter).toFixed(4)),
    longitude: Number((region.longitude + longitudeJitter).toFixed(4)),
    encounterRate,
  };
}

async function fetchPokeApiSeedData(limit: number): Promise<{
  pokemon: SeedPokemon[];
  spawnPoints: SeedSpawnPoint[];
  availableCount: number;
}> {
  const speciesCatalog = await fetchJson<PokeApiSpeciesCatalogResponse>(
    `${POKEAPI_BASE_URL}/pokemon-species?limit=1`,
  );
  const availableCount = speciesCatalog.count;
  const effectiveLimit = Math.min(limit, availableCount);
  const dexNumbers = Array.from({ length: effectiveLimit }, (_, index) => index + 1);

  const pokemonRows = await mapWithConcurrency(
    dexNumbers,
    POKEAPI_SEED_CONCURRENCY,
    async (dexNumber) => {
      const [pokemon, species] = await Promise.all([
        fetchJson<PokeApiPokemonResponse>(`${POKEAPI_BASE_URL}/pokemon/${dexNumber}`),
        fetchJson<PokeApiSpeciesResponse>(`${POKEAPI_BASE_URL}/pokemon-species/${dexNumber}`),
      ]);
      return mapPokeApiPokemon(pokemon, species);
    },
  );

  return {
    pokemon: pokemonRows,
    spawnPoints: pokemonRows.map(createSpawnPointForPokemon),
    availableCount,
  };
}

async function createPokemonInBatches(rows: SeedPokemon[]): Promise<void> {
  for (const batch of chunkArray(rows, CREATE_MANY_BATCH_SIZE)) {
    await prisma.pokemon.createMany({ data: batch });
  }
}

async function createSpawnPointsInBatches(
  rows: Array<{
    pokemonId: number;
    label: string;
    region: string;
    latitude: number;
    longitude: number;
    encounterRate: number;
  }>,
): Promise<void> {
  for (const batch of chunkArray(rows, CREATE_MANY_BATCH_SIZE)) {
    await prisma.spawnPoint.createMany({ data: batch });
  }
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
  limit: z.number().int().min(1).max(POKEAPI_MAX_LIMIT).default(POKEAPI_MAX_LIMIT),
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
  importPokemon: publicProcedure.input(seedSchema).handler(async ({ input }) => {
    const pokemonCount = await prisma.pokemon.count();

    if (pokemonCount > 0 && !input.forceReset) {
      return {
        seeded: false,
        pokemonCount,
        spawnPointCount: await prisma.spawnPoint.count(),
        message: "Pokemon data already exists. Pass forceReset=true to reseed from PokeAPI.",
      };
    }

    if (pokemonCount > 0) {
      await prisma.spawnPoint.deleteMany();
      await prisma.pokemon.deleteMany();
    }

    const imported = await fetchPokeApiSeedData(input.limit);
    const pokemonRows = imported.pokemon;
    const spawnPointSeedRows = imported.spawnPoints;

    await createPokemonInBatches(pokemonRows);

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

    const spawnPointRows = spawnPointSeedRows.map((spawn) => {
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

    await createSpawnPointsInBatches(spawnPointRows);

    return {
      seeded: true,
      pokemonCount: pokemonRows.length,
      spawnPointCount: spawnPointRows.length,
      message: `Imported ${pokemonRows.length} Pokemon from PokeAPI (available: ${imported.availableCount}).`,
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
      const filterType = input.type?.trim().toLowerCase() || null;
      const hasTypeFilter = filterType !== null;
      const typeValue = filterType ?? "";

      // Low-level raw SQL plan — showcases db.sql.raw with CTEs + window functions.
      const plan = db.sql.raw`
      WITH scored AS (
        SELECT
          p."dexNumber",
          p.name,
          p."primaryType",
          p."secondaryType",
          p.hp,
          p.attack,
          p.defense,
          p.speed,
          p."isLegendary",
          (p.hp + p.attack + p.defense + p.speed) AS "totalStats",
          row_number() OVER (
            PARTITION BY p."primaryType"
            ORDER BY (p.hp + p.attack + p.defense + p.speed) DESC
          ) AS "typeRank"
        FROM "pokemon" p
        WHERE (
          ${hasTypeFilter} = FALSE
          OR lower(p."primaryType") = ${typeValue}
          OR lower(coalesce(p."secondaryType", '')) = ${typeValue}
        )
      )
      SELECT *
      FROM scored
      WHERE "typeRank" <= 2
      ORDER BY "totalStats" DESC
      LIMIT 6;
    `;

      const rows = (await executeLowLevelPlan(plan)) as Array<{
        dexNumber: number;
        name: string;
        primaryType: string;
        secondaryType: string | null;
        hp: number;
        attack: number;
        defense: number;
        speed: number;
        isLegendary: boolean;
        totalStats: number | string;
      }>;

      return rows.map((row) => ({
        ...row,
        totalStats: Number(row.totalStats),
      }));
    }),
};
