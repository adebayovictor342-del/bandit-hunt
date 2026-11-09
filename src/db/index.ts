import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL ?? null;

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

const ensurePool = () => {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  if (!globalForDb.__arenaNextJsPostgresqlPool) {
    globalForDb.__arenaNextJsPostgresqlPool = new Pool({
      connectionString: databaseUrl,
    });
  }

  return globalForDb.__arenaNextJsPostgresqlPool;
};

export const pool = databaseUrl ? ensurePool() : undefined;

if (process.env.NODE_ENV !== "production" && databaseUrl) {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
}

let dbInstance: ReturnType<typeof drizzle> | undefined;

export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_target, prop, receiver) {
    if (!databaseUrl) {
      throw new Error("DATABASE_URL is required");
    }

    if (!dbInstance) {
      dbInstance = drizzle(ensurePool());
    }

    const value = Reflect.get(dbInstance, prop, receiver);
    return typeof value === "function" ? value.bind(dbInstance) : value;
  },
});
