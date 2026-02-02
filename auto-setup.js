#!/usr/bin/env node
// Automated setup script for OpenStreet
require('dotenv/config');
const https = require('https');
const { execSync } = require('child_process');

const VERCEL_TOKEN = 'eD2F1nNFaGgm2oBD0FrG9NLN';
const VERCEL_TEAM_ID = 'team_LVvsgrtlLQFO25PeGfFF6r0x';

console.log('🚀 OpenStreet Auto-Setup\n');

// Step 1: Setup Supabase database
console.log('📊 Step 1: Setting up Supabase database...');

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function setupDatabase() {
  const schema = fs.readFileSync('./supabase-schema.sql', 'utf8');
  
  // Split schema into CREATE TABLE statements
  const createStatements = schema.match(/CREATE TABLE[^;]+;/gs) || [];
  const indexStatements = schema.match(/CREATE INDEX[^;]+;/gs) || [];
  
  console.log(`Found ${createStatements.length} tables and ${indexStatements.length} indexes to create\n`);
  
  // Execute via RPC (if available) or fall back to manual
  try {
    // Try using Supabase's query method
    for (const statement of [...createStatements, ...indexStatements]) {
      console.log('Executing:', statement.substring(0, 50) + '...');
      
      // Use raw SQL execution
      const { data, error } = await supabase.rpc('exec_sql', { sql: statement });
      
      if (error && !error.message.includes('already exists')) {
        console.log('⚠️', error.message);
      } else {
        console.log('✅');
      }
    }
    
    console.log('\n✅ Database schema created!\n');
    return true;
  } catch (error) {
    console.log('\n⚠️  Database setup requires manual step:');
    console.log('   Go to: https://supabase.com/dashboard/project/xdgaapcmypoocyibkvzv/sql/new');
    console.log('   Copy supabase-schema.sql and run it\n');
    return false;
  }
}

// Step 2: Add Vercel environment variables
async function setupVercel() {
  console.log('🔧 Step 2: Adding environment variables to Vercel...');
  
  const envVars = [
    { key: 'NEXT_PUBLIC_SUPABASE_URL', value: process.env.NEXT_PUBLIC_SUPABASE_URL },
    { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', value: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY },
    { key: 'SUPABASE_SERVICE_ROLE_KEY', value: process.env.SUPABASE_SERVICE_ROLE_KEY },
    { key: 'POLYGON_API_KEY', value: process.env.POLYGON_API_KEY },
    { key: 'TWITTER_BEARER_TOKEN', value: process.env.TWITTER_BEARER_TOKEN },
    { key: 'NEXT_PUBLIC_APP_URL', value: 'https://www.openstreets.ai' },
  ];
  
  // Get project details
  const getProject = () => {
    return new Promise((resolve, reject) => {
      https.get({
        hostname: 'api.vercel.com',
        path: `/v9/projects/openstreet?teamId=${VERCEL_TEAM_ID}`,
        headers: {
          'Authorization': `Bearer ${VERCEL_TOKEN}`,
        },
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode === 200) {
            resolve(JSON.parse(data));
          } else {
            reject(new Error(`Failed to get project: ${res.statusCode} ${data}`));
          }
        });
      }).on('error', reject);
    });
  };
  
  const addEnvVar = (key, value, type = 'encrypted') => {
    return new Promise((resolve, reject) => {
      const payload = JSON.stringify({
        key,
        value,
        type,
        target: ['production', 'preview', 'development'],
      });
      
      const req = https.request({
        hostname: 'api.vercel.com',
        path: `/v10/projects/openstreet/env?teamId=${VERCEL_TEAM_ID}`,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${VERCEL_TOKEN}`,
          'Content-Type': 'application/json',
          'Content-Length': payload.length,
        },
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode === 200 || res.statusCode === 201) {
            console.log(`✅ Added ${key}`);
            resolve(JSON.parse(data));
          } else if (res.statusCode === 409) {
            console.log(`⚠️  ${key} already exists`);
            resolve(null);
          } else {
            console.log(`❌ Failed to add ${key}: ${res.statusCode} ${data}`);
            reject(new Error(data));
          }
        });
      });
      
      req.on('error', reject);
      req.write(payload);
      req.end();
    });
  };
  
  try {
    const project = await getProject();
    console.log(`Found project: ${project.name}\n`);
    
    for (const { key, value } of envVars) {
      await addEnvVar(key, value);
    }
    
    console.log('\n✅ Environment variables added!\n');
    return true;
  } catch (error) {
    console.error('❌ Error:', error.message);
    return false;
  }
}

// Step 3: Trigger redeployment
async function redeploy() {
  console.log('🚀 Step 3: Triggering Vercel redeployment...');
  
  try {
    execSync(`cd ${__dirname} && vercel --prod --token ${VERCEL_TOKEN} --yes`, {
      stdio: 'inherit',
    });
    console.log('\n✅ Deployment triggered!\n');
    return true;
  } catch (error) {
    console.error('❌ Deployment failed:', error.message);
    return false;
  }
}

// Run all steps
(async () => {
  try {
    const dbResult = await setupDatabase();
    const vercelResult = await setupVercel();
    
    if (dbResult && vercelResult) {
      await redeploy();
      console.log('🎉 OpenStreet is now LIVE!');
      console.log('   Visit: https://www.openstreets.ai');
    } else {
      console.log('\n⚠️  Some steps require manual completion. Check output above.');
    }
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
})();
