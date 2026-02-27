import { all, or } from "@prisma-next/sql-orm-client";
import { createOrmClient, db } from "@pokedex/db";
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
    const client = createOrmClient(db.runtime());

    const pokemonCount = await client.pokemon.aggregate((agg) => ({
      count: agg.count(),
    }));

    if (pokemonCount.count > 0 && !input.forceReset) {
      const spawnPointCount = await client.spawnPoints.aggregate((agg) => ({
        count: agg.count(),
      }));
      return {
        seeded: false,
        pokemonCount: pokemonCount.count,
        spawnPointCount: spawnPointCount.count,
        message: "Pokemon data already exists. Pass forceReset=true to reseed from PokeAPI.",
      };
    }

    if (pokemonCount.count > 0) {
      await client.spawnPoints.where(all).deleteAll();
      await client.pokemon.where(all).deleteAll();
    }

    const imported = await fetchPokeApiSeedData(input.limit);
    const pokemonRows = imported.pokemon;
    const spawnPointSeedRows = imported.spawnPoints;

    for (const batch of chunkArray(pokemonRows, CREATE_MANY_BATCH_SIZE)) {
      await client.pokemon.createCount(batch);
    }

    const idMapRows = await client.pokemon
      .select("id", "dexNumber")
      .all();

    const pokemonIdByDexNumber = new Map<number, number>(
      [...idMapRows].map((row) => [row.dexNumber, row.id]),
    );

    const spawnPointRows = spawnPointSeedRows.map((spawn) => {
      const pokemonId = pokemonIdByDexNumber.get(spawn.dexNumber);
      if (!pokemonId) {
        throw new Error(`Missing seeded pokemon for dexNumber ${spawn.dexNumber}`);
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

    for (const batch of chunkArray(spawnPointRows, CREATE_MANY_BATCH_SIZE)) {
      await client.spawnPoints.createCount(batch);
    }

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
      const client = createOrmClient(db.runtime());

      let query = client.pokemon.orderBy((p) => p.dexNumber.asc());

      if (input.legendaryOnly) {
        query = query.where({ isLegendary: true });
      }

      if (input.type) {
        const typeFilter = input.type;
        query = query.where((p) =>
          or(
            p.primaryType.ilike(`%${typeFilter}%`),
            p.secondaryType.ilike(`%${typeFilter}%`),
          ),
        );
      }

      if (input.search) {
        const searchTerm = input.search;
        query = query.where((p) =>
          or(
            p.name.ilike(`%${searchTerm}%`),
            p.primaryType.ilike(`%${searchTerm}%`),
            p.secondaryType.ilike(`%${searchTerm}%`),
          ),
        );
      }

      const rows = await query
        .withSpawnPoints()
        .take(input.limit)
        .all();

      return [...rows];
    }),

  byDexNumber: publicProcedure
    .input(z.object({ dexNumber: z.number().int().min(1).max(9999) }))
    .handler(async ({ input }) => {
      const client = createOrmClient(db.runtime());

      const pokemon = await client.pokemon
        .byDexNumber(input.dexNumber)
        .withSpawnPoints()
        .find();

      return pokemon ?? null;
    }),

  typeBreakdown: publicProcedure.handler(async () => {
    const client = createOrmClient(db.runtime());

    const allPokemon = await client.pokemon
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
            eb(eb.fn("lower", ["primaryType"]), "=", filterType),
            eb(eb.fn("lower", ["secondaryType"]), "=", filterType),
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
