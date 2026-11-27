import postgres from 'postgres';

for (const envFile of ['.env.local', '.env']) {
  try {
    process.loadEnvFile(envFile);
  } catch {
    // Ignore missing env file
  }
}

function quoteIdent(ident: string): string {
  return `"${ident.replace(/"/g, '""')}"`;
}

async function main() {
  if (process.env.CONFIRM_V2_RESET !== 'true') {
    throw new Error('Refusing reset without CONFIRM_V2_RESET=true');
  }
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DIRECT_URL or DATABASE_URL must be set to run reset-v2-db.');
  }

  const sql = postgres(url, { max: 1 });
  try {
    // Preserve Supabase `public` schema grants and extensions; drop only user tables & enums.
    const tables = await sql<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    `;
    for (const { tablename } of tables) {
      await sql.unsafe(`DROP TABLE IF EXISTS public.${quoteIdent(tablename)} CASCADE;`);
    }

    const enums = await sql<{ typname: string }[]>`
      SELECT t.typname
      FROM pg_type t
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public' AND t.typtype = 'e'
    `;
    for (const { typname } of enums) {
      await sql.unsafe(`DROP TYPE IF EXISTS public.${quoteIdent(typname)} CASCADE;`);
    }

    console.log(
      `Reset complete: dropped ${tables.length} tables and ${enums.length} enums in public schema.`
    );
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error('Reset v2 DB failed:', err);
  process.exit(1);
});
