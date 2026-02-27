import { env } from "@pokedex/env/server";
import postgres from "@prisma-next/postgres/runtime";
import { all, and, not, or } from "@prisma-next/sql-orm-client";

import type { Contract } from "./prisma/contract.d";

import contractJson from "./prisma/contract.json" with { type: "json" };

type PlainObject = Record<string, unknown>;

type ModelDefinition = {
  fields?: Record<string, unknown>;
  relations?: Record<string, { toModel?: string }>;
};

type ModelMetadata = {
  fields: Set<string>;
  relationAliases: Map<string, string>;
  relationTargets: Map<string, string | undefined>;
};

const db = postgres<Contract>({
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

async function ensureDbConnected(): Promise<void> {
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

const contractModels = (db.context.contract.models ?? {}) as Record<string, ModelDefinition>;
const modelToTable = (db.context.contract.mappings?.modelToTable ?? {}) as Record<string, string>;

const modelAliases = new Map<string, string>();
const modelMetadata = new Map<string, ModelMetadata>();

for (const [modelName, definition] of Object.entries(contractModels)) {
  const lowerModelName = lowerFirst(modelName);
  const tableName = modelToTable[modelName];

  addAlias(modelAliases, modelName, modelName);
  addAlias(modelAliases, lowerModelName, modelName);
  addAlias(modelAliases, `${lowerModelName}s`, modelName);

  if (tableName) {
    addAlias(modelAliases, tableName, modelName);
    addAlias(modelAliases, `${tableName}s`, modelName);
  }

  const relationAliases = new Map<string, string>();
  const relationTargets = new Map<string, string | undefined>();
  const relations = definition.relations ?? {};
  for (const [relationName, relation] of Object.entries(relations)) {
    const singular = relationName.endsWith("s") ? relationName.slice(0, -1) : relationName;
    const plural = relationName.endsWith("s") ? relationName : `${relationName}s`;

    relationAliases.set(relationName, relationName);
    relationAliases.set(singular, relationName);
    relationAliases.set(plural, relationName);
    relationTargets.set(relationName, relation.toModel);
  }

  modelMetadata.set(modelName, {
    fields: new Set(Object.keys(definition.fields ?? {})),
    relationAliases,
    relationTargets,
  });
}

function addAlias(map: Map<string, string>, alias: string, modelName: string): void {
  if (!map.has(alias)) {
    map.set(alias, modelName);
  }
}

function lowerFirst(value: string): string {
  if (value.length === 0) {
    return value;
  }
  return value[0]!.toLowerCase() + value.slice(1);
}

function isPlainObject(value: unknown): value is PlainObject {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function normalizeValue(value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeValue(entry));
  }
  if (isPlainObject(value)) {
    return normalizeRecord(value);
  }
  return value;
}

function normalizeRecord(value: PlainObject): PlainObject {
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, normalizeValue(entry)]),
  );
}

function resolveModelName(input: string): string {
  const resolved = modelAliases.get(input);
  if (resolved) {
    return resolved;
  }

  if (input.endsWith("s")) {
    const singular = input.slice(0, -1);
    const singularResolved = modelAliases.get(singular);
    if (singularResolved) {
      return singularResolved;
    }
  }

  throw new Error(
    `Unknown model "${input}". Available models: ${Object.keys(contractModels).join(", ")}`,
  );
}

function getModelMetadata(modelName: string): ModelMetadata {
  const metadata = modelMetadata.get(modelName);
  if (!metadata) {
    throw new Error(`Missing metadata for model "${modelName}"`);
  }
  return metadata;
}

function resolveRelationName(metadata: ModelMetadata, candidate: string): string | undefined {
  return metadata.relationAliases.get(candidate);
}

function toWhereExpressionList(model: any, value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => {
      if (!isPlainObject(entry)) {
        return [];
      }
      const expr = buildWhereExpression(model, entry);
      return expr ? [expr] : [];
    });
  }

  if (isPlainObject(value)) {
    const expr = buildWhereExpression(model, value);
    return expr ? [expr] : [];
  }

  return [];
}

