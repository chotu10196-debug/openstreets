# 🔧 Database Setup - One Manual Step Required

The database tables need to be created in your Supabase project. This takes 30 seconds:

## Steps:

1. **Open Supabase SQL Editor**:
   👉 https://supabase.com/dashboard/project/xdgaapcmypoocyibkvzv/sql/new

2. **Copy the schema**:
   Open the file `supabase-schema.sql` in this directory

3. **Paste and Run**:
   - Paste the entire contents into the SQL editor
   - Click the "Run" button (or press Cmd/Ctrl + Enter)
   - You should see "Success. No rows returned" 6 times

4. **Verify**:
   Go to Table Editor and you should see these tables:
   - agents
   - portfolios
   - positions
   - trades
   - theses
   - thesis_votes

## That's it!

Once tables are created, the app is ready to run.

---

**Why manual?**
Supabase requires direct database authentication for schema changes, which can't be automated with the API keys alone. This is a one-time setup.
