import { useState, useEffect } from "react";
import type { EmailThread } from "@/types";

export function useThread(threadId: string) {
  const [thread, setThread] = useState<EmailThread | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/v1/gmail/thread/${encodeURIComponent(threadId)}`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error("Unable to load thread");
        setThread(await res.json());
      })
      .catch(() => setThread(null))
      .finally(() => setLoading(false));
  }, [threadId]);

  return { thread, loading, setThread };
}
