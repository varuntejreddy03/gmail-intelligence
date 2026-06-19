import type { ChatMessage } from "@/types";

export function MessageBubble({ message }: { message: ChatMessage }): JSX.Element {
  const isAssistant = message.role === "assistant";
  return (
    <div style={{ display: "flex", justifyContent: isAssistant ? "flex-start" : "flex-end", gap: 12 }}>
      {isAssistant && (
        <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(124,58,237,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16, color: "#a78bfa", fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
        </div>
      )}
      <div style={{
        maxWidth: "70%", padding: "16px 20px", borderRadius: 16, fontSize: 14, lineHeight: "22px", whiteSpace: "pre-wrap",
        ...(isAssistant ? { background: "#1c1c1c", color: "#d1d5db" } : { background: "#2a1f4e", color: "#fff" }),
      }}>
        {message.content}
      </div>
      {!isAssistant && (
        <div style={{ width: 32, height: 32, borderRadius: 999, background: "#7c3aed", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16, color: "#fff" }}>person</span>
        </div>
      )}
    </div>
  );
}