function buildFieldExpression(model: any, fieldName: string, condition: unknown): unknown {
  const accessor = model[fieldName];
  if (!accessor) {
    return undefined;
  }

  if (condition === null) {
    return accessor.isNull();
  }

  if (!isPlainObject(condition)) {
    return accessor.eq(normalizeValue(condition));
  }

  const conditionObject = condition as PlainObject;
  const modeInsensitive = conditionObject["mode"] === "insensitive";
  const expressions: unknown[] = [];

  for (const [operator, rawValue] of Object.entries(conditionObject)) {
    if (operator === "mode" || rawValue === undefined) {
      continue;
    }

    const value = normalizeValue(rawValue);

    switch (operator) {
      case "equals": {
        expressions.push(value === null ? accessor.isNull() : accessor.eq(value));
        break;
      }
      case "not": {
        if (rawValue === null) {
          expressions.push(accessor.isNotNull());
          break;
        }

        if (isPlainObject(rawValue)) {
          const nested = buildFieldExpression(model, fieldName, rawValue);
          if (nested) {
            expressions.push(not(nested as never));
          }
          break;
        }

        expressions.push(accessor.neq(value));
        break;
      }
      case "in": {
        if (Array.isArray(value)) {
          expressions.push(accessor.in(value));
        }
        break;
      }
      case "notIn": {
        if (Array.isArray(value)) {
          expressions.push(accessor.notIn(value));
        }
        break;
      }
      case "lt": {
        expressions.push(accessor.lt(value));
        break;
      }
      case "lte": {
        expressions.push(accessor.lte(value));
        break;
      }
      case "gt": {
        expressions.push(accessor.gt(value));
        break;
      }
      case "gte": {
        expressions.push(accessor.gte(value));
        break;
      }
      case "contains": {
        if (typeof value === "string") {
          expressions.push(modeInsensitive ? accessor.ilike(`%${value}%`) : accessor.like(`%${value}%`));
        }
        break;
      }
      case "startsWith": {
        if (typeof value === "string") {
          expressions.push(modeInsensitive ? accessor.ilike(`${value}%`) : accessor.like(`${value}%`));
        }
        break;
      }
      case "endsWith": {
        if (typeof value === "string") {
          expressions.push(modeInsensitive ? accessor.ilike(`%${value}`) : accessor.like(`%${value}`));
        }
        break;
      }
      default:
        break;
    }
  }

  if (expressions.length === 0) {
    return undefined;
  }

  if (expressions.length === 1) {
    return expressions[0];
  }

  return and(...(expressions as [never, ...never[]]));
}

function buildWhereExpression(model: any, where: PlainObject): unknown {
  const expressions: unknown[] = [];

  for (const [key, value] of Object.entries(where)) {
    if (value === undefined) {
      continue;
    }

    if (key === "AND") {
      expressions.push(...toWhereExpressionList(model, value));
      continue;
    }

    if (key === "OR") {
      const orExpressions = toWhereExpressionList(model, value);
      if (orExpressions.length > 0) {
        expressions.push(or(...(orExpressions as [never, ...never[]])));
      }
      continue;
    }

    if (key === "NOT") {
      const notExpressions = toWhereExpressionList(model, value);
      if (notExpressions.length === 1) {
        expressions.push(not(notExpressions[0] as never));
      } else if (notExpressions.length > 1) {
        expressions.push(not(and(...(notExpressions as [never, ...never[]]))));
      }
      continue;
    }

    const fieldExpression = buildFieldExpression(model, key, value);
    if (fieldExpression) {
      expressions.push(fieldExpression);
    }
  }

  if (expressions.length === 0) {
    return undefined;
  }

  if (expressions.length === 1) {
    return expressions[0];
  }

  return and(...(expressions as [never, ...never[]]));
}

function applyWhere(
  collection: any,
  where: unknown,
  mode: "optional" | "required" | "all" = "optional",
): any {
  const hasWhere =
    isPlainObject(where) && Object.keys(where).length > 0 ? true : where !== undefined && where !== null;

  if (!hasWhere) {
    if (mode === "required") {
      throw new Error("Missing required where clause.");
    }
    if (mode === "all") {
      return collection.where(() => all());
    }
    return collection;
  }

  if (!isPlainObject(where)) {
    throw new Error("Where clause must be an object.");
  }

  return collection.where((model: any) => {
    const expression = buildWhereExpression(model, where);
    return (expression ?? all()) as never;
  });
}

function normalizeOrderBy(orderBy: unknown): Array<{ field: string; direction: "asc" | "desc" }> {
  const orderItems = Array.isArray(orderBy) ? orderBy : [orderBy];
  const normalized: Array<{ field: string; direction: "asc" | "desc" }> = [];

  for (const item of orderItems) {
    if (!isPlainObject(item)) {
      continue;
    }

    for (const [field, direction] of Object.entries(item)) {
      if (direction === "asc" || direction === "desc") {
        normalized.push({ field, direction });
      }
    }
  }

  return normalized;
}

