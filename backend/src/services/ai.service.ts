import { chatWithAgent } from "@/lib/ai";
import { summarizeThread, summarizeEmail, composeEmail, draftReply } from "@/lib/ai";
import { categorizeEmail } from "@/lib/ai";
import { buildThreadContext } from "@/lib/gmail/parser";
import {
  getThreadById,
  getMessageById,
  updateSummary,
  saveThreadCategory,
  createChatSession,
  saveChatMessage,
} from "@/lib/database/queries";
import { getSupabaseAdmin } from "@/lib/database/client";
import type { AgentResponse, ChatMessage } from "@/types";

export class AiService {
  async chat(userId: string, message: string, sessionId: string | null, history: ChatMessage[]): Promise<AgentResponse & { sessionId: string }> {
    const chatSessionId = sessionId ?? await createChatSession(userId, message);
    await saveChatMessage(chatSessionId, { role: "user", content: message });

    const result = await chatWithAgent(message, userId, history);
    await saveChatMessage(chatSessionId, {
      role: "assistant",
      content: result.response,
      sourceMessageIds: result.sourceMessageIds,
      sourceThreadIds: result.sourceThreadIds,
    });

    return { ...result, sessionId: chatSessionId };
  }

  async summarize(userId: string, threadId?: string, messageId?: string): Promise<{ summary: string }> {
    if (threadId) {
      const thread = await getThreadById(userId, threadId);
      if (!thread) throw new Error("Thread not found");
      const context = buildThreadContext(thread.messages ?? []);
      const summary = await summarizeThread(context);
      await updateSummary("thread", threadId, userId, summary);
      return { summary };
    }

    if (messageId) {
      const message = await getMessageById(userId, messageId);
      if (!message) throw new Error("Message not found");
      const summary = await summarizeEmail(`${message.subject}\n\n${message.bodyText}`);
      await updateSummary("message", messageId, userId, summary);
      return { summary };
    }

    throw new Error("Provide threadId or messageId");
  }

  async compose(userId: string, prompt: string, replyToThreadId?: string): Promise<{ subject: string; body: string }> {
    let context: string | undefined;
    if (replyToThreadId) {
      const thread = await getThreadById(userId, replyToThreadId);
      if (thread?.messages) context = buildThreadContext(thread.messages);
    }

    const generated = replyToThreadId && context
      ? await draftReply(prompt, context)
      : await composeEmail(prompt, context);

    const lines = generated.split("\n");
    let subject = "";
    let body = generated;
    if (lines[0]?.toLowerCase().startsWith("subject:")) {
      subject = lines[0].replace(/^subject:\s*/i, "").trim();
      body = lines.slice(1).join("\n").trim();
    }

    return { subject, body };
  }

  async categorize(userId: string, threadId: string): Promise<{ category: string; confidence: number }> {
    const thread = await getThreadById(userId, threadId);
    if (!thread) throw new Error("Thread not found");

    const result = await categorizeEmail(thread.snippet, thread.subject);
    await saveThreadCategory({
      threadId: thread.id,
      userId,
      category: result.category,
      confidence: result.confidence,
      modelUsed: "meta/llama-3.1-8b-instruct",
    });

    return result;
  }

  async reprocess(userId: string): Promise<{ categorized: number }> {
    const client = getSupabaseAdmin();
    const { data: threads } = await client
      .from("email_threads")
      .select("id, subject, snippet")
      .eq("user_id", userId)
      .is("category", null)
      .limit(25);

    let categorized = 0;
    for (let i = 0; i < (threads?.length ?? 0); i += 5) {
      const batch = (threads ?? []).slice(i, i + 5);
      const results = await Promise.allSettled(
        batch.map((thread) => this.categorize(userId, thread.id))
      );
      categorized += results.filter((r) => r.status === "fulfilled").length;
    }

    return { categorized };
  }
}

export const aiService = new AiService();
