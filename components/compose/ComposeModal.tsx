"use client";

import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";

export function ComposeModal(): JSX.Element {
  const [to, setTo] = useState("");
  const [prompt, setPrompt] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);

  function discard(): void {
    setPrompt(""); setSubject(""); setBody("");
  }

  async function generate(): Promise<void> {
    if (!prompt.trim()) { toast.error("Describe the email you want to write"); return; }
    setGenerating(true);
    try {
      const response = await api("/v1/ai/compose", { method: "POST", body: { prompt } });
      const data = (await response.json()) as { subject?: string; body?: string; error?: string };
      if (!response.ok || !data.body) throw new Error(data.error ?? "Unable to generate");
      setSubject(data.subject ?? ""); setBody(data.body);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to generate"); }
    finally { setGenerating(false); }
  }

  async function send(): Promise<void> {
    if (!to.trim() || !subject.trim() || !body.trim()) { toast.error("Recipient, subject, and body required"); return; }
    setSending(true);
    try {
      const response = await api("/v1/gmail/send", { method: "POST", body: { to, subject, body } });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Unable to send");
      toast.success("Email sent"); setTo(""); discard();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to send"); }
    finally { setSending(false); }
  }

  return (
    <div className="px-8 py-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-[#d0bcff]/10 border border-[#d0bcff]/20 text-[#d0bcff] text-[11px] font-bold uppercase tracking-wide mb-4">
          <span className="material-symbols-outlined text-sm">edit</span>
          AI compose
        </div>
        <h1 className="text-[30px] font-semibold tracking-[-0.01em] text-[#e4e1e9]">Turn an idea into a polished email.</h1>
        <p className="mt-2 text-sm text-[#cbc3d7]/70">Describe your intent in plain language. Review and edit every word before anything is sent.</p>
      </div>

      {/* Two-panel layout */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Describe */}
        <div className="flex flex-col rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <h2 className="text-sm font-semibold text-[#e4e1e9] mb-5">1. Describe the message</h2>

          <label className="text-[11px] font-semibold uppercase tracking-wide text-[#cbc3d7]/60 mb-2">Recipient</label>
          <input
            type="email"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="name@company.com"
            className="w-full bg-black/30 border border-white/[0.08] rounded-lg px-4 py-3 text-sm text-[#e4e1e9] placeholder:text-[#cbc3d7]/30 focus:outline-none focus:border-[#d0bcff]/50 focus:ring-1 focus:ring-[#d0bcff]/20 transition-all mb-5"
          />

          <label className="text-[11px] font-semibold uppercase tracking-wide text-[#cbc3d7]/60 mb-2">What do you want to say?</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Thank Priya for the interview, confirm I can start June 10, and ask about next steps. Keep it warm and concise."
            className="w-full flex-1 min-h-[200px] bg-black/30 border border-white/[0.08] rounded-lg px-4 py-3 text-sm text-[#e4e1e9] placeholder:text-[#cbc3d7]/30 focus:outline-none focus:border-[#d0bcff]/50 focus:ring-1 focus:ring-[#d0bcff]/20 transition-all resize-none mb-5"
          />

          <button
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-[#d0bcff] text-[#3c0091] rounded-xl text-[12px] font-bold uppercase tracking-wide hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50"
            onClick={() => void generate()}
            disabled={generating}
          >
            <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
            {generating ? "Generating..." : "Generate email"}
          </button>
        </div>

        {/* Right: Review */}
        <div className="flex flex-col rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <h2 className="text-sm font-semibold text-[#e4e1e9] mb-5">2. Review and send</h2>

          <label className="text-[11px] font-semibold uppercase tracking-wide text-[#cbc3d7]/60 mb-2">Subject</label>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Generated subject"
            className="w-full bg-black/30 border border-white/[0.08] rounded-lg px-4 py-3 text-sm text-[#e4e1e9] placeholder:text-[#cbc3d7]/30 focus:outline-none focus:border-[#d0bcff]/50 focus:ring-1 focus:ring-[#d0bcff]/20 transition-all mb-5"
          />

          <label className="text-[11px] font-semibold uppercase tracking-wide text-[#cbc3d7]/60 mb-2">Body</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Your generated draft will appear here."
            className="w-full flex-1 min-h-[200px] bg-black/30 border border-white/[0.08] rounded-lg px-4 py-3 text-sm text-[#e4e1e9] placeholder:text-[#cbc3d7]/30 focus:outline-none focus:border-[#d0bcff]/50 focus:ring-1 focus:ring-[#d0bcff]/20 transition-all resize-none leading-7 mb-5"
          />

          <div className="flex justify-end gap-3">
            <button
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/[0.08] text-[#cbc3d7] text-[12px] font-semibold hover:bg-white/[0.05] transition-all"
              onClick={discard}
            >
              <span className="material-symbols-outlined text-[16px]">delete</span>
              Discard
            </button>
            <button
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#d0bcff] text-[#3c0091] text-[12px] font-bold hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
              onClick={() => void send()}
              disabled={sending || !body.trim()}
            >
              <span className="material-symbols-outlined text-[16px]">send</span>
              {sending ? "Sending..." : "Send email"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
