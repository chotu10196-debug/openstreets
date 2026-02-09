// Create database tables programmatically
require('dotenv/config');
const https = require('https');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL.replace('https://', '');
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const projectRef = 'xdgaapcmypoocyibkvzv';

// Read schema file
const fs = require('fs');
const schema = fs.readFileSync('./supabase-schema.sql', 'utf8');

console.log('🔧 Creating OpenStreet database tables...\n');

// Use Supabase's query endpoint
const options = {
  hostname: supabaseUrl,
  port: 443,
  path: '/rest/v1/rpc/exec',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey': supabaseKey,
    'Authorization': `Bearer ${supabaseKey}`,
    'Prefer': 'return=minimal'
  }
};

// Try using the query endpoint
// Note: This might not work depending on Supabase configuration
// If this fails, user will need to run SQL manually in dashboard

const data = JSON.stringify({
  query: schema
});

const req = https.request(options, (res) => {
  let body = '';
  
  res.on('data', (chunk) => {
    body += chunk;
  });
  
  res.on('end', () => {
    if (res.statusCode === 200 || res.statusCode === 201) {
      console.log('✅ Database tables created successfully!');
    } else {
      console.log('❌ Failed to create tables via API');
      console.log(`Status: ${res.statusCode}`);
      console.log(`Response: ${body}`);
      console.log('\n⚠️  Please run the SQL manually:');
      console.log('1. Go to: https://supabase.com/dashboard/project/xdgaapcmypoocyibkvzv/sql/new');
      console.log('2. Copy contents of supabase-schema.sql');
      console.log('3. Paste and click "Run"');
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Error:', error.message);
  console.log('\n⚠️  Please run the SQL manually in Supabase dashboard');
});

req.write(data);
req.end();
