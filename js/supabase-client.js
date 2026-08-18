// Requires config.js (SUPABASE_URL / SUPABASE_ANON_KEY) and the Supabase CDN script
// to be loaded first. Falls back to null when not configured yet, so the app keeps
// working with the old base64-in-URL flow until a project is wired up.
const supabaseClient =
  typeof SUPABASE_URL !== "undefined" && SUPABASE_URL && typeof supabase !== "undefined"
    ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;
