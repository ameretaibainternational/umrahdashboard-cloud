import postgres from 'postgres';
import fs from 'fs';

const dbUrl = 'postgresql://postgres.iwzkwkekrswptyipidzc:MIFRlD0x75iMPtFD@aws-1-ap-south-1.pooler.supabase.com:6543/postgres';

const sql = postgres(dbUrl, {
  ssl: 'require',
  prepare: false,
  connect_timeout: 15000,
});

async function main() {
  try {
    const migrationPath = './supabase/migrations/021_transport_matrix.sql';
    console.log('Reading migration file:', migrationPath);
    const sqlContent = fs.readFileSync(migrationPath, 'utf8');

    console.log('Executing migration SQL on database...');
    await sql.unsafe(sqlContent);
    console.log('Migration executed successfully!');

    // Notify schema reload
    await sql.unsafe("NOTIFY pgrst, 'reload schema';");
    console.log('PostgREST schema cache reloaded.');
  } catch (error) {
    console.error('Error running migration:', error);
  } finally {
    await sql.end();
  }
}

main();
