import { useState, useCallback } from "react";
import type { AgentResponse, ChatMessage, EmailEmbedding } from "@/types";

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sources, setSources] = useState<EmailEmbedding[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const send = useCallback(async (text: string) => {
    const query = text.trim();
    if (!query || pending) return;

    const userMessage: ChatMessage = { role: "user", content: query };
    setMessages((prev) => [...prev, userMessage]);
    setPending(true);

    try {
      const res = await fetch("/api/v1/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: query, sessionId, history: messages.slice(-10) }),
      });
      const data = (await res.json()) as AgentResponse & { sessionId?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Unable to query inbox");

      setSessionId(data.sessionId ?? sessionId);
      setSources(data.sources ?? []);
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: data.response,
        sourceMessageIds: data.sourceMessageIds,
        sourceThreadIds: data.sourceThreadIds,
      }]);
    } catch (err) {
      throw err;
    } finally {
      setPending(false);
    }
  }, [messages, sessionId, pending]);

  const reset = useCallback(() => {
    setMessages([]);
    setSources([]);
    setSessionId(null);
  }, []);

  return { messages, sources, pending, send, reset };
}
