import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Server-only Supabase client. Never import this into a "use client" component.
// Uses the service-role key so it can read rappers/tracks and insert vote results.
// Created lazily so `next build` doesn't fail when env vars are absent at build time.
let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars. See .env.example.",
    );
  }

  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}
