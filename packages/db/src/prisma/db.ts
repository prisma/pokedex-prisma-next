import { env } from "@pokedex/env/server";
import postgres from "@prisma-next/postgres/runtime";

import type { Contract } from "../../prisma/generated/contract.d";
import contractJson from "../../prisma/generated/contract.json" with { type: "json" };

export const db = postgres<Contract>({
  contractJson,
  url: env.DATABASE_URL,
  extensions: [],
});

type DriverBinding = {
  kind: "url";
  url: string;
};

type RuntimeDriver = {
  state?: "unbound" | "connected" | "closed";
  connect?: (binding: DriverBinding) => Promise<void>;
};

type RuntimeWithDriver = {
  core?: {
    driver?: RuntimeDriver;
  };
};

let runtimeConnectPromise: Promise<void> | undefined;

export async function ensureDbConnected(): Promise<void> {
  if (!runtimeConnectPromise) {
    runtimeConnectPromise = (async () => {
      const runtime = db.runtime() as RuntimeWithDriver;
      const driver = runtime.core?.driver;

      if (!driver?.connect) {
        return;
      }

      if (driver.state === "connected") {
        return;
      }

      await driver.connect({
        kind: "url",
        url: env.DATABASE_URL,
      });
    })().catch((error) => {
      runtimeConnectPromise = undefined;
      throw error;
    });
  }

  await runtimeConnectPromise;
}

export function resetDbConnectionState(): void {
  runtimeConnectPromise = undefined;
}
