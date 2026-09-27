// Shared CORS headers for every Edge Function in this project.
//
// The mobile app itself (via @supabase/supabase-js's `functions.invoke`)
// doesn't need this — React Native's fetch doesn't enforce browser CORS.
// It matters for anything else that might call these functions directly:
// a future admin dashboard, manual testing from a browser devtools
// console, curl-from-browser tooling. Every function should call
// `handleCors(req)` first and spread `corsHeaders` into every Response it
// returns.
export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/** Returns a preflight Response if this is an OPTIONS request, else null (caller should continue handling the real request). */
export function handleCorsPreflight(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  return null;
}

export function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
