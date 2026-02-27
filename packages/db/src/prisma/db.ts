import "dotenv/config";
import postgresAdapter from "@prisma-next/adapter-postgres/runtime";
import { instantiateExecutionStack } from "@prisma-next/core-execution-plane/stack";
import postgresDriver from "@prisma-next/driver-postgres/runtime";
import { KyselyPrismaDialect } from "@prisma-next/integration-kysely";
import { validateContract } from "@prisma-next/sql-contract/validate";
import {
  createExecutionContext,
  createRuntime,
  createSqlExecutionStack,
  type Runtime,
} from "@prisma-next/sql-runtime";
import postgresTarget from "@prisma-next/target-postgres/runtime";
import { Kysely } from "kysely";
import { Pool } from "pg";
import type { Contract } from "./contract.d";
import contractJson from "./contract.json" with { type: "json" };

const url = process.env["DATABASE_URL"];
if (!url) {
  throw new Error("DATABASE_URL environment variable is required");
}

const contract = validateContract<Contract>(contractJson);

const stack = createSqlExecutionStack({
  target: postgresTarget,
  adapter: postgresAdapter,
  driver: postgresDriver,
  extensionPacks: [],
});

const context = createExecutionContext({ contract, stack });

let runtimeInstance: Runtime | undefined;
let pool: Pool | undefined;

export async function getRuntime(): Promise<Runtime> {
  if (runtimeInstance) return runtimeInstance;

  pool = new Pool({ connectionString: url });

  const stackInstance = instantiateExecutionStack(stack);
  const driver = stackInstance.driver;
  if (!driver) throw new Error("Driver missing from execution stack");

  await driver.connect({ kind: "pgPool", pool });

  runtimeInstance = createRuntime({
    stackInstance,
    context,
    driver,
    verify: { mode: "onFirstUse", requireMarker: false },
  });

  return runtimeInstance;
}

export const db = {
  context,
  stack,
  async runtime() {
    return getRuntime();
  },
  async kysely() {
    const runtime = await getRuntime();
    return new Kysely<any>({
      dialect: new KyselyPrismaDialect({ runtime, contract }),
    });
  },
};
