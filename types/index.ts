import type { gmail_v1 } from "googleapis";

export const EMAIL_CATEGORIES = [
  "Newsletter",
  "Job/Recruitment",
  "Finance",
  "Notifications",
  "Personal",
  "Work/Professional",
] as const;

export type EmailCategory = (typeof EMAIL_CATEGORIES)[number];

export interface ParsedEmailAddress {
  name: string;
  email: string;
}

export interface EmailMessage {
  id: string;
  threadId: string;
  userId?: string;
  fromName: string;
  fromEmail: string;
  toRecipients: ParsedEmailAddress[];
  ccRecipients: ParsedEmailAddress[];
  subject: string;
  bodyText: string;
  bodyHtml: string;
  snippet: string;
  date: string;
  inReplyTo: string | null;
  references: string | null;
  messageId: string | null;
  gmailLabels: string[];
  summary?: string | null;
  isRead: boolean;
  createdAt?: string;
}

export interface EmailThread {
  id: string;
  userId: string;
  subject: string;
  snippet: string;
  participants: string[];
  lastMessageAt: string;
  messageCount: number;
  summary: string | null;
  category: EmailCategory | null;
  isRead: boolean;
  labels: string[];
  createdAt?: string;
  messages?: EmailMessage[];
}

export interface EmailEmbedding {
  id: string;
  messageId: string;
  threadId: string;
  userId: string;
  contentChunk: string;
  chunkIndex: number;
  embedding?: number[];
  similarity?: number;
  message?: Pick<EmailMessage, "fromEmail" | "subject" | "date" | "snippet">;
}

export interface ChatSession {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
}

export interface ChatMessage {
  id?: string;
  sessionId?: string;
  role: "user" | "assistant";
  content: string;
  sourceMessageIds?: string[];
  sourceThreadIds?: string[];
  createdAt?: string;
}

export interface SyncState {
  id?: string;
  userId: string;
  historyId: string | null;
  lastFullSyncAt: string | null;
  lastIncrementalSyncAt: string | null;
  syncStatus: "idle" | "running" | "error";
  createdAt?: string;
}

export interface AgentResponse {
  response: string;
  sourceMessageIds: string[];
  sourceThreadIds: string[];
  sources?: EmailEmbedding[];
}

export type GmailMessageRaw = gmail_v1.Schema$Message;

export interface ComposeRequest {
  prompt: string;
  replyToThreadId?: string;
}

export interface SendEmailParams {
  to: string | string[];
  subject: string;
  body: string;
  inReplyTo?: string;
  references?: string;
  threadId?: string;
}

export interface ApiErrorBody {
  error: string;
  code: string;
  status: number;
}

export interface PaginatedResult<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
