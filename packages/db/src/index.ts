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
    return this.where((p: any) =>
      or(
        p.primaryType.ilike(`%${type}%`),
        p.secondaryType.ilike(`%${type}%`),
      ),
    );
  }

  byName(name: string) {
    return this.where((p: any) => p.name.ilike(`%${name}%`));
  }

  withSpawnPoints() {
    return this.include("spawnPoints", (sp: any) =>
      sp.orderBy((s: any) => s.encounterRate.desc()),
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
