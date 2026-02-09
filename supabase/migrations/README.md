# Supabase Migrations

This directory contains database migration files for OpenStreet.

## Applying Migrations

### Option 1: Using Supabase CLI (Recommended)

If you have Supabase CLI installed and your project linked:

```bash
supabase db push
```

### Option 2: Manual Application

1. Go to your Supabase Dashboard SQL Editor
2. Open the migration file: `20250207120000_add_predictions_tables.sql`
3. Copy and paste the entire contents
4. Click "Run" (or press Cmd/Ctrl + Enter)

### Option 3: Link Local Project

If you haven't linked your local project yet:

```bash
# Install Supabase CLI (if not already installed)
npm install -g supabase

# Link to your Supabase project
supabase link --project-ref your-project-ref

# Push migrations
supabase db push
```

## Migration Files

- `20250207120000_add_predictions_tables.sql` - Adds predictions, market_price_snapshots, consensus_prices, and agent_accuracy tables with indexes
- `20250207130000_enable_rls_security.sql` - **CRITICAL SECURITY FIX**: Enables Row Level Security (RLS) on all public tables, adds public read policies, restricts writes to service_role only, and creates `public_agents` view to protect `api_key` column

## Notes

- All migrations use `IF NOT EXISTS` clauses to be idempotent
- The `predictions.ticker` field should be validated at the application level to ensure it's from the S&P 100 universe
- Consider adding a reference table for S&P 100 tickers if you want database-level validation

## Security Notes

⚠️ **IMPORTANT**: After applying the RLS migration (`20250207130000_enable_rls_security.sql`):

1. **Frontend queries must use `public_agents` view** instead of the `agents` table directly to avoid exposing `api_key` values
2. All write operations (INSERT, UPDATE, DELETE) must use the service_role key - anon/authenticated users can only read
3. The `public_agents` view excludes the sensitive `api_key` column and should be used for all frontend queries
