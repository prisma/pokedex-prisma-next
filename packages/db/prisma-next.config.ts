import dotenv from "dotenv";
import path from "node:path";
import postgresAdapter from "@prisma-next/adapter-postgres/control";
import { defineConfig } from "@prisma-next/cli/config-types";
import postgresDriver from "@prisma-next/driver-postgres/control";
import sql from "@prisma-next/family-sql/control";
import { prismaContract } from "@prisma-next/sql-contract-psl/provider";
import postgres from "@prisma-next/target-postgres/control";

// Alternative: use a TypeScript contract as the source of truth instead of PSL.
// import { contract } from "./src/prisma/contract";
// Then replace the `contract` field below with:
//   contract: { source: contract, output: "src/prisma/contract.json" },

dotenv.config({
  path: path.join("..", "..", "apps", "server", ".env"),
});

export default defineConfig({
  family: sql,
  target: postgres,
  adapter: postgresAdapter,
  driver: postgresDriver,
  extensionPacks: [],
  contract: prismaContract("./src/prisma/schema.prisma", {
    output: "src/prisma/contract.json",
  }),
  db: {
    connection: process.env["DATABASE_URL"],
  },
});