function applyOrderBy(collection: any, orderBy: unknown): any {
  const normalizedOrderBy = normalizeOrderBy(orderBy);
  if (normalizedOrderBy.length === 0) {
    return collection;
  }

  const selectors = normalizedOrderBy.map(({ field, direction }) => {
    return (model: any) => {
      const accessor = model[field];
      if (!accessor) {
        throw new Error(`Unknown orderBy field "${field}".`);
      }
      return direction === "desc" ? accessor.desc() : accessor.asc();
    };
  });

  return collection.orderBy(selectors);
}

function refineRelationCollection(
  relationCollection: any,
  relatedModelName: string | undefined,
  relationSelection: unknown,
): any {
  if (relationSelection === true || relationSelection === undefined) {
    return relationCollection;
  }

  if (!isPlainObject(relationSelection)) {
    return relationCollection;
  }

  const relationSelectionObject = relationSelection as PlainObject;
  let next = relationCollection;

  next = applyWhere(next, relationSelectionObject["where"], "optional");
  next = applyOrderBy(next, relationSelectionObject["orderBy"]);

  if (typeof relationSelectionObject["skip"] === "number") {
    next = next.skip(relationSelectionObject["skip"]);
  }
  if (typeof relationSelectionObject["take"] === "number") {
    next = next.take(relationSelectionObject["take"]);
  }

  const nestedSelect = relationSelectionObject["select"];
  const nestedInclude = relationSelectionObject["include"];
  if (
    relatedModelName &&
    (isPlainObject(nestedSelect) || isPlainObject(nestedInclude))
  ) {
    next = applySelection(next, relatedModelName, nestedSelect, nestedInclude);
  }

  return next;
}

function applySelection(
  collection: any,
  modelName: string,
  select: unknown,
  include: unknown,
): any {
  const metadata = getModelMetadata(modelName);
  const scalarFields = new Set<string>();
  let next = collection;

  if (isPlainObject(select)) {
    for (const [key, selectionValue] of Object.entries(select)) {
      if (!selectionValue) {
        continue;
      }

      if (metadata.fields.has(key) && selectionValue === true) {
        scalarFields.add(key);
        continue;
      }

      const relationName = resolveRelationName(metadata, key);
      if (!relationName) {
        continue;
      }

      next = next.include(relationName, (relatedCollection: any) =>
        refineRelationCollection(
          relatedCollection,
          metadata.relationTargets.get(relationName),
          selectionValue,
        ),
      );
    }
  }

  if (isPlainObject(include)) {
    for (const [key, includeValue] of Object.entries(include)) {
      if (!includeValue) {
        continue;
      }

      const relationName = resolveRelationName(metadata, key);
      if (!relationName) {
        continue;
      }

      next = next.include(relationName, (relatedCollection: any) =>
        refineRelationCollection(relatedCollection, metadata.relationTargets.get(relationName), includeValue),
      );
    }
  }

  if (scalarFields.size > 0) {
    next = next.select(...Array.from(scalarFields));
  }

  return next;
}

function withUpdatedAt(modelName: string, data: PlainObject): PlainObject {
  const metadata = getModelMetadata(modelName);
  if (!metadata.fields.has("updatedAt") || "updatedAt" in data) {
    return data;
  }

  return {
    ...data,
    updatedAt: new Date().toISOString(),
  };
}

function getCollection(modelName: string): any {
  return (db.orm as Record<string, unknown>)[modelName];
}

