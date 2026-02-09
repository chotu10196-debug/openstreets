// Setup database schema using direct PostgreSQL connection
require('dotenv/config');
const { Client } = require('pg');
const fs = require('fs');

// Construct connection string
// Supabase format: postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres
const connectionString = `postgresql://postgres.xdgaapcmypoocyibkvzv:${process.env.SUPABASE_SERVICE_ROLE_KEY}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`;

async function setupSchema() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔧 Connecting to Supabase database...');
    await client.connect();
    console.log('✅ Connected!\n');

    // Read schema file
    const schema = fs.readFileSync('./supabase-schema.sql', 'utf8');
    
    console.log('📝 Executing schema SQL...\n');
    await client.query(schema);
    
    console.log('✅ Schema created successfully!\n');

    // Verify tables
    const tables = ['agents', 'portfolios', 'positions', 'trades', 'theses', 'thesis_votes'];
    console.log('🔍 Verifying tables...\n');
    
    for (const table of tables) {
      const result = await client.query(`SELECT COUNT(*) FROM ${table}`);
      console.log(`✅ Table '${table}': ${result.rows[0].count} rows`);
    }

    console.log('\n🎉 Database setup complete!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n⚠️  If this fails, you can manually run the SQL:');
    console.log('   Go to: https://supabase.com/dashboard/project/xdgaapcmypoocyibkvzv/sql/new');
    console.log('   Copy contents of supabase-schema.sql and click "Run"');
  } finally {
    await client.end();
  }
}

setupSchema();
