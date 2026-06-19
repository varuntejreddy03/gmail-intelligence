"use client";

const BACKEND_SECRET = process.env.NEXT_PUBLIC_BACKEND_SECRET || "super-secret-internal-key-change-me";

/** Gets the current user session from NextAuth. */
async function getSession(): Promise<{ userId: string; accessToken?: string } | null> {
  try {
    const res = await fetch("/api/auth/session");
    const session = await res.json();
    if (!session?.user?.id) return null;
    return { userId: session.user.id, accessToken: session.accessToken };
  } catch {
    return null;
  }
}

/** Calls the backend API. In production, same origin (/v1/*). In dev, localhost:4000. */
export async function api(path: string, options?: { method?: string; body?: unknown }): Promise<Response> {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");

  // Use same origin in production, localhost:4000 in dev
  const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "";

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-internal-secret": BACKEND_SECRET,
    "x-user-id": session.userId,
  };

  if (session.accessToken) {
    headers["x-access-token"] = session.accessToken;
  }

  const fetchOptions: RequestInit = {
    method: options?.method ?? "GET",
    headers,
  };

  if (options?.body !== undefined) {
    fetchOptions.body = typeof options.body === "string" ? options.body : JSON.stringify(options.body);
  }

  return fetch(`${baseUrl}${path}`, fetchOptions);
}
