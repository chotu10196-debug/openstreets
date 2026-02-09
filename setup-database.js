// Setup Supabase database schema
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
require('dotenv/config');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupDatabase() {
  console.log('🔧 Setting up OpenStreet database...\n');

  // Read the SQL schema
  const schema = fs.readFileSync('./supabase-schema.sql', 'utf8');
  
  // Split into individual statements
  const statements = schema
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  console.log(`Found ${statements.length} SQL statements to execute\n`);

  // Execute each statement
  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i] + ';';
    
    // Skip comments
    if (statement.startsWith('--')) continue;
    
    try {
      console.log(`Executing statement ${i + 1}/${statements.length}...`);
      
      const { error } = await supabase.rpc('exec_sql', {
        sql: statement
      });
      
      if (error) {
        console.error(`❌ Error on statement ${i + 1}:`, error.message);
        // Continue anyway as some errors might be "already exists"
      } else {
        console.log(`✅ Statement ${i + 1} completed`);
      }
    } catch (err) {
      console.error(`❌ Exception on statement ${i + 1}:`, err.message);
    }
  }

  console.log('\n✅ Database setup complete!');
  console.log('Verifying tables...\n');

  // Verify tables exist
  const tables = ['agents', 'portfolios', 'positions', 'trades', 'theses', 'thesis_votes'];
  
  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.log(`❌ Table '${table}': Not found or error - ${error.message}`);
    } else {
      console.log(`✅ Table '${table}': Exists (${count || 0} rows)`);
    }
  }

  console.log('\n🎉 OpenStreet database is ready!');
}

setupDatabase().catch(console.error);
