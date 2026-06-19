"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { api } from "@/lib/api-client";

import { MessageBubble } from "@/components/thread/MessageBubble";
import { ReplyBar } from "@/components/thread/ReplyBar";
import { Skeleton } from "@/components/ui/skeleton";
import type { EmailThread } from "@/types";

export function ThreadView({ threadId }: { threadId: string }): JSX.Element {
  const [thread, setThread] = useState<EmailThread | null>(null);
  const [loading, setLoading] = useState(true);
  const [replying, setReplying] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(true);
  const [summarizing, setSummarizing] = useState(false);

  useEffect(() => {
    void api(`/v1/gmail/thread/${encodeURIComponent(threadId)}`)
      .then(async (response) => {
        const data = (await response.json()) as EmailThread & { error?: string };
        if (!response.ok) throw new Error(data.error ?? "Unable to load thread");
        setThread(data);
      })
      .catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Unable to load thread"))
      .finally(() => setLoading(false));
  }, [threadId]);

  async function summarize(): Promise<void> {
    if (!thread) return;
    setSummarizing(true);
    try {
      const response = await api("/v1/ai/summarize", { method: "POST", body: { threadId: thread.id } });
      const data = (await response.json()) as { summary?: string; error?: string };
      if (!response.ok || !data.summary) throw new Error(data.error ?? "Unable to summarize");
      setThread({ ...thread, summary: data.summary });
      setSummaryOpen(true);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to summarize"); }
    finally { setSummarizing(false); }
  }

  if (loading) return (
    <div className="max-w-4xl mx-auto px-8 py-10 space-y-5">
      <Skeleton className="h-8 w-2/3 bg-white/[0.06]" />
      {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 w-full rounded-2xl bg-white/[0.06]" />)}
    </div>
  );

  if (!thread) return <div className="flex min-h-[60vh] items-center justify-center text-sm text-[#cbc3d7]/60">Thread unavailable.</div>;

  return (
    <div className="max-w-4xl mx-auto px-8 py-8">
      {/* Top bar */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/" className="p-2 hover:bg-white/[0.05] rounded-full transition-colors">
          <span className="material-symbols-outlined text-[#cbc3d7]">arrow_back</span>
        </Link>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold text-[#e4e1e9] truncate">{thread.subject}</h2>
          <p className="text-[13px] text-[#cbc3d7]/70">
            With {thread.participants.slice(0, 3).join(", ")}{thread.participants.length > 3 ? ` and ${thread.participants.length - 3} others` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#d0bcff]/10 border border-[#d0bcff]/20 text-[#d0bcff] text-xs font-bold uppercase tracking-wide hover:bg-[#d0bcff]/20 transition-all disabled:opacity-50"
            onClick={() => void summarize()}
            disabled={summarizing}
          >
            <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
            {summarizing ? "..." : "Summarize"}
          </button>
          <button
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#d0bcff] text-[#3c0091] text-xs font-bold uppercase tracking-wide hover:brightness-110 active:scale-95 transition-all"
            onClick={() => setReplying(true)}
          >
            <span className="material-symbols-outlined text-sm">reply</span>
            Reply
          </button>
        </div>
      </div>

      {/* AI Summary */}
      {thread.summary && (
        <div className="glass-card rounded-xl p-4 ai-glow mb-8">
          <button className="flex w-full items-center gap-2 text-left" onClick={() => setSummaryOpen((v) => !v)}>
            <span className="material-symbols-outlined text-[#d0bcff] text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#d0bcff]">AI Summary</span>
            <span className="material-symbols-outlined ml-auto text-[#cbc3d7] text-sm">{summaryOpen ? "expand_less" : "expand_more"}</span>
          </button>
          {summaryOpen && <p className="mt-3 text-[13px] leading-6 text-[#cbc3d7]">{thread.summary}</p>}
        </div>
      )}

      {/* Messages */}
      <div className="space-y-8 pb-8">
        {thread.messages?.map((message) => (
          <MessageBubble key={message.id} message={message} onReply={() => setReplying(true)} />
        ))}
      </div>

      {/* Reply */}
      {replying && <ReplyBar thread={thread} onClose={() => setReplying(false)} />}
    </div>
  );
}
