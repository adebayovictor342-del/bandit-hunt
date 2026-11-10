import { drizzle } from "drizzle-orm/node-postgres";
import { Pool, type PoolConfig } from "pg";

const databaseUrl = process.env.DATABASE_URL?.trim() || null;

/**
 * Core tables from `src/db/schema.ts`, created on first connection so a fresh
 * PostgreSQL database (for example a new Supabase project) works without a
 * separate migration step. Admin/presence tables are created in admin.server.ts.
 */
const BOOTSTRAP_SQL = `
CREATE TABLE IF NOT EXISTS players (
  id varchar(64) PRIMARY KEY,
  name varchar(24) NOT NULL,
  email varchar(254) UNIQUE,
  password_hash varchar(255),
  gender varchar(8) NOT NULL DEFAULT 'male',
  face varchar(8) NOT NULL DEFAULT '🧑‍🚀',
  sambisa_highscore integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS scores (
  id serial PRIMARY KEY,
  player_id varchar(64) NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  xp integer NOT NULL,
  kills integer NOT NULL DEFAULT 0,
  zone varchar(16) NOT NULL DEFAULT 'forest',
  mode varchar(16) NOT NULL DEFAULT 'journey',
  duration_ms integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS scores_player_idx ON scores (player_id);
CREATE INDEX IF NOT EXISTS scores_created_idx ON scores (created_at);
CREATE INDEX IF NOT EXISTS scores_xp_idx ON scores (xp);
CREATE TABLE IF NOT EXISTS battles (
  id serial PRIMARY KEY,
  player_id varchar(64) NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  format varchar(8) NOT NULL,
  zone varchar(16) NOT NULL,
  won integer NOT NULL DEFAULT 0,
  net_score integer NOT NULL DEFAULT 0,
  mmr_delta integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash varchar(64) PRIMARY KEY,
  player_id varchar(64) NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_player_idx ON sessions (player_id);
CREATE TABLE IF NOT EXISTS ad_events (
  id serial PRIMARY KEY,
  campaign varchar(80) NOT NULL,
  kind varchar(16) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
`;

function poolConfig(url: string): PoolConfig {
  let connectionString = url;
  let ssl: PoolConfig["ssl"] = undefined;
  try {
    const parsed = new URL(url);
    const local = ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
    const sslmode = parsed.searchParams.get("sslmode");
    if (!local && sslmode !== "disable") {
      // Hosted Postgres (Supabase etc.) requires TLS. Supabase's certificate chain
      // is not in Node's default CA store, so encrypt without CA verification.
      // `sslmode` is removed because pg would otherwise override this setting.
      parsed.searchParams.delete("sslmode");
      connectionString = parsed.toString();
      ssl = { rejectUnauthorized: false };
    }
  } catch {
    // Leave unparseable values to pg, which reports a clearer error.
  }
  return {
    connectionString,
    ssl,
    // Serverless functions run many short-lived instances; keep each pool small.
    max: 3,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  };
}

class BootstrappingPool extends Pool {
  private ready: Promise<void> | null = null;

  private ensureSchema() {
    if (!this.ready) {
      // Use the base connect() so the bootstrap is not gated on itself.
      this.ready = super.connect().then(async (client) => {
        try {
          await client.query(BOOTSTRAP_SQL);
        } finally {
          client.release();
        }
      }).catch((error) => {
        this.ready = null;
        throw error;
      });
    }
    return this.ready;
  }

  // pg's Pool.query() acquires clients through connect(), so gating connect()
  // covers both plain queries and transactions.
   
  connect(...args: any[]): any {
     
    const run = () => (super.connect as (...a: any[]) => any).apply(this, args);
    if (typeof args[0] === "function") {
      this.ensureSchema().then(run, args[0]);
      return undefined;
    }
    return this.ensureSchema().then(run);
  }
}

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

const ensurePool = () => {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  if (!globalForDb.__arenaNextJsPostgresqlPool) {
    const pool = new BootstrappingPool(poolConfig(databaseUrl));
    pool.on("error", (error) => console.error("PostgreSQL pool error", error.message));
    globalForDb.__arenaNextJsPostgresqlPool = pool;
  }

  return globalForDb.__arenaNextJsPostgresqlPool;
};

export const pool = databaseUrl ? ensurePool() : undefined;

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
