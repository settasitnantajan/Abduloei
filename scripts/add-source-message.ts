import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgresql://postgres.faxauzhlgrfuhfvlybbg:nvNqHihBbesBMTt8@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false },
});

async function main() {
  try {
    await pool.query('ALTER TABLE events ADD COLUMN IF NOT EXISTS source_message TEXT;');
    console.log('✅ เพิ่ม column source_message สำเร็จ');
  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    await pool.end();
  }
}

main();
