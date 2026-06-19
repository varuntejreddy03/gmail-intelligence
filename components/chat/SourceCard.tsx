"use client";

import { useState } from "react";
import Link from "next/link";

import type { EmailEmbedding } from "@/types";

export function SourceCard({ source }: { source: EmailEmbedding }): JSX.Element {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      style={{ background: "#161616", border: "1px solid #222", borderRadius: 12, padding: 16, marginBottom: 12, transition: "all 200ms", cursor: "pointer" }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#581c87"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "#222"; }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 16, color: "#a78bfa" }}>mail</span>
        <span style={{ fontSize: 13, fontWeight: 500, color: "#fff" }}>{source.message?.fromEmail ?? "Unknown"}</span>
      </div>
      <p style={{ fontSize: 12, color: "#d1d5db", marginTop: 4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical" }}>
        {source.message?.subject ?? "Email"}
      </p>
      <p style={{ fontSize: 12, color: "#6b7280", marginTop: 4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: expanded ? 99 : 2, WebkitBoxOrient: "vertical" }}>
        {source.contentChunk}
      </p>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
        <button
          onClick={() => setExpanded((v) => !v)}
          style={{ fontSize: 11, color: "#a78bfa", background: "none", border: "none", cursor: "pointer" }}
        >
          {expanded ? "Show less" : "Show more"}
        </button>
        <Link href={`/thread/${encodeURIComponent(source.threadId)}`} style={{ fontSize: 11, color: "#a78bfa", textDecoration: "none" }}>
          Open thread →
        </Link>
      </div>
    </div>
  );
}
