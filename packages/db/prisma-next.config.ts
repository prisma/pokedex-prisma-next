import dotenv from "dotenv";
import path from "node:path";
import postgresAdapter from "@prisma-next/adapter-postgres/control";
import { defineConfig } from "@prisma-next/cli/config-types";
import postgresDriver from "@prisma-next/driver-postgres/control";
import pgvector from "@prisma-next/extension-pgvector/control";
import sql from "@prisma-next/family-sql/control";
import postgres from "@prisma-next/target-postgres/control";
import { contract } from "./src/prisma/contract";

dotenv.config({
  path: path.join("..", "..", "apps", "server", ".env"),
});

export default defineConfig({
  family: sql,
  target: postgres,
  adapter: postgresAdapter,
  driver: postgresDriver,
  extensionPacks: [pgvector],
  contract: {
    source: contract,
    output: "src/prisma/contract.json",
  },
  db: {
    connection: process.env["DATABASE_URL"],
  },
});
