import type { CodecTypes } from "@prisma-next/adapter-postgres/codec-types";

import {
  boolColumn,
  float8Column,
  int4Column,
  textColumn,
  timestamptzColumn,
} from "@prisma-next/adapter-postgres/column-types";
import { defineContract } from "@prisma-next/sql-contract-ts/contract-builder";
import postgresPack from "@prisma-next/target-postgres/pack";

export const contract = defineContract<CodecTypes>()
  .target(postgresPack)
  .table("pokemon", (t) =>
    t
      .column("id", {
        type: int4Column,
        nullable: false,
        default: { kind: "function", expression: "autoincrement()" },
      })
      .column("dexNumber", { type: int4Column, nullable: false })
      .column("name", { type: textColumn, nullable: false })
      .column("primaryType", { type: textColumn, nullable: false })
      .column("secondaryType", { type: textColumn, nullable: true })
      .column("hp", { type: int4Column, nullable: false })
      .column("attack", { type: int4Column, nullable: false })
      .column("defense", { type: int4Column, nullable: false })
      .column("speed", { type: int4Column, nullable: false })
      .column("spriteUrl", { type: textColumn, nullable: false })
      .column("isLegendary", {
        type: boolColumn,
        nullable: false,
      })
      .column("createdAt", {
        type: timestamptzColumn,
        nullable: false,
        default: { kind: "function", expression: "now()" },
      })
      .column("updatedAt", {
        type: timestamptzColumn,
        nullable: false,
        default: { kind: "function", expression: "now()" },
      })
      .primaryKey(["id"])
      .unique(["dexNumber"])
      .unique(["name"])
      .index(["primaryType"])
      .index(["isLegendary"]),
  )
  .table("spawnPoint", (t) =>
    t
      .column("id", {
        type: int4Column,
        nullable: false,
        default: { kind: "function", expression: "autoincrement()" },
      })
      .column("pokemonId", { type: int4Column, nullable: false })
      .column("label", { type: textColumn, nullable: false })
      .column("region", { type: textColumn, nullable: false })
      .column("latitude", { type: float8Column, nullable: false })
      .column("longitude", { type: float8Column, nullable: false })
      .column("encounterRate", { type: int4Column, nullable: false })
      .column("createdAt", {
        type: timestamptzColumn,
        nullable: false,
        default: { kind: "function", expression: "now()" },
      })
      .primaryKey(["id"])
      .index(["pokemonId"])
      .index(["region"])
      .index(["latitude", "longitude"])
      .foreignKey(["pokemonId"], { table: "pokemon", columns: ["id"] }, { onDelete: "cascade" }),
  )
  .model("Pokemon", "pokemon", (m) =>
    m
      .field("id", "id")
      .field("dexNumber", "dexNumber")
      .field("name", "name")
      .field("primaryType", "primaryType")
      .field("secondaryType", "secondaryType")
      .field("hp", "hp")
      .field("attack", "attack")
      .field("defense", "defense")
      .field("speed", "speed")
      .field("spriteUrl", "spriteUrl")
      .field("isLegendary", "isLegendary")
      .field("createdAt", "createdAt")
      .field("updatedAt", "updatedAt")
      .relation("spawnPoints", {
        toModel: "SpawnPoint",
        toTable: "spawnPoint",
        cardinality: "1:N",
        on: {
          parentTable: "pokemon",
          parentColumns: ["id"],
          childTable: "spawnPoint",
          childColumns: ["pokemonId"],
        },
      }),
  )
  .model("SpawnPoint", "spawnPoint", (m) =>
    m
      .field("id", "id")
      .field("pokemonId", "pokemonId")
      .field("label", "label")
      .field("region", "region")
      .field("latitude", "latitude")
      .field("longitude", "longitude")
      .field("encounterRate", "encounterRate")
      .field("createdAt", "createdAt")
      .relation("pokemon", {
        toModel: "Pokemon",
        toTable: "pokemon",
        cardinality: "N:1",
        on: {
          parentTable: "spawnPoint",
          parentColumns: ["pokemonId"],
          childTable: "pokemon",
          childColumns: ["id"],
        },
      }),
  )
  .capabilities({
    postgres: {
      lateral: true,
      jsonAgg: true,
      returning: true,
      "defaults.now": true,
    },
  })
  .build();
