import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Server-side Supabase client (uses service role key for admin operations)
// This file should only be imported in server-side code (API routes, server components, etc.)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
