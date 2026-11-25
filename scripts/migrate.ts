import fs from 'node:fs/promises';
import path from 'node:path';
import postgres from 'postgres';

for (const envFile of ['.env.local', '.env']) {
  try {
    process.loadEnvFile(envFile);
  } catch {
    // Ignore missing env file
  }
}

async function main() {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DIRECT_URL or DATABASE_URL must be set to run migrations.');
  }

  const sql = postgres(url, { max: 1 });
  try {
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS _clubar_migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    const drizzleDir = path.resolve(process.cwd(), 'drizzle');
    const files = (await fs.readdir(drizzleDir))
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const existing = await sql<{ name: string }[]>`
        SELECT name FROM _clubar_migrations WHERE name = ${file}
      `;
      if (existing.length > 0) {
        console.log(`Skipping already applied migration: ${file}`);
        continue;
      }

      const content = await fs.readFile(path.join(drizzleDir, file), 'utf8');
      await sql.begin(async (tx) => {
        await tx.unsafe(content);
        await tx`INSERT INTO _clubar_migrations (name) VALUES (${file})`;
      });
      console.log(`Applied migration: ${file}`);
    }
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
