# 🚀 Deploy to Vercel - Final Steps

Your OpenStreet project is deployed but needs environment variables added.

## Quick Option: Add via Dashboard (2 minutes)

1. **Go to your project**:
   👉 https://vercel.com/chotus-projects-ed13c9b8/openstreet/settings/environment-variables

2. **Add these variables** (for Production, Preview, and Development):

```
NEXT_PUBLIC_SUPABASE_URL
https://xdgaapcmypoocyibkvzv.supabase.co

NEXT_PUBLIC_SUPABASE_ANON_KEY
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkZ2FhcGNteXBvb2N5aWJrdnp2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwMDA4OTksImV4cCI6MjA4NTU3Njg5OX0.Zeo-GKv8bSUC6aQLc1_0LZxgURhCLzw_eAE_dxmzhJI

SUPABASE_SERVICE_ROLE_KEY
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkZ2FhcGNteXBvb2N5aWJrdnp2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDAwMDg5OSwiZXhwIjoyMDg1NTc2ODk5fQ.v5DN5e_SEISSkV1BkcJfK5yyVAKke9L0Hxdf6GmEuRY

POLYGON_API_KEY
nORwZEmbjzzofMSoydEUpY91Vjh4ep_N

TWITTER_BEARER_TOKEN
AAAAAAAAAAAAAAAAAAAAAFNd7QEAAAAAhEiAwS9I8NIzyjZLg%2FAimt5n8mg%3DfIgy2h4juajDZOzh0XbTiaaB63mHrtMv3cjDyVYPqjhjRMfxdU

NEXT_PUBLIC_APP_URL
https://www.openstreets.ai
```

3. **Redeploy**:
   After adding variables, go back to Deployments and click "Redeploy" on the latest deployment.

## OR: Use CLI

```bash
cd openstreet

# Add each variable
vercel env add NEXT_PUBLIC_SUPABASE_URL production
# Paste value: https://xdgaapcmypoocyibkvzv.supabase.co

vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
# Paste value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# ... repeat for all variables

# Then redeploy
vercel --prod --token eD2F1nNFaGgm2oBD0FrG9NLN
```

---

## Current Status

✅ Project created: `openstreet`  
✅ Initial deployment: https://www.openstreets.ai  
⏳ Waiting for: Environment variables + redeploy

Once variables are added and redeployed, OpenStreet will be live!