function createModelDelegate(modelAlias: string) {
  const modelName = resolveModelName(modelAlias);

  const findMany = async (args: PlainObject = {}) => {
    await ensureDbConnected();

    let query = getCollection(modelName);
    query = applyWhere(query, args["where"], "optional");
    query = applyOrderBy(query, args["orderBy"]);

    const skip = args["skip"];
    if (typeof skip === "number") {
      query = query.skip(skip);
    }

    const take = args["take"];
    if (typeof take === "number") {
      query = query.take(take);
    }

    query = applySelection(query, modelName, args["select"], args["include"]);
    return await query.all().toArray();
  };

  return {
    findMany,
    async findFirst(args: PlainObject = {}) {
      const rows = await findMany({ ...args, take: 1 });
      return rows[0] ?? null;
    },
    async findUnique(args: PlainObject = {}) {
      const rows = await findMany({ ...args, take: 1 });
      return rows[0] ?? null;
    },
    async findFirstOrThrow(args: PlainObject = {}) {
      const row = await this.findFirst(args);
      if (!row) {
        throw new Error("Record to find does not exist.");
      }
      return row;
    },
    async findUniqueOrThrow(args: PlainObject = {}) {
      const row = await this.findUnique(args);
      if (!row) {
        throw new Error("Record to find does not exist.");
      }
      return row;
    },
    async create(args: PlainObject) {
      const data = args["data"];
      if (!isPlainObject(data)) {
        throw new Error("create() requires a data object.");
      }

      await ensureDbConnected();

      let query = getCollection(modelName);
      query = applySelection(query, modelName, args["select"], args["include"]);
      return await query.create(normalizeRecord(data));
    },
    async createMany(args: PlainObject) {
      const data = args["data"];
      if (!Array.isArray(data)) {
        throw new Error("createMany() requires data to be an array.");
      }

      const records = data.filter(isPlainObject).map((entry) => normalizeRecord(entry));
      if (records.length === 0) {
        return { count: 0 };
      }

      await ensureDbConnected();

      const query = getCollection(modelName);
      const count = await query.createCount(records);
      return { count };
    },
    async update(args: PlainObject) {
      const data = args["data"];
      if (!isPlainObject(data)) {
        throw new Error("update() requires a data object.");
      }

      await ensureDbConnected();

      let query = getCollection(modelName);
      query = applyWhere(query, args["where"], "required");
      query = applySelection(query, modelName, args["select"], args["include"]);

      const result = await query.update(withUpdatedAt(modelName, normalizeRecord(data)));
      if (!result) {
        throw new Error("Record to update does not exist.");
      }

      return result;
    },
    async updateMany(args: PlainObject = {}) {
      const data = args["data"];
      if (!isPlainObject(data)) {
        throw new Error("updateMany() requires a data object.");
      }

      await ensureDbConnected();

      let query = getCollection(modelName);
      query = applyWhere(query, args["where"], "all");
      const count = await query.updateCount(withUpdatedAt(modelName, normalizeRecord(data)));
      return { count };
    },
    async delete(args: PlainObject) {
      await ensureDbConnected();

      let query = getCollection(modelName);
      query = applyWhere(query, args["where"], "required");
      query = applySelection(query, modelName, args["select"], args["include"]);

      const result = await query.delete();
      if (!result) {
        throw new Error("Record to delete does not exist.");
      }

      return result;
    },
    async deleteMany(args: PlainObject = {}) {
      await ensureDbConnected();

      let query = getCollection(modelName);
      query = applyWhere(query, args["where"], "all");
      const count = await query.deleteCount();
      return { count };
    },
    async count(args: PlainObject = {}) {
      await ensureDbConnected();

      let query = getCollection(modelName);
      query = applyWhere(query, args["where"], "all");
      const aggregateResult = await query.aggregate((aggregate: any) => ({
        count: aggregate.count(),
      }));
      const countValue = (aggregateResult as PlainObject)["count"];

      if (typeof countValue === "number") {
        return countValue;
      }

      return Number(countValue ?? 0);
    },
  };
}

const delegateCache = new Map<string, unknown>();

const prisma = new Proxy(
  {
    async $connect() {
      await ensureDbConnected();
    },
    async $disconnect() {
      await db.runtime().close();
      runtimeConnectPromise = undefined;
    },
    async $transaction(input: unknown) {
      if (Array.isArray(input)) {
        return await Promise.all(input as readonly Promise<unknown>[]);
      }

      if (typeof input === "function") {
        return await (input as (client: unknown) => Promise<unknown>)(prisma);
      }

      throw new TypeError("$transaction() expects an array of promises or a callback.");
    },
  } as Record<string, unknown>,
  {
    get(target, prop, receiver) {
      if (typeof prop !== "string") {
        return Reflect.get(target, prop, receiver);
      }

      if (prop in target) {
        return Reflect.get(target, prop, receiver);
      }

      const existing = delegateCache.get(prop);
      if (existing) {
        return existing;
      }

      const delegate = createModelDelegate(prop);
      delegateCache.set(prop, delegate);
      return delegate;
    },
  },
);

export { db, ensureDbConnected };
export default prisma as any;
