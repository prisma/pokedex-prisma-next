import { db } from "./db";

export type PlainObject = Record<string, unknown>;

type ModelDefinition = {
  fields?: Record<string, unknown>;
  relations?: Record<string, { toModel?: string }>;
};

type ModelMetadata = {
  fields: Set<string>;
  relationAliases: Map<string, string>;
  relationTargets: Map<string, string | undefined>;
};

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

export function resolveModelName(input: string): string {
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

export function getModelMetadata(modelName: string): ModelMetadata {
  const metadata = modelMetadata.get(modelName);
  if (!metadata) {
    throw new Error(`Missing metadata for model "${modelName}"`);
  }
  return metadata;
}

export function resolveRelationName(
  metadata: ModelMetadata,
  candidate: string,
): string | undefined {
  return metadata.relationAliases.get(candidate);
}
