import { orm } from "@prisma-next/sql-orm-client";
import type { Runtime } from "@prisma-next/sql-runtime";
import type { Contract } from "./prisma/contract.d";
import { db } from "./prisma/db";

export { db };

const contract = db.context.contract as Contract;

export function createOrmClient(runtime: Runtime) {
  return orm({ contract, runtime });
}
