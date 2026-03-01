// Runtime bootstrap — creates the Prisma Next database instance.
// This is the entry point for all query execution (ORM, SQL lane, Kysely).

import postgres from "@prisma-next/postgres/runtime";
import type { Contract } from "./contract.d";
import contractJson from "./contract.json" with { type: "json" };

export const db = postgres<Contract>({
  contractJson,
  url: process.env["DATABASE_URL"],
});
