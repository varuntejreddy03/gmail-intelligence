import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import express from "express";
import cors from "cors";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const app = express();
const PORT = Number(process.env.BACKEND_PORT || 4000);
const SECRET = process.env.BACKEND_INTERNAL_SECRET || "";

app.use(cors({ origin: true, credentials: true, methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'x-internal-secret', 'x-user-id', 'x-access-token'] }));
app.options('*', cors());
app.use(express.json({ limit: "10mb" }));

// --- Clients ---
const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY || "",
  baseURL: "https://api.groq.com/openai/v1",
});

const nvidia = new OpenAI({
  apiKey: process.env.NVIDIA_API_KEY || "",
  baseURL: process.env.NVIDIA_API_BASE || "https://integrate.api.nvidia.com/v1",
});

// --- Auth Middleware ---
function auth(req: any, res: any, next: any) {
  if (req.headers["x-internal-secret"] !== SECRET) return res.status(401).json({ error: "Unauthorized" });
  req.userId = req.headers["x-user-id"];
  req.accessToken = req.headers["x-access-token"];
  if (!req.userId) return res.status(401).json({ error: "No user" });
  next();
}

// --- Health ---
app.get("/health", (_req, res) => res.json({ status: "ok" }));

// --- Gmail Routes ---
app.get("/v1/gmail/messages", auth, async (req: any, res) => {
  const { category, search, page = "1", limit = "25" } = req.query;
  let query = supabase.from("email_threads").select("*", { count: "exact" }).eq("user_id", req.userId);
  if (category) query = query.eq("category", category);
  if (search) query = query.or(`subject.ilike.%${search}%,snippet.ilike.%${search}%`);
  const p = Math.max(Number(page), 1);
  const l = Math.min(Math.max(Number(limit), 1), 100);
  const { data, error, count } = await query.order("last_message_at", { ascending: false }).range((p-1)*l, p*l-1);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ data: data || [], page: p, limit: l, total: count || 0, totalPages: Math.max(Math.ceil((count||0)/l), 1) });
});

app.get("/v1/gmail/thread/:id", auth, async (req: any, res) => {
  const [t, m] = await Promise.all([
    supabase.from("email_threads").select("*").eq("user_id", req.userId).eq("id", req.params.id).maybeSingle(),
    supabase.from("email_messages").select("*").eq("user_id", req.userId).eq("thread_id", req.params.id).order("date", { ascending: true }),
  ]);
  if (!t.data) return res.status(404).json({ error: "Not found" });
  res.json({ ...t.data, messages: m.data || [] });
});

app.post("/v1/gmail/sync", auth, async (req: any, res) => {
  res.status(202).json({ status: "started" });
  // Import sync dynamically to avoid caching issues
  const { initialSync, incrementalSync } = await import("./src/services/gmail.service" as any).catch(() => require("@/lib/gmail/sync"));
  const state = await supabase.from("sync_state").select("*").eq("user_id", req.userId).maybeSingle();
  if (state.data?.last_full_sync_at) {
    incrementalSync(req.userId, req.accessToken).catch(console.error);
  } else {
    initialSync(req.userId, req.accessToken).catch(console.error);
  }
});

