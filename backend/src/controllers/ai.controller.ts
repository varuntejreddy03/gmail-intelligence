import type { Response } from "express";
import type { AuthenticatedRequest } from "../middleware/auth";
import { aiService } from "../services/ai.service";
import OpenAI from "openai";
import { getSupabaseAdmin } from "@/lib/database/client";
import { createChatSession, saveChatMessage } from "@/lib/database/queries";

// Direct Groq client for chat (bypasses cached modules)
let groq: OpenAI | null = null;
function getGroq(): OpenAI {
  if (!groq) {
    groq = new OpenAI({
      apiKey: process.env.GROQ_API_KEY || "",
      baseURL: "https://api.groq.com/openai/v1",
    });
  }
  return groq;
}

export class AiController {
  async chat(req: AuthenticatedRequest, res: Response) {
    const { message, sessionId, history } = req.body;
    if (!message) return res.status(400).json({ error: "Message required" });

    const userId = req.userId!;

    try {
      // 1. Create session
      const chatSessionId = sessionId ?? await createChatSession(userId, message);
      await saveChatMessage(chatSessionId, { role: "user", content: message });

      // 2. Search emails
      const keywords = message.replace(/[%_'"?!.,;:()]/g, " ").toLowerCase().trim().split(/\s+/)
        .filter((t: string) => t.length > 2 && !["who","what","when","where","how","why","the","about","from","contacted","emailed","summary","summarize","today","recent","hello","please","find","list","show","tell","any","all","are","was","were","did","does","have","has","been"].includes(t))
        .slice(0, 5);

      // If no meaningful keywords, treat as greeting/general question
      if (keywords.length === 0) {
        const completion = await getGroq().chat.completions.create({
          model: "llama-3.1-8b-instant",
          temperature: 0.3,
          max_tokens: 512,
          messages: [
            { role: "system", content: "You are a helpful email assistant. The user has connected their Gmail. Greet them and offer to help with their emails. Keep it brief." },
            { role: "user", content: message },
          ],
        });
        const response = completion.choices[0]?.message.content?.trim() || "Hello! How can I help you with your emails?";
        await saveChatMessage(chatSessionId, { role: "assistant", content: response });
        return res.json({ response, sourceMessageIds: [], sourceThreadIds: [], sources: [], sessionId: chatSessionId });
      }

      let emails: any[] = [];
      const client = getSupabaseAdmin();

      if (keywords.length > 0) {
        const conditions = keywords.map((kw: string) => `subject.ilike.%${kw}%,body_text.ilike.%${kw}%,from_email.ilike.%${kw}%`).join(",");
        const { data } = await client.from("email_messages")
          .select("id, thread_id, from_email, subject, date, snippet, body_text")
          .eq("user_id", userId).or(conditions)
          .order("date", { ascending: false }).limit(10);
        emails = data || [];
      }

      if (emails.length === 0) {
        const { data } = await client.from("email_messages")
          .select("id, thread_id, from_email, subject, date, snippet, body_text")
          .eq("user_id", userId)
          .order("date", { ascending: false }).limit(10);
        emails = data || [];
      }

      // 3. Build context
      const context = emails.map((e: any, i: number) =>
        `[Source ${i+1}] From: ${e.from_email} | Subject: ${e.subject} | Date: ${e.date}\nContent: ${(e.body_text || e.snippet || "").slice(0, 400)}`
      ).join("\n\n").slice(0, 6000);

      // 4. Call Groq
      console.log(`[Chat] Query: "${message}" | Keywords: [${keywords}] | Emails found: ${emails.length}`);
      const completion = await getGroq().chat.completions.create({
        model: "llama-3.1-8b-instant",
        temperature: 0.3,
        max_tokens: 2048,
        messages: [
          { role: "system", content: "You are a helpful email assistant. Answer questions based on the email context provided. Cite which email (sender, subject) your info comes from. Be concise." },
          { role: "user", content: `EMAIL CONTEXT:\n${context}\n\nQUESTION: ${message}` },
        ],
      });

      const response = completion.choices[0]?.message.content?.trim() || "I could not find that information in your emails.";
      console.log(`[Chat] Response: ${response.slice(0, 100)}...`);

      // 5. Save and return
      const sources = emails.map((e: any, i: number) => ({
        id: `s-${i}`, messageId: e.id, threadId: e.thread_id, userId, contentChunk: (e.body_text || e.snippet || "").slice(0, 500), chunkIndex: 0, similarity: 0,
        message: { fromEmail: e.from_email, subject: e.subject, date: e.date, snippet: e.snippet },
      }));

      await saveChatMessage(chatSessionId, { role: "assistant", content: response, sourceMessageIds: sources.map((s: any) => s.messageId), sourceThreadIds: sources.map((s: any) => s.threadId) });

      res.json({ response, sourceMessageIds: sources.map((s: any) => s.messageId), sourceThreadIds: sources.map((s: any) => s.threadId), sources, sessionId: chatSessionId });
    } catch (err) {
      console.error("[Chat] Error:", err);
      res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
    }
  }

  async summarize(req: AuthenticatedRequest, res: Response) {
    const { threadId, messageId } = req.body;
    const result = await aiService.summarize(req.userId!, threadId, messageId);
    res.json(result);
  }

  async compose(req: AuthenticatedRequest, res: Response) {
    const { prompt, replyToThreadId } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt required" });

    const result = await aiService.compose(req.userId!, prompt, replyToThreadId);
    res.json(result);
  }

  async categorize(req: AuthenticatedRequest, res: Response) {
    const { threadId } = req.body;
    if (!threadId) return res.status(400).json({ error: "threadId required" });

    const result = await aiService.categorize(req.userId!, threadId);
    res.json(result);
  }

  async reprocess(req: AuthenticatedRequest, res: Response) {
    const result = await aiService.reprocess(req.userId!);
    res.json(result);
  }
}

export const aiController = new AiController();
