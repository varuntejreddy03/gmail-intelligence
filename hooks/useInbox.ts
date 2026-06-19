import { useState, useCallback } from "react";
import type { EmailThread, PaginatedResult } from "@/types";

export function useInbox() {
  const [result, setResult] = useState<PaginatedResult<EmailThread> | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (params: { page?: number; category?: string; search?: string }) => {
    setLoading(true);
    const query = new URLSearchParams({ page: String(params.page || 1), limit: "25" });
    if (params.category) query.set("category", params.category);
    if (params.search) query.set("search", params.search);

    try {
      const res = await fetch(`/api/v1/gmail/messages?${query.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Unable to load inbox");
      setResult(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  return { result, loading, load };
}
