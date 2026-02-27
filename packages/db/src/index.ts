import { Collection, orm } from "@prisma-next/sql-orm-client";
import type { Runtime } from "@prisma-next/sql-runtime";
import type { Contract } from "./prisma/generated/contract.d";
import { db } from "./prisma/db";

export { db };

const contract = db.context.contract as Contract;

class PokemonCollection extends Collection<Contract, "Pokemon"> {
  legendary() {
    return this.where({ isLegendary: true });
  }

  byType(type: string) {
    return this.where((p) => p.primaryType.ilike(type));
  }

  byDexNumber(dexNumber: number) {
    return this.where({ dexNumber });
  }

  withSpawnPoints() {
    return this.include("spawnPoints", (sp) =>
      sp.orderBy((s) => s.encounterRate.desc()),
    );
  }
}

class SpawnPointCollection extends Collection<Contract, "SpawnPoint"> {
  forPokemon(pokemonIds: number[]) {
    return this.where((sp) => sp.pokemonId.in(pokemonIds));
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
