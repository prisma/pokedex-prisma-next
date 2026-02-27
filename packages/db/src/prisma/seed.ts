import { all } from "@prisma-next/sql-orm-client";
import { createOrmClient } from "../index";
import { db } from "./db";

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
    ) as Promise<any>,
    fetch(`${POKEAPI}/pokemon-species/${dexNumber}`).then((r) =>
      r.json(),
    ) as Promise<any>,
  ]);

  const types = [...poke.types].sort((a: any, b: any) => a.slot - b.slot);
  const stat = (name: string) =>
    poke.stats.find((s: any) => s.stat.name === name)?.base_stat ?? 0;

  return {
    dexNumber: poke.id as number,
    name: titleCase(poke.name),
    primaryType: titleCase(types[0]?.type.name ?? "Unknown"),
    secondaryType: types[1]?.type.name ? titleCase(types[1].type.name) : null,
    hp: stat("hp") as number,
    attack: stat("attack") as number,
    defense: stat("defense") as number,
    speed: stat("speed") as number,
    spriteUrl:
      poke.sprites?.other?.["official-artwork"]?.front_default ??
      poke.sprites?.front_default ??
      `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${poke.id}.png`,
    isLegendary: (species.is_legendary || species.is_mythical) as boolean,
  };
}

export async function seedDatabase(limit: number, forceReset: boolean) {
  const client = createOrmClient(db.runtime());
  const pokemon_ = client.pokemon!;
  const spawnPoints_ = client.spawnPoints!;

  const { count } = (await pokemon_.aggregate((agg: any) => ({
    count: agg.count(),
  }))) as { count: number };

  if (count > 0 && !forceReset) {
    return { seeded: false, pokemonCount: count, message: "Already seeded." };
  }

  if (count > 0) {
    await spawnPoints_.where(all).deleteAll();
    await pokemon_.where(all).deleteAll();
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

  // Insert pokemon in batches of 500
  for (let i = 0; i < pokemon.length; i += 500) {
    await pokemon_.createCount(pokemon.slice(i, i + 500));
  }

  // Build spawn points
  const idRows = await pokemon_.select("id", "dexNumber").all();
  const idByDex = new Map([...idRows].map((r) => [r.dexNumber, r.id]));

  const spawnPoints = pokemon.map((p) => ({
    pokemonId: idByDex.get(p.dexNumber)!,
    label: `${p.name} Habitat`,
    region: REGIONS[(p.dexNumber - 1) % REGIONS.length]!,
    latitude: 37.7 + ((p.dexNumber * 17) % 90) / 1000,
    longitude: -122.4 + ((p.dexNumber * 31) % 90) / 1000,
    encounterRate: Math.max(
      5,
      90 - Math.floor((p.hp + p.attack + p.defense + p.speed) / 10),
    ),
  }));

  for (let i = 0; i < spawnPoints.length; i += 500) {
    await spawnPoints_.createCount(spawnPoints.slice(i, i + 500));
  }

  return {
    seeded: true,
    pokemonCount: pokemon.length,
    spawnPointCount: spawnPoints.length,
    message: `Imported ${pokemon.length} Pokemon from PokeAPI.`,
  };
}
