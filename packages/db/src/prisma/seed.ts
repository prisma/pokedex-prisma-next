import { createOrmClient, db } from "../index";

interface PokeApiType {
  slot: number;
  type: { name: string };
}

interface PokeApiStat {
  base_stat: number;
  stat: { name: string };
}

interface PokeApiPokemon {
  id: number;
  name: string;
  types: PokeApiType[];
  stats: PokeApiStat[];
  sprites: {
    front_default: string | null;
    other?: { "official-artwork"?: { front_default: string | null } };
  };
}

interface PokeApiSpecies {
  is_legendary: boolean;
  is_mythical: boolean;
}

const POKEAPI = "https://pokeapi.co/api/v2";
export const MAX_POKEMON = 1025;

const REGIONS = [
  "Golden Gate Park",
  "Los Angeles",
  "Seattle",
  "Rocky Mountain",
  "Chicago",
  "Times Square",
  "New Orleans",
  "Honolulu",
];

function titleCase(s: string) {
  return s
    .split("-")
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(" ");
}

async function fetchPokemon(dexNumber: number) {
  const [poke, species] = await Promise.all([
    fetch(`${POKEAPI}/pokemon/${dexNumber}`).then((r) =>
      r.json(),
    ) as Promise<PokeApiPokemon>,
    fetch(`${POKEAPI}/pokemon-species/${dexNumber}`).then((r) =>
      r.json(),
    ) as Promise<PokeApiSpecies>,
  ]);

  const types = [...poke.types].sort((a, b) => a.slot - b.slot);
  const stat = (name: string) =>
    poke.stats.find((s) => s.stat.name === name)?.base_stat ?? 0;

  return {
    dexNumber: poke.id,
    name: titleCase(poke.name),
    primaryType: titleCase(types[0]?.type.name ?? "Unknown"),
    secondaryType: types[1]?.type.name ? titleCase(types[1].type.name) : null,
    hp: stat("hp"),
    attack: stat("attack"),
    defense: stat("defense"),
    speed: stat("speed"),
    spriteUrl:
      poke.sprites?.other?.["official-artwork"]?.front_default ??
      poke.sprites?.front_default ??
      `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${poke.id}.png`,
    isLegendary: species.is_legendary || species.is_mythical,
  };
}

export async function seedDatabase(limit: number, forceReset: boolean) {
  const runtime = db.runtime();
  const k = db.kysely;
  const client = createOrmClient(runtime);

  // ORM aggregate works without "returning" capability
  const { count } = await client.pokemon!.aggregate((agg) => ({
    count: agg.count(),
  }));

  if (count > 0 && !forceReset) {
    return { seeded: false, pokemonCount: count, message: "Already seeded." };
  }

  // Kysely deletes don't need "returning"
  if (count > 0) {
    await runtime.execute(k.build(k.deleteFrom("spawnPoint"))).toArray();
    await runtime.execute(k.build(k.deleteFrom("pokemon"))).toArray();
  }

  // Fetch all pokemon from PokeAPI in batches of 25
  const dexNumbers = Array.from(
    { length: Math.min(limit, MAX_POKEMON) },
    (_, i) => i + 1,
  );
  const pokemon: Awaited<ReturnType<typeof fetchPokemon>>[] = [];

  for (let i = 0; i < dexNumbers.length; i += 25) {
    const batch = dexNumbers.slice(i, i + 25);
    const results = await Promise.all(batch.map(fetchPokemon));
    pokemon.push(...results);
  }

  // Kysely build-only surface only supports single-row inserts
  for (const row of pokemon) {
    await runtime.execute(k.build(k.insertInto("pokemon").values(row))).toArray();
  }

  // Build spawn points — use Kysely select for id lookup
  const idRows = await runtime
    .execute(k.build(k.selectFrom("pokemon").select(["id", "dexNumber"])))
    .toArray();
  const idByDex = new Map(idRows.map((r) => [r.dexNumber, r.id]));

  for (const p of pokemon) {
    await runtime
      .execute(
        k.build(
          k.insertInto("spawnPoint").values({
            pokemonId: idByDex.get(p.dexNumber)!,
            label: `${p.name} Habitat`,
            region: REGIONS[(p.dexNumber - 1) % REGIONS.length]!,
            latitude: 37.7 + ((p.dexNumber * 17) % 90) / 1000,
            longitude: -122.4 + ((p.dexNumber * 31) % 90) / 1000,
            encounterRate: Math.max(
              5,
              90 - Math.floor((p.hp + p.attack + p.defense + p.speed) / 10),
            ),
          }),
        ),
      )
      .toArray();
  }

  return {
    seeded: true,
    pokemonCount: pokemon.length,
    spawnPointCount: pokemon.length,
    message: `Imported ${pokemon.length} Pokemon from PokeAPI.`,
  };
}
