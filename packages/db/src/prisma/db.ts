import postgres from "@prisma-next/postgres/runtime";
import type { Contract } from "./generated/contract.d";
import contractJson from "./generated/contract.json" with { type: "json" };

export const db = postgres<Contract>({
  contractJson,
  url: process.env["DATABASE_URL"]!,
});
