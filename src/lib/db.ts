/* Azm — database access (Prisma + SQLite).
 *
 * Why this file is more than `new PrismaClient()`:
 *  - The client is created LAZILY, on first use. Previously it was constructed
 *    while the module was being imported, so a missing/ungenerated Prisma
 *    client or an unusable engine crashed the import of every API route that
 *    touches the database. Next.js then answered with a bare HTTP 500 (HTML),
 *    which the web UI could only report as "network error" — for the AI
 *    connection test, the pairing-token button and the workspace code alike.
 *    Now the failure happens inside each route's own try/catch and carries a
 *    readable message (see describeDbError).
 *  - DATABASE_URL is honoured exactly as configured. Only when it points into
 *    a directory that does not exist on this machine (e.g. the project was
 *    moved away from the path baked into .env) does it fall back to
 *    <cwd>/db/custom.db, with a warning in the server log.
 *  - Query logging is limited to warnings/errors: logging every query also
 *    logs bound parameters, which include API keys stored in the profile.
 */

import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/** The datasource URL to use, or undefined to let Prisma read DATABASE_URL itself. */
export function resolveDatabaseUrl(): string | undefined {
  const raw = process.env.DATABASE_URL?.trim();
  const fallback = path.join(process.cwd(), "db", "custom.db");

  if (!raw) {
    // No configuration at all: use the project-local database.
    return fs.existsSync(path.dirname(fallback)) ? `file:${fallback}` : undefined;
  }
  if (!raw.startsWith("file:")) return undefined; // not SQLite — leave to Prisma

  const target = raw.slice("file:".length).split("?")[0] ?? "";
  if (!path.isAbsolute(target)) return undefined; // relative paths are resolved by Prisma
  if (fs.existsSync(path.dirname(target))) return undefined; // configured path is usable

  if (fs.existsSync(path.dirname(fallback))) {
    console.warn(
      `[azm-db] DATABASE_URL points to "${target}" but its directory does not exist here; using "${fallback}" instead.`
    );
    return `file:${fallback}`;
  }
  return undefined;
}

function createClient(): PrismaClient {
  const url = resolveDatabaseUrl();
  return new PrismaClient({
    log: ["error", "warn"],
    ...(url ? { datasources: { db: { url } } } : {}),
  });
}

function getClient(): PrismaClient {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;
  const client = createClient(); // throws a readable error if the client was never generated
  // cache in every environment: one client per server process
  globalForPrisma.prisma = client;
  return client;
}

/** Same surface as PrismaClient (db.profile.findUnique(...), …), created on first access. */
export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getClient();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

/**
 * Turn a low-level database failure into one actionable sentence for the UI /
 * logs. Never includes connection strings or query parameters.
 */
export function describeDbError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e ?? "");
  if (/did not initialize yet|prisma generate|Cannot find module '\.prisma|\.prisma\/client/i.test(msg)) {
    return "Database client is not generated on the server — run `bun run db:generate` (prisma generate) and restart.";
  }
  if (/query engine|libquery_engine|could not be found|binary target|PrismaClientInitializationError/i.test(msg)) {
    return "The Prisma database engine could not start on this server (missing or incompatible engine binary) — regenerate the client on the server's platform (`bun run db:generate`).";
  }
  if (/unable to open database file|SQLITE_CANTOPEN|Error code 14|no such table|does not exist in the current database/i.test(msg)) {
    return "The database file or its tables are missing — check DATABASE_URL and run `bun run db:push`.";
  }
  if (/readonly|read-only|SQLITE_READONLY|attempt to write a readonly database/i.test(msg)) {
    return "The database file is read-only for the server process — make db/custom.db and its folder writable.";
  }
  return "Unexpected server error — see the server log.";
}
