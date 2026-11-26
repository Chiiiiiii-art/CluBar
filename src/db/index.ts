import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export type CluBarDb = PostgresJsDatabase<typeof schema>;

declare global {
  // eslint-disable-next-line no-var
  var __clubarSql: ReturnType<typeof postgres> | undefined;
  // eslint-disable-next-line no-var
  var __clubarDb: CluBarDb | undefined;
}

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

/**
 * Lazily creates the PostgreSQL + Drizzle singleton using `{ prepare: false }`
 * for Supabase PgBouncer transaction pooler compatibility.
 * Safe to import during `next build` when DATABASE_URL is unset.
 */
export function getDb(): CluBarDb {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error('DATABASE_URL is not configured.');
  }
  if (!globalThis.__clubarSql) {
    globalThis.__clubarSql = postgres(url, {
      prepare: false,
      max: 5,
      // ponytail: recycle idle sockets before Supavisor or Vercel container freeze leaves dead half-open TCP sockets.
      idle_timeout: 15,
      max_lifetime: 60 * 5,
      connect_timeout: 10,
    });
  }
  if (!globalThis.__clubarDb) {
    globalThis.__clubarDb = drizzle(globalThis.__clubarSql, { schema });
  }
  return globalThis.__clubarDb;
}

export const db: CluBarDb = new Proxy({} as CluBarDb, {
  get(_target, prop) {
    const instance = getDb() as unknown as Record<string | symbol, unknown>;
    const value = instance[prop];
    return typeof value === 'function' ? value.bind(instance) : value;
  },
});

export async function closeDb(): Promise<void> {
  if (globalThis.__clubarSql) {
    await globalThis.__clubarSql.end();
    globalThis.__clubarSql = undefined;
    globalThis.__clubarDb = undefined;
  }
}

export { schema };
