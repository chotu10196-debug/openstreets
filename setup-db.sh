#!/bin/bash

# Setup OpenStreet database on Supabase

set -e

source .env

echo "🔧 Setting up OpenStreet database..."
echo ""

# Use Supabase Management API to execute SQL
# Note: This requires using psql or the Supabase dashboard
# For now, we'll create tables one by one using the JS client

node -e "
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  '$NEXT_PUBLIC_SUPABASE_URL',
  '$SUPABASE_SERVICE_ROLE_KEY'
);

async function setup() {
  console.log('Creating tables...');
  
  // Try to query each table to see if it exists
  const tables = ['agents', 'portfolios', 'positions', 'trades', 'theses', 'thesis_votes'];
  
  for (const table of tables) {
    try {
      const { data, error } = await supabase.from(table).select('*').limit(1);
      if (error) {
        console.log(\`❌ Table '\${table}' not found: \${error.message}\`);
      } else {
        console.log(\`✅ Table '\${table}' exists\`);
      }
    } catch (err) {
      console.log(\`❌ Error checking table '\${table}': \${err.message}\`);
    }
  }
}

setup().catch(console.error);
"

echo ""
echo "⚠️  To complete setup, run the SQL in supabase-schema.sql"
echo "   Go to: https://supabase.com/dashboard/project/xdgaapcmypoocyibkvzv/editor"
echo "   Copy/paste the contents of supabase-schema.sql"
echo "   Click 'Run'"
