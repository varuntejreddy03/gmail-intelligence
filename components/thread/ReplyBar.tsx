"use client";

import { useState } from "react";
import { LoaderCircle, Send, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { EmailThread } from "@/types";

/** Provides editable AI-assisted reply drafting and Gmail sending. */
export function ReplyBar({ thread, onClose }: { thread: EmailThread; onClose: () => void }): JSX.Element {
  const [body, setBody] = useState("");
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const latest = thread.messages?.[thread.messages.length - 1];

  async function generate(): Promise<void> {
    if (!body.trim()) {
      toast.error("Describe the reply you want first");
      return;
    }
    setGenerating(true);
    try {
      const response = await api("/v1/ai/compose", { method: "POST", body: { prompt: body, replyToThreadId: thread.id } });
      const data = (await response.json()) as { body?: string; error?: string };
      if (!response.ok || !data.body) throw new Error(data.error ?? "Unable to draft reply");
      setBody(data.body);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to draft reply"); }
    finally { setGenerating(false); }
  }

  async function send(): Promise<void> {
    if (!latest || !body.trim()) return;
    setSending(true);
    try {
      const response = await api("/v1/gmail/send", { method: "POST", body: { to: latest.fromEmail, subject: thread.subject.startsWith("Re:") ? thread.subject : `Re: ${thread.subject}`, body, threadId: thread.id, inReplyTo: latest.messageId ?? undefined, references: [latest.references, latest.messageId].filter(Boolean).join(" ") || undefined } });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Unable to send reply");
      toast.success("Reply sent");
      onClose();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to send reply"); }
    finally { setSending(false); }
  }

  return (
    <div className="sticky bottom-4 z-20 mt-6 rounded-2xl border border-indigo-500/30 bg-zinc-900/95 p-4 shadow-2xl shadow-black/40 backdrop-blur">
      <div className="mb-3 flex items-center justify-between"><p className="text-sm font-medium text-zinc-200">Reply to {latest?.fromName || latest?.fromEmail}</p><Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button></div>
      <Textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="Write your reply, or describe what the AI should draft..." className="min-h-32 border-zinc-700 bg-zinc-950" />
      <div className="mt-3 flex justify-end gap-2"><Button variant="outline" className="gap-2" disabled={generating} onClick={() => void generate()}>{generating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}AI draft</Button><Button className="gap-2" disabled={sending || !body.trim()} onClick={() => void send()}>{sending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Send</Button></div>
    </div>
  );
}
