import dotenv from "dotenv";
import path from "node:path";

dotenv.config({
  path: path.join("..", "..", "apps", "server", ".env"),
});

async function main() {
  const { db, ensureDbConnected } = await import("../src/index.ts");

  const enablePlan = db.sql.raw`CREATE EXTENSION IF NOT EXISTS postgis;`;
  const versionPlan = db.sql.raw`SELECT postgis_full_version() AS version;`;

  await ensureDbConnected();
  const connection = await db.runtime().connection();
  const rows = await (async () => {
    try {
      await connection.execute(enablePlan).toArray();
      return (await connection.execute(versionPlan).toArray()) as Array<{ version: string }>;
    } finally {
      await connection.release();
    }
  })();

  console.log(`PostGIS ready: ${rows[0]?.version ?? "unknown version"}`);

  await db.runtime().close();
}

main().catch((error) => {
  console.error("Failed to enable PostGIS.");
  console.error(error);
  process.exit(1);
});
