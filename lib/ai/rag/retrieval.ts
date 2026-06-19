import { generateGroundedChat } from "@/lib/ai/providers/gemini";
import { generateSingleEmbedding } from "@/lib/ai/embeddings";
import { getMessageById, matchEmbeddings } from "@/lib/database/queries";
import { getSupabaseAdmin } from "@/lib/database/client";
import type { AgentResponse, ChatMessage, EmailEmbedding } from "@/types";

const STOP_WORDS = new Set([
  "who", "what", "when", "where", "how", "why", "the", "a", "an", "is", "are",
  "was", "were", "did", "do", "does", "has", "have", "had", "been", "be", "will",
  "would", "could", "should", "may", "might", "can", "shall", "me", "my", "i",
  "you", "your", "we", "our", "they", "their", "it", "its", "this", "that",
  "these", "those", "about", "from", "to", "in", "on", "at", "for", "with",
  "of", "by", "all", "any", "some", "and", "or", "not", "no", "but", "if",
  "then", "than", "so", "very", "just", "also", "there", "here", "up", "out",
  "get", "got", "give", "gave", "list", "tell", "show", "find", "contacted",
  "emailed", "sent", "received", "summary", "summarize", "today", "recent",
  "latest", "please", "thanks", "hello", "hi", "hey",
]);

/** Extracts meaningful keywords from a user query. */
function extractKeywords(query: string): string[] {
  return query
    .replace(/[%_'"?!.,;:()]/g, " ")
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t))
    .slice(0, 5);
}

/** Retrieves relevant emails — tries pgvector first, falls back to keyword search. */
export async function searchRelevantEmails(
  query: string,
  userId: string,
  topK = 10,
): Promise<EmailEmbedding[]> {
  // Try vector search first
  try {
    const queryEmbedding = await generateSingleEmbedding(query);
    const isZero = queryEmbedding.every((v) => v === 0);
    if (!isZero) {
      const matches = await matchEmbeddings(userId, queryEmbedding, topK * 2);
      if (matches.length > 0) {
        const unique = new Map<string, EmailEmbedding>();
        for (const match of matches) {
          if (!unique.has(match.messageId)) unique.set(match.messageId, match);
        }
        const selected = Array.from(unique.values()).slice(0, topK);
        return Promise.all(
          selected.map(async (chunk) => {
            const message = await getMessageById(userId, chunk.messageId);
            return {
              ...chunk,
              message: message
                ? { fromEmail: message.fromEmail, subject: message.subject, date: message.date, snippet: message.snippet }
                : undefined,
            };
          }),
        );
      }
    }
  } catch {
    // Fall through to text search
  }

  // Keyword-based text search
  const keywords = extractKeywords(query);
  console.log(`[RAG] Keywords extracted: [${keywords.join(", ")}] from query: "${query}"`);
  let data: Record<string, string>[] | null = null;

  if (keywords.length > 0) {
    // Build OR conditions for each keyword across subject, body, and sender
    const conditions = keywords
      .map((kw) => `subject.ilike.%${kw}%,body_text.ilike.%${kw}%,from_email.ilike.%${kw}%,from_name.ilike.%${kw}%`)
      .join(",");

    const result = await getSupabaseAdmin()
      .from("email_messages")
      .select("id, thread_id, from_email, from_name, subject, date, snippet, body_text")
      .eq("user_id", userId)
      .or(conditions)
      .order("date", { ascending: false })
      .limit(topK);
    data = result.data as Record<string, string>[] | null;
    console.log(`[RAG] Keyword search found: ${data?.length ?? 0} results`);
  }

  // If keyword search found nothing, get recent emails as context
  if (!data || data.length === 0) {
    const result = await getSupabaseAdmin()
      .from("email_messages")
      .select("id, thread_id, from_email, from_name, subject, date, snippet, body_text")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .limit(topK);
    data = result.data as Record<string, string>[] | null;
  }

  return (data ?? []).map((row, i) => ({
    id: `search-${i}`,
    messageId: row.id,
    threadId: row.thread_id,
    userId,
    contentChunk: (row.body_text ?? row.snippet ?? "").slice(0, 500),
    chunkIndex: 0,
    similarity: 0,
    message: {
      fromEmail: row.from_email,
      subject: row.subject,
      date: row.date,
      snippet: row.snippet,
    },
  }));
}

/** Formats retrieved email chunks with full source attribution. */
export function buildRAGContext(chunks: EmailEmbedding[]): string {
  if (!chunks.length) return "No relevant emails found in the knowledge base.";
  return chunks
    .map(
      (chunk, i) =>
        `[Source ${i + 1}]\nFrom: ${chunk.message?.fromEmail ?? "Unknown"}\nSubject: ${chunk.message?.subject ?? "Unknown"}\nDate: ${chunk.message?.date ?? "Unknown"}\nMessage ID: ${chunk.messageId}\nThread ID: ${chunk.threadId}\nContent:\n${chunk.contentChunk}`,
    )
    .join("\n\n---\n\n")
    .slice(0, 50_000);
}

/** Answers an inbox question with retrieval and source identifiers. */
export async function chatWithAgent(
  query: string,
  userId: string,
  history: ChatMessage[],
): Promise<AgentResponse> {
  const chunks = await searchRelevantEmails(query, userId);
  const response = await generateGroundedChat(query, buildRAGContext(chunks), history.slice(-10));
  return {
    response,
    sourceMessageIds: Array.from(new Set(chunks.map((c) => c.messageId))),
    sourceThreadIds: Array.from(new Set(chunks.map((c) => c.threadId))),
    sources: chunks,
  };
}
