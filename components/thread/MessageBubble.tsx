"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";
import type { EmailMessage } from "@/types";

export function MessageBubble({ message, onReply }: { message: EmailMessage; onReply?: () => void }): JSX.Element {
  const [expanded, setExpanded] = useState(message.bodyText.length <= 300);
  const [copied, setCopied] = useState(false);
  const content = message.bodyText || message.snippet;
  const initials = (message.fromName || message.fromEmail).slice(0, 2).toUpperCase();

  async function copyMessage(): Promise<void> {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex gap-6">
      <div className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center text-xs font-bold bg-[#a078ff]/30 text-[#d0bcff] mt-1">
        {initials}
      </div>
      <div className="flex-1 space-y-2">
        <div className="flex items-baseline gap-3">
          <span className="text-xs font-medium text-[#d0bcff]">{message.fromName || message.fromEmail}</span>
          <span className="text-[13px] text-[#cbc3d7]/40">{new Date(message.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
        </div>
        <div className={cn("glass-card p-6 rounded-2xl rounded-tl-none leading-relaxed", !expanded && "max-h-36 overflow-hidden relative")}>
          <div className="whitespace-pre-wrap break-words text-sm leading-7 text-[#e4e1e9]/90">{content}</div>
          {!expanded && <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#1f1f25] to-transparent" />}
        </div>
        <div className="flex items-center gap-3">
          {content.length > 300 && (
            <button className="text-[11px] text-[#cbc3d7]/60 hover:text-[#d0bcff] transition-colors" onClick={() => setExpanded((v) => !v)}>
              {expanded ? "Collapse" : "Show full"}
            </button>
          )}
          <button className="text-[11px] text-[#cbc3d7]/60 hover:text-[#d0bcff] transition-colors" onClick={() => void copyMessage()}>
            {copied ? "Copied!" : "Copy"}
          </button>
          {onReply && (
            <button className="text-[11px] text-[#cbc3d7]/60 hover:text-[#d0bcff] transition-colors" onClick={onReply}>
              Reply
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
