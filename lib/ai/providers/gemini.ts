import { GoogleGenerativeAI, type GenerativeModel } from "@google/generative-ai";
import OpenAI from "openai";

import { requireEnv } from "@/lib/env";
import {
  CHAT_SYSTEM_PROMPT,
  COMPOSE_PROMPT,
  EMAIL_SUMMARY_PROMPT,
  REPLY_PROMPT,
  THREAD_SUMMARY_PROMPT,
  fillPrompt,
} from "@/lib/ai/prompts";
import type { ChatMessage } from "@/types";

// --- Gemini Client ---
let geminiClient: GoogleGenerativeAI | null = null;

function getGeminiClient(): GoogleGenerativeAI {
  if (!geminiClient) geminiClient = new GoogleGenerativeAI(requireEnv("GEMINI_API_KEY"));
  return geminiClient;
}

function getTextModel(): GenerativeModel {
  return getGeminiClient().getGenerativeModel({ model: "gemini-2.0-flash" });
}

// --- Groq Fallback (for chat/generation) ---
let groqClient: OpenAI | null = null;

function getGroq(): OpenAI {
  if (!groqClient) {
    const key = process.env.GROQ_API_KEY;
    if (!key) throw new Error("GROQ_API_KEY not set");
    groqClient = new OpenAI({
      apiKey: key,
      baseURL: "https://api.groq.com/openai/v1",
    });
  }
  return groqClient;
}

async function groqGenerate(prompt: string): Promise<string> {
  const res = await getGroq().chat.completions.create({
    model: "llama-3.1-8b-instant",
    temperature: 0.3,
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });
  return res.choices[0]?.message.content?.trim() || "";
}

async function groqChat(system: string, user: string): Promise<string> {
  const res = await getGroq().chat.completions.create({
    model: "llama-3.1-8b-instant",
    temperature: 0.3,
    max_tokens: 2048,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  return res.choices[0]?.message.content?.trim() || "";
}

// --- Core generate with fallback ---
async function generateText(prompt: string, fallback: string): Promise<string> {
  // Try Gemini first
  try {
    const result = await getTextModel().generateContent(prompt);
    const text = result.response.text().trim();
    if (text) return text;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[Gemini] Failed, trying OpenRouter:", msg.slice(0, 100));
  }

  // Fallback to Groq
  try {
    const text = await groqGenerate(prompt);
    if (text) return text;
  } catch (err) {
    console.error("[Groq] Also failed:", err instanceof Error ? err.message : err);
  }

  return fallback;
}

// --- Public API ---

export async function summarizeEmail(emailContent: string): Promise<string> {
  return generateText(
    fillPrompt(EMAIL_SUMMARY_PROMPT, { emailContent: emailContent.slice(0, 30_000) }),
    "Summary unavailable",
  );
}

export async function summarizeThread(threadContext: string): Promise<string> {
  return generateText(
    fillPrompt(THREAD_SUMMARY_PROMPT, { threadContext: threadContext.slice(-30_000) }),
    "Summary unavailable",
  );
}

export async function composeEmail(prompt: string, context?: string): Promise<string> {
  return generateText(
    fillPrompt(COMPOSE_PROMPT, {
      userPrompt: `${prompt}${context ? `\n\nRelevant context:\n${context}` : ""}`,
    }),
    "Subject: Draft unavailable\n\nEmail generation is currently unavailable.",
  );
}

export async function draftReply(prompt: string, threadContext: string): Promise<string> {
  return generateText(
    fillPrompt(REPLY_PROMPT, {
      threadContext: threadContext.slice(-30_000),
      userPrompt: prompt,
    }),
    "Reply generation is currently unavailable.",
  );
}

export { generateSingleEmbedding as generateEmbedding } from "@/lib/ai/embeddings";

export async function generateGroundedChat(
  query: string,
  context: string,
  history: ChatMessage[],
): Promise<string> {
  const transcript = history
    .slice(-10)
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n");

  // Cap context to ~6000 chars to stay within Groq free tier TPM
  const trimmedContext = context.slice(0, 6000);
  const userPrompt = `EMAIL CONTEXT:\n${trimmedContext}\n\nUSER QUESTION: ${query}\n\nINSTRUCTIONS: Answer the user's question based ONLY on the email context above. If the context contains relevant information, summarize it with source citations. If not, say you could not find that information.`;

  // Use Groq directly (Gemini quota exhausted)
  try {
    console.log("[Groq Chat] Sending request...");
    const text = await groqChat(
      "You are a helpful email assistant. Answer questions based on the email context provided. Always cite which email (sender, subject) your information comes from. Be concise and helpful.",
      userPrompt
    );
    if (text) return text;
    console.warn("[Groq Chat] Returned empty response");
  } catch (err) {
    console.error("[Groq Chat] Failed:", err instanceof Error ? err.message : err);
  }

  return "I could not find that information in your emails.";
}
