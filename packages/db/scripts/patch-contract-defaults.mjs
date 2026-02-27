import fs from "node:fs";
import path from "node:path";

const contractPath = path.resolve("src/prisma/contract.json");

if (!fs.existsSync(contractPath)) {
  console.error(`Contract JSON not found at ${contractPath}`);
  process.exit(1);
}

const contract = JSON.parse(fs.readFileSync(contractPath, "utf8"));

const patches = [
  { table: "user", column: "emailVerified", value: false },
  { table: "todo", column: "completed", value: false },
];

for (const patch of patches) {
  const column = contract?.storage?.tables?.[patch.table]?.columns?.[patch.column];
  if (!column) {
    continue;
  }

  if (!column.default || column.default.kind !== "literal" || column.default.value !== patch.value) {
    column.default = {
      kind: "literal",
      value: patch.value,
    };
  }
}

fs.writeFileSync(contractPath, `${JSON.stringify(contract, null, 2)}\n`);
