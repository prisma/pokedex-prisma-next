import pgvector from "@prisma-next/extension-pgvector/runtime";
import postgres from "@prisma-next/postgres/runtime";
import type { Contract } from "./contract.d";
import contractJson from "./contract.json" with { type: "json" };

export const db = postgres<Contract>({
  contractJson,
  extensions: [pgvector],
  url:
    process.env["DATABASE_URL"] ??
    "postgresql://localhost:5432/pokedex",
});
