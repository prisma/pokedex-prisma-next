import type { CodecTypes } from "@prisma-next/adapter-postgres/codec-types";

import {
  boolColumn,
  int4Column,
  textColumn,
  timestamptzColumn,
} from "@prisma-next/adapter-postgres/column-types";
import { defineContract } from "@prisma-next/sql-contract-ts/contract-builder";
import postgresPack from "@prisma-next/target-postgres/pack";

export const contract: unknown = defineContract<CodecTypes>()
  .target(postgresPack)
  .table("user", (t) =>
    t
      .column("id", { type: textColumn, nullable: false })
      .column("name", { type: textColumn, nullable: false })
      .column("email", { type: textColumn, nullable: false })
      .column("emailVerified", {
        type: boolColumn,
        nullable: false,
        default: { kind: "literal", value: false },
      })
      .column("image", { type: textColumn, nullable: true })
      .column("createdAt", {
        type: timestamptzColumn,
        nullable: false,
        default: { kind: "function", expression: "now()" },
      })
      .column("updatedAt", {
        type: timestamptzColumn,
        nullable: false,
        default: { kind: "function", expression: "now()" },
      })
      .primaryKey(["id"])
      .unique(["email"]),
  )
  .table("session", (t) =>
    t
      .column("id", { type: textColumn, nullable: false })
      .column("expiresAt", { type: timestamptzColumn, nullable: false })
      .column("token", { type: textColumn, nullable: false })
      .column("createdAt", {
        type: timestamptzColumn,
        nullable: false,
        default: { kind: "function", expression: "now()" },
      })
      .column("updatedAt", {
        type: timestamptzColumn,
        nullable: false,
        default: { kind: "function", expression: "now()" },
      })
      .column("ipAddress", { type: textColumn, nullable: true })
      .column("userAgent", { type: textColumn, nullable: true })
      .column("userId", { type: textColumn, nullable: false })
      .primaryKey(["id"])
      .unique(["token"])
      .index(["userId"])
      .foreignKey(["userId"], { table: "user", columns: ["id"] }, { onDelete: "cascade" }),
  )
  .table("account", (t) =>
    t
      .column("id", { type: textColumn, nullable: false })
      .column("accountId", { type: textColumn, nullable: false })
      .column("providerId", { type: textColumn, nullable: false })
      .column("userId", { type: textColumn, nullable: false })
      .column("accessToken", { type: textColumn, nullable: true })
      .column("refreshToken", { type: textColumn, nullable: true })
      .column("idToken", { type: textColumn, nullable: true })
      .column("accessTokenExpiresAt", { type: timestamptzColumn, nullable: true })
      .column("refreshTokenExpiresAt", { type: timestamptzColumn, nullable: true })
      .column("scope", { type: textColumn, nullable: true })
      .column("password", { type: textColumn, nullable: true })
      .column("createdAt", {
        type: timestamptzColumn,
        nullable: false,
        default: { kind: "function", expression: "now()" },
      })
      .column("updatedAt", {
        type: timestamptzColumn,
        nullable: false,
        default: { kind: "function", expression: "now()" },
      })
      .primaryKey(["id"])
      .index(["userId"])
      .foreignKey(["userId"], { table: "user", columns: ["id"] }, { onDelete: "cascade" }),
  )
  .table("verification", (t) =>
    t
      .column("id", { type: textColumn, nullable: false })
      .column("identifier", { type: textColumn, nullable: false })
      .column("value", { type: textColumn, nullable: false })
      .column("expiresAt", { type: timestamptzColumn, nullable: false })
      .column("createdAt", {
        type: timestamptzColumn,
        nullable: false,
        default: { kind: "function", expression: "now()" },
      })
      .column("updatedAt", {
        type: timestamptzColumn,
        nullable: false,
        default: { kind: "function", expression: "now()" },
      })
      .primaryKey(["id"])
      .index(["identifier"]),
  )
  .table("todo", (t) =>
    t
      .column("id", {
        type: int4Column,
        nullable: false,
        default: { kind: "function", expression: "autoincrement()" },
      })
      .column("text", { type: textColumn, nullable: false })
      .column("completed", {
        type: boolColumn,
        nullable: false,
        default: { kind: "literal", value: false },
      })
      .primaryKey(["id"]),
  )
  .model("User", "user", (m) =>
    m
      .field("id", "id")
      .field("name", "name")
      .field("email", "email")
      .field("emailVerified", "emailVerified")
      .field("image", "image")
      .field("createdAt", "createdAt")
      .field("updatedAt", "updatedAt")
      .relation("sessions", {
        toModel: "Session",
        toTable: "session",
        cardinality: "1:N",
        on: {
          parentTable: "user",
          parentColumns: ["id"],
          childTable: "session",
          childColumns: ["userId"],
        },
      })
      .relation("accounts", {
        toModel: "Account",
        toTable: "account",
        cardinality: "1:N",
        on: {
          parentTable: "user",
          parentColumns: ["id"],
          childTable: "account",
          childColumns: ["userId"],
        },
      }),
  )
  .model("Session", "session", (m) =>
    m
      .field("id", "id")
      .field("expiresAt", "expiresAt")
      .field("token", "token")
      .field("createdAt", "createdAt")
      .field("updatedAt", "updatedAt")
      .field("ipAddress", "ipAddress")
      .field("userAgent", "userAgent")
      .field("userId", "userId")
      .relation("user", {
        toModel: "User",
        toTable: "user",
        cardinality: "N:1",
        on: {
          parentTable: "session",
          parentColumns: ["userId"],
          childTable: "user",
          childColumns: ["id"],
        },
      }),
  )
  .model("Account", "account", (m) =>
    m
      .field("id", "id")
      .field("accountId", "accountId")
      .field("providerId", "providerId")
      .field("userId", "userId")
      .field("accessToken", "accessToken")
      .field("refreshToken", "refreshToken")
      .field("idToken", "idToken")
      .field("accessTokenExpiresAt", "accessTokenExpiresAt")
      .field("refreshTokenExpiresAt", "refreshTokenExpiresAt")
      .field("scope", "scope")
      .field("password", "password")
      .field("createdAt", "createdAt")
      .field("updatedAt", "updatedAt")
      .relation("user", {
        toModel: "User",
        toTable: "user",
        cardinality: "N:1",
        on: {
          parentTable: "account",
          parentColumns: ["userId"],
          childTable: "user",
          childColumns: ["id"],
        },
      }),
  )
  .model("Verification", "verification", (m) =>
    m
      .field("id", "id")
      .field("identifier", "identifier")
      .field("value", "value")
      .field("expiresAt", "expiresAt")
      .field("createdAt", "createdAt")
      .field("updatedAt", "updatedAt"),
  )
  .model("Todo", "todo", (m) =>
    m.field("id", "id").field("text", "text").field("completed", "completed"),
  )
  .capabilities({
    postgres: {
      lateral: true,
      jsonAgg: true,
      returning: true,
      "defaults.now": true,
    },
  })
  .build();
