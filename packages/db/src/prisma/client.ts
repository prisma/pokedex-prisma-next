import { ensureDbConnected, resetDbConnectionState, db } from "./db";

import type { Contract } from "../../prisma/generated/contract.d";
import type { PlainObject } from "./metadata";

import { resolveModelName } from "./metadata";
import {
  applyOrderBy,
  applySelection,
  applyWhere,
  withUpdatedAt,
} from "./query";
import { isPlainObject, normalizeRecord } from "./utils";

type PrismaModelDelegate = {
  findMany(args?: PlainObject): Promise<any[]>;
  findFirst(args?: PlainObject): Promise<any | null>;
  findUnique(args?: PlainObject): Promise<any | null>;
  findFirstOrThrow(args?: PlainObject): Promise<any>;
  findUniqueOrThrow(args?: PlainObject): Promise<any>;
  create(args: PlainObject): Promise<any>;
  createMany(args: PlainObject): Promise<{ count: number }>;
  update(args: PlainObject): Promise<any>;
  updateMany(args?: PlainObject): Promise<{ count: number }>;
  delete(args: PlainObject): Promise<any>;
  deleteMany(args?: PlainObject): Promise<{ count: number }>;
  count(args?: PlainObject): Promise<number>;
};

type KnownLiteralKeys<T> = {
  [K in keyof T]-?: K extends string
    ? string extends K
      ? never
      : K
    : K extends number
      ? number extends K
        ? never
        : K
      : K extends symbol
        ? symbol extends K
          ? never
          : K
        : never;
}[keyof T];

type PrismaModelKey = KnownLiteralKeys<Contract["mappings"]["tableToModel"]>;

export type PrismaClientLike = {
  $connect(): Promise<void>;
  $disconnect(): Promise<void>;
  $transaction(
    input:
      | readonly Promise<unknown>[]
      | ((client: PrismaClientLike) => Promise<unknown>),
  ): Promise<unknown>;
} & {
  [K in PrismaModelKey]: PrismaModelDelegate;
};

function getCollection(modelName: string): any {
  return (db.orm as Record<string, unknown>)[modelName];
}

function createModelDelegate(modelAlias: string): PrismaModelDelegate {
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

      const result = await query.update(withUpdatedAt(modelName, data));
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
      const count = await query.updateCount(withUpdatedAt(modelName, data));
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

export function createPrismaClient(): PrismaClientLike {
  const delegateCache = new Map<string, unknown>();

  const prisma = new Proxy(
    {
      async $connect() {
        await ensureDbConnected();
      },
      async $disconnect() {
        await db.runtime().close();
        resetDbConnectionState();
      },
      async $transaction(input: unknown) {
        if (Array.isArray(input)) {
          return await Promise.all(input as readonly Promise<unknown>[]);
        }

        if (typeof input === "function") {
          return await (input as (client: PrismaClientLike) => Promise<unknown>)(prismaTyped);
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

  const prismaTyped = prisma as unknown as PrismaClientLike;
  return prismaTyped;
}
