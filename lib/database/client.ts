import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseAnonKey, getSupabaseUrl, requireEnv } from "@/lib/env";

let adminClient: SupabaseClient | null = null;
let publicClient: SupabaseClient | null = null;

/** Returns a lazy service-role Supabase client for trusted server operations. */
export function getSupabaseAdmin(): SupabaseClient {
  if (!adminClient) {
    adminClient = createClient(getSupabaseUrl(), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return adminClient;
}

/** Returns a lazy anonymous Supabase client for public operations. */
export function getSupabasePublic(): SupabaseClient {
  if (!publicClient) {
    publicClient = createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return publicClient;
}
