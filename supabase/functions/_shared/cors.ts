// supabase/functions/_shared/cors.ts
// Shared CORS headers for all guest-facing Edge Functions.
// Source: [VERIFIED: supabase.com/docs/guides/functions/cors]
// Pattern 1 from RESEARCH.md

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
