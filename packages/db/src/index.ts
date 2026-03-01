import { Collection, or, orm } from "@prisma-next/sql-orm-client";
import type { Runtime } from "@prisma-next/sql-runtime";
import type { Contract } from "./prisma/contract.d";
import { db } from "./prisma/db";

export { db };

const contract = db.context.contract as Contract;

class PokemonCollection extends Collection<Contract, "Pokemon"> {
  legendary() {
    return this.where({ isLegendary: true });
  }

  byDexNumber(dexNumber: number) {
    return this.where({ dexNumber });
  }

  byType(type: string) {
    return this.where((p) =>
      or(p.primaryType.ilike(`%${type}%`), p.secondaryType.ilike(`%${type}%`)),
    );
  }

  byName(name: string) {
    return this.where((p) => p.name.ilike(`%${name}%`));
  }

  search(term: string) {
    return this.where((p) =>
      or(
        p.name.ilike(`%${term}%`),
        p.primaryType.ilike(`%${term}%`),
        p.secondaryType.ilike(`%${term}%`),
      ),
    );
  }

  withSpawnPoints() {
    return this.include("spawnPoints", (sp) =>
      sp.orderBy((s) => s.encounterRate.desc()),
    );
  }
}

class SpawnPointCollection extends Collection<Contract, "SpawnPoint"> {
  byRegion(region: string) {
    return this.where({ region });
  }

  byPokemon(pokemonId: number) {
    return this.where({ pokemonId });
  }
}

export function createOrmClient(runtime: Runtime) {
  return orm({
    contract,
    runtime,
    collections: {
      pokemon: PokemonCollection,
      spawnPoints: SpawnPointCollection,
    },
  });
}

// ──────────────────────────────────────────────────────────────────
// Feature: pgvector — cosine similarity via Prisma Next raw lane
//
// Prisma Next's pgvector contract/runtime support is wired up, but the
// current dev build drops vector params for cosineDistance(param(...))
// plans. We avoid that specific bug by doing the similarity search as
// a raw plan keyed only by dexNumber, while still executing through the
// Prisma Next runtime.
//
// Prisma 7 has no pgvector support at all (requires Unsupported + raw SQL).
// ──────────────────────────────────────────────────────────────────

const SIMILAR_POKEMON_SQL = `
  with reference as (
    select "statVector" as vector
    from pokemon
    where "dexNumber" = $1
      and "statVector" is not null
    limit 1
  )
  select
    p."dexNumber",
    p.name,
    p."primaryType",
    p."secondaryType",
    p.hp,
    p.attack,
    p.defense,
    p.speed,
    p."spriteUrl",
    1 - (p."statVector" <=> reference.vector) as similarity
  from pokemon as p
  cross join reference
  where p."dexNumber" <> $1
    and p."statVector" is not null
  order by p."statVector" <=> reference.vector
  limit 5
`;

type SimilarPokemonRow = {
  dexNumber: number;
  name: string;
  primaryType: string;
  secondaryType: string | null;
  hp: number;
  attack: number;
  defense: number;
  speed: number;
  spriteUrl: string;
  similarity: number;
};

export async function findSimilarPokemon(dexNumber: number) {
  const plan = db.sql.raw(SIMILAR_POKEMON_SQL, {
    params: [dexNumber],
    refs: {
      tables: ["pokemon"],
      columns: [
        { table: "pokemon", column: "dexNumber" },
        { table: "pokemon", column: "name" },
        { table: "pokemon", column: "primaryType" },
        { table: "pokemon", column: "secondaryType" },
        { table: "pokemon", column: "hp" },
        { table: "pokemon", column: "attack" },
        { table: "pokemon", column: "defense" },
        { table: "pokemon", column: "speed" },
        { table: "pokemon", column: "spriteUrl" },
        { table: "pokemon", column: "statVector" },
      ],
    },
    projection: [
      "dexNumber",
      "name",
      "primaryType",
      "secondaryType",
      "hp",
      "attack",
      "defense",
      "speed",
      "spriteUrl",
      "similarity",
    ],
  });

  const rows: SimilarPokemonRow[] = [];
  for await (const row of db.runtime().execute(plan)) {
    rows.push(row as SimilarPokemonRow);
  }
  return rows;
}
