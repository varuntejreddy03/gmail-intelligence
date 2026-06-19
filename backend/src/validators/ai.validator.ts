import { ValidationError } from "../errors";

export function validateChatRequest(body: Record<string, unknown>): { message: string; sessionId?: string; history?: unknown[] } {
  const { message, sessionId, history } = body;
  if (!message || typeof message !== "string" || message.trim().length === 0) {
    throw new ValidationError("message is required and must be a non-empty string");
  }
  if (message.length > 20000) {
    throw new ValidationError("message must not exceed 20,000 characters");
  }
  return { message: message.trim(), sessionId: sessionId as string | undefined, history: history as unknown[] | undefined };
}

export function validateSummarizeRequest(body: Record<string, unknown>): { threadId?: string; messageId?: string } {
  const { threadId, messageId } = body;
  if (!threadId && !messageId) {
    throw new ValidationError("Provide threadId or messageId");
  }
  return { threadId: threadId as string | undefined, messageId: messageId as string | undefined };
}

export function validateComposeRequest(body: Record<string, unknown>): { prompt: string; replyToThreadId?: string } {
  const { prompt, replyToThreadId } = body;
  if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
    throw new ValidationError("prompt is required");
  }
  return { prompt: prompt.trim(), replyToThreadId: replyToThreadId as string | undefined };
}

export function validateCategorizeRequest(body: Record<string, unknown>): { threadId: string } {
  const { threadId } = body;
  if (!threadId || typeof threadId !== "string") {
    throw new ValidationError("threadId is required");
  }
  return { threadId };
}
