import postgres from 'postgres';

const dbUrl = 'postgresql://postgres.iwzkwkekrswptyipidzc:MIFRlD0x75iMPtFD@aws-1-ap-south-1.pooler.supabase.com:6543/postgres';

const sql = postgres(dbUrl, {
  ssl: 'require',
  prepare: false,
  connect_timeout: 5000,
});

async function main() {
  try {
    console.log('Testing connection to Supabase Postgres...');
    const result = await sql`SELECT 1 as connected;`;
    console.log('Connection successful! Query result:', result);
  } catch (error) {
    console.error('Connection failed:', error.message);
  } finally {
    await sql.end();
  }
}

main();