app.post("/v1/gmail/send", auth, async (req: any, res) => {
  try {
    const { getGmailClient, sendEmail } = require("@/lib/gmail/client");
    const result = await sendEmail(getGmailClient(req.accessToken), req.body);
    res.json(result);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// --- AI Chat ---
app.post("/v1/ai/chat", auth, async (req: any, res) => {
  const { message, sessionId } = req.body;
  if (!message) return res.status(400).json({ error: "Message required" });

  try {
    // Create session
    let sid = sessionId;
    if (!sid) {
      const { data } = await supabase.from("chat_sessions").insert({ user_id: req.userId, title: message.slice(0, 120) }).select("id").single();
      sid = data?.id;
    }
    await supabase.from("chat_messages").insert({ session_id: sid, role: "user", content: message });

    // Extract keywords
    const stopWords = new Set(["who","what","when","where","how","why","the","about","from","contacted","emailed","summary","summarize","today","recent","hello","hi","hey","please","find","list","show","tell","any","all","are","was","were","did","does","have","has","been","can","could","would","should","give","got","get","my","me","your","their","this","that","with","for","and","but","not","the"]);
    const keywords = message.replace(/[%_'"?!.,;:()]/g, " ").toLowerCase().trim().split(/\s+/)
      .filter((t: string) => t.length > 2 && !stopWords.has(t)).slice(0, 5);

    console.log(`[Chat] Query: "${message}" | Keywords: [${keywords.join(", ")}]`);

    // If no keywords (greeting), just respond
    if (keywords.length === 0) {
      const c = await groq.chat.completions.create({
        model: "llama-3.1-8b-instant", temperature: 0.3, max_tokens: 512,
        messages: [{ role: "system", content: "You are a helpful email assistant. Greet the user briefly." }, { role: "user", content: message }],
      });
      const response = c.choices[0]?.message.content?.trim() || "Hello! How can I help with your emails?";
      await supabase.from("chat_messages").insert({ session_id: sid, role: "assistant", content: response });
      return res.json({ response, sourceMessageIds: [], sourceThreadIds: [], sources: [], sessionId: sid });
    }

    // Search emails by keywords
    const conditions = keywords.map((kw: string) => `subject.ilike.%${kw}%,body_text.ilike.%${kw}%,from_email.ilike.%${kw}%`).join(",");
    let { data: emails } = await supabase.from("email_messages")
      .select("id, thread_id, from_email, subject, date, snippet, body_text")
      .eq("user_id", req.userId).or(conditions)
      .order("date", { ascending: false }).limit(10);

    if (!emails || emails.length === 0) {
      const { data: recent } = await supabase.from("email_messages")
        .select("id, thread_id, from_email, subject, date, snippet, body_text")
        .eq("user_id", req.userId).order("date", { ascending: false }).limit(10);
      emails = recent || [];
    }

    console.log(`[Chat] Found ${emails.length} emails`);

    // Build context
    const context = emails.map((e: any, i: number) =>
      `[Source ${i+1}] From: ${e.from_email} | Subject: ${e.subject} | Date: ${e.date}\nContent: ${(e.body_text || e.snippet || "").slice(0, 400)}`
    ).join("\n\n").slice(0, 6000);

    // Call Groq
    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant", temperature: 0.3, max_tokens: 2048,
      messages: [
        { role: "system", content: "You are a helpful email assistant. Answer based on the email context provided. Cite which email (sender, subject) your info comes from. Be concise." },
        { role: "user", content: `EMAIL CONTEXT:\n${context}\n\nQUESTION: ${message}` },
      ],
    });

    const response = completion.choices[0]?.message.content?.trim() || "I could not process that request.";
    console.log(`[Chat] Response: ${response.slice(0, 100)}...`);

    // Save & return
    const sources = emails.map((e: any, i: number) => ({
      id: `s-${i}`, messageId: e.id, threadId: e.thread_id, userId: req.userId,
      contentChunk: (e.body_text || e.snippet || "").slice(0, 500), chunkIndex: 0, similarity: 0,
      message: { fromEmail: e.from_email, subject: e.subject, date: e.date, snippet: e.snippet },
    }));

    await supabase.from("chat_messages").insert({ session_id: sid, role: "assistant", content: response, source_message_ids: sources.map((s: any) => s.messageId), source_thread_ids: sources.map((s: any) => s.threadId) });
    res.json({ response, sourceMessageIds: sources.map((s: any) => s.messageId), sourceThreadIds: sources.map((s: any) => s.threadId), sources, sessionId: sid });
  } catch (err: any) {
    console.error("[Chat] Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// --- AI Summarize ---
app.post("/v1/ai/summarize", auth, async (req: any, res) => {
  try {
    const { threadId } = req.body;
    const { data: msgs } = await supabase.from("email_messages").select("subject, body_text").eq("user_id", req.userId).eq("thread_id", threadId).order("date");
    const context = (msgs || []).map((m: any) => `${m.subject}\n${m.body_text}`).join("\n---\n").slice(0, 6000);
    const c = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant", temperature: 0.3, max_tokens: 512,
      messages: [{ role: "user", content: `Summarize this email thread in 3-4 sentences:\n\n${context}` }],
    });
    const summary = c.choices[0]?.message.content?.trim() || "Summary unavailable";
    await supabase.from("email_threads").update({ summary }).eq("id", threadId).eq("user_id", req.userId);
    res.json({ summary });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// --- AI Compose ---
app.post("/v1/ai/compose", auth, async (req: any, res) => {
  try {
    const { prompt, replyToThreadId } = req.body;
    let context = "";
    if (replyToThreadId) {
      const { data: msgs } = await supabase.from("email_messages").select("from_email, subject, body_text").eq("thread_id", replyToThreadId).eq("user_id", req.userId).order("date");
      context = (msgs || []).map((m: any) => `From: ${m.from_email}\nSubject: ${m.subject}\n${m.body_text}`).join("\n---\n").slice(0, 4000);
    }
    const sysPrompt = replyToThreadId ? `Draft a reply to this thread. Be professional.\n\nThread:\n${context}` : "Write a professional email based on the instruction. Include Subject: line.";
    const c = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant", temperature: 0.3, max_tokens: 1024,
      messages: [{ role: "system", content: sysPrompt }, { role: "user", content: prompt }],
    });
    const text = c.choices[0]?.message.content?.trim() || "";
    const lines = text.split("\n");
    let subject = "", body = text;
    if (lines[0]?.toLowerCase().startsWith("subject:")) { subject = lines[0].replace(/^subject:\s*/i, ""); body = lines.slice(1).join("\n").trim(); }
    res.json({ subject, body });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// --- AI Categorize ---
app.post("/v1/ai/categorize", auth, async (req: any, res) => {
  try {
    const { threadId } = req.body;
    const { data: thread } = await supabase.from("email_threads").select("subject, snippet").eq("id", threadId).eq("user_id", req.userId).single();
    if (!thread) return res.status(404).json({ error: "Not found" });
    const c = await nvidia.chat.completions.create({
      model: "meta/llama-3.1-8b-instruct", temperature: 0, max_tokens: 80,
      messages: [{ role: "user", content: `Classify this email into ONE category. Respond ONLY with JSON: {"category": "<cat>", "confidence": <0-1>}\nCategories: Newsletter, Job/Recruitment, Finance, Notifications, Personal, Work/Professional\n\nSubject: ${thread.subject}\nContent: ${thread.snippet?.slice(0, 500)}` }],
    });
    const parsed = JSON.parse((c.choices[0]?.message.content || "{}").replace(/^```json\s*|\s*```$/g, ""));
    await supabase.from("email_threads").update({ category: parsed.category }).eq("id", threadId).eq("user_id", req.userId);
    res.json(parsed);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// --- AI Reprocess ---
app.post("/v1/ai/reprocess", auth, async (req: any, res) => {
  const { data: threads } = await supabase.from("email_threads").select("id, subject, snippet").eq("user_id", req.userId).is("category", null).limit(25);
  let categorized = 0;
  for (const t of threads || []) {
    try {
      const c = await nvidia.chat.completions.create({
        model: "meta/llama-3.1-8b-instruct", temperature: 0, max_tokens: 80,
        messages: [{ role: "user", content: `Classify into ONE: {"category":"<cat>","confidence":<0-1>}\nCategories: Newsletter, Job/Recruitment, Finance, Notifications, Personal, Work/Professional\nSubject: ${t.subject}\nContent: ${t.snippet?.slice(0, 300)}` }],
      });
      const parsed = JSON.parse((c.choices[0]?.message.content || "{}").replace(/^```json\s*|\s*```$/g, ""));
      await supabase.from("email_threads").update({ category: parsed.category }).eq("id", t.id).eq("user_id", req.userId);
      categorized++;
    } catch {}
  }
  res.json({ categorized });
});

// --- Start ---
app.listen(PORT, () => {
  console.log(`[API] Express on port ${PORT}`);
});
setInterval(() => {}, 1 << 30);
