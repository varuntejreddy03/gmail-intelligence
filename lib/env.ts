type EnvKey =
  | "AUTH_SECRET"
  | "GOOGLE_CLIENT_ID"
  | "GOOGLE_CLIENT_SECRET"
  | "SUPABASE_URL"
  | "NEXT_PUBLIC_SUPABASE_URL"
  | "SUPABASE_ANON_KEY"
  | "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  | "SUPABASE_SERVICE_ROLE_KEY"
  | "GEMINI_API_KEY"
  | "NVIDIA_API_KEY"
  | "NVIDIA_API_BASE"
  | "GROQ_API_KEY"
  | "TOKEN_ENCRYPTION_KEY";

/** Returns a required environment variable or throws a descriptive error. */
export function requireEnv(key: EnvKey): string {
  const value = process.env[key];
  if (!value?.trim()) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

/** Returns an optional environment variable after trimming empty values. */
export function optionalEnv(key: EnvKey): string | undefined {
  return process.env[key]?.trim() || undefined;
}

/** Returns the configured Supabase URL using the public URL as a fallback. */
export function getSupabaseUrl(): string {
  return optionalEnv("SUPABASE_URL") ?? requireEnv("NEXT_PUBLIC_SUPABASE_URL");
}

/** Returns the configured Supabase anon key using the public key as a fallback. */
export function getSupabaseAnonKey(): string {
  return optionalEnv("SUPABASE_ANON_KEY") ?? requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
}
