import { all, and, not, or } from "@prisma-next/sql-orm-client";

import {
  getModelMetadata,
  resolveRelationName,
  type PlainObject,
} from "./metadata";
import { isPlainObject, normalizeRecord, normalizeValue } from "./utils";

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

export function applyWhere(
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

export function applyOrderBy(collection: any, orderBy: unknown): any {
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
  if (relatedModelName && (isPlainObject(nestedSelect) || isPlainObject(nestedInclude))) {
    next = applySelection(next, relatedModelName, nestedSelect, nestedInclude);
  }

  return next;
}

export function applySelection(
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
        refineRelationCollection(
          relatedCollection,
          metadata.relationTargets.get(relationName),
          includeValue,
        ),
      );
    }
  }

  if (scalarFields.size > 0) {
    next = next.select(...Array.from(scalarFields));
  }

  return next;
}

export function withUpdatedAt(modelName: string, data: PlainObject): PlainObject {
  const metadata = getModelMetadata(modelName);
  if (!metadata.fields.has("updatedAt") || "updatedAt" in data) {
    return data;
  }

  return normalizeRecord({
    ...data,
    updatedAt: new Date().toISOString(),
  });
}
