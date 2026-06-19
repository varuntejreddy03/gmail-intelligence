"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";

import { SourceCard } from "@/components/chat/SourceCard";
import type { AgentResponse, ChatMessage, EmailEmbedding } from "@/types";

const suggestions = [
  "Summary of today's emails",
  "Who contacted me about jobs?",
  "Any unread from important senders?",
  "What deadlines are mentioned?",
];

export function ChatWindow(): JSX.Element {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sources, setSources] = useState<EmailEmbedding[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [messages, pending]);

  async function send(text = input): Promise<void> {
    const query = text.trim();
    if (!query || pending) return;
    const userMessage: ChatMessage = { role: "user", content: query };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setPending(true);
    try {
      const response = await api("/v1/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: query, sessionId, history: messages.slice(-10) }),
      });
      const data = (await response.json()) as AgentResponse & { sessionId?: string; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Unable to query inbox");
      setSessionId(data.sessionId ?? sessionId);
      setSources(data.sources ?? []);
      setMessages((prev) => [...prev, { role: "assistant", content: data.response, sourceMessageIds: data.sourceMessageIds, sourceThreadIds: data.sourceThreadIds }]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to query inbox");
    } finally {
      setPending(false);
    }
  }

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      {/* Main Chat Area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#111111", minWidth: 0 }}>
        {/* Top Header */}
        <div style={{ height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", borderBottom: "1px solid #1f1f1f" }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>Ask AI</span>
          <span style={{ fontSize: 10, fontWeight: 700, background: "#14532d", color: "#4ade80", padding: "2px 8px", borderRadius: 999 }}>RAG ACTIVE</span>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: "32px 24px" }}>
          {messages.length === 0 && !pending ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 12 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 48, color: "#7c3aed", fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
              <p style={{ fontSize: 14, color: "#6b7280" }}>Ask anything about your inbox</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {messages.map((msg, i) => (
                <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start", gap: 12 }}>
                  {msg.role === "assistant" && (
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(124,58,237,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 16, color: "#a78bfa", fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                    </div>
                  )}
                  <div style={{
                    maxWidth: "70%",
                    padding: "16px 20px",
                    borderRadius: 16,
                    fontSize: 14,
                    lineHeight: "22px",
                    whiteSpace: "pre-wrap",
                    ...(msg.role === "user"
                      ? { background: "#2a1f4e", color: "#fff" }
                      : { background: "#1c1c1c", color: "#d1d5db" }
                    ),
                  }}>
                    {msg.content}
                  </div>
                  {msg.role === "user" && (
                    <div style={{ width: 32, height: 32, borderRadius: 999, background: "#7c3aed", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 16, color: "#fff" }}>person</span>
                    </div>
                  )}
                </div>
              ))}
              {pending && (
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(124,58,237,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16, color: "#a78bfa", fontVariationSettings: "'FILL' 1", animation: "spin 1s linear infinite" }}>progress_activity</span>
                  </div>
                  <span style={{ fontSize: 14, color: "#6b7280" }}>Searching your inbox...</span>
                </div>
              )}
              <div ref={endRef} />
            </div>
          )}
        </div>

        {/* Bottom Input */}
        <div style={{ padding: "16px 24px 24px", borderTop: "1px solid #1f1f1f" }}>
          {/* Suggestion Chips */}
          <div style={{ display: "flex", gap: 8, overflowX: "auto", marginBottom: 12, paddingBottom: 4 }}>
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => void send(s)}
                style={{ whiteSpace: "nowrap", padding: "8px 16px", borderRadius: 999, border: "1px solid #2a2a2a", background: "#1a1a1a", color: "#9ca3af", fontSize: 12, cursor: "pointer", transition: "all 200ms" }}
                onMouseEnter={(e) => { (e.target as HTMLElement).style.background = "#252525"; }}
                onMouseLeave={(e) => { (e.target as HTMLElement).style.background = "#1a1a1a"; }}
              >
                {s}
              </button>
            ))}
          </div>
          {/* Input Bar */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 16, padding: "12px 16px" }}>
            <input
              style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 14, color: "#e5e7eb" }}
              placeholder="Ask anything about your inbox..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
            />
            <button
              onClick={() => void send()}
              disabled={pending || !input.trim()}
              style={{
                width: 40, height: 40, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: pending || !input.trim() ? "not-allowed" : "pointer", transition: "all 200ms",
                background: pending || !input.trim() ? "#2a2a2a" : "#7c3aed",
                color: pending || !input.trim() ? "#6b7280" : "#fff",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>send</span>
            </button>
          </div>
        </div>
      </div>

      {/* Right Sources Panel - hidden on mobile */}
      <div className="hidden lg:flex" style={{ width: 340, background: "#0d0d0d", borderLeft: "1px solid #1f1f1f", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "20px 20px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #1f1f1f" }}>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.15em", color: "#6b7280", textTransform: "uppercase" }}>Cited Sources</span>
          <span style={{ fontSize: 10, fontWeight: 700, background: "#14532d", color: "#4ade80", padding: "2px 8px", borderRadius: 999 }}>RAG ACTIVE</span>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
          {sources.length ? (
            sources.map((source) => <SourceCard key={source.id} source={source} />)
          ) : (
            <div style={{ paddingTop: 80, textAlign: "center", fontSize: 12, color: "#4b5563" }}>
              Ask a question to retrieve sources.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
