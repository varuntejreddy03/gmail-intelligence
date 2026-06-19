"use client";

/** Calls the backend via Next.js proxy (/api/v1/*). No CORS needed. */
export async function api(path: string, options?: { method?: string; body?: unknown }): Promise<Response> {
  const fetchOptions: RequestInit = {
    method: options?.method ?? "GET",
    headers: { "Content-Type": "application/json" },
  };

  if (options?.body !== undefined) {
    fetchOptions.body = typeof options.body === "string" ? options.body : JSON.stringify(options.body);
  }

  return fetch(`/api${path}`, fetchOptions);
}
