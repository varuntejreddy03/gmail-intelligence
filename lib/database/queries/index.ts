import { createHash, randomUUID } from "crypto";

import { getSupabaseAdmin } from "@/lib/database/client";
import type {
  ChatMessage,
  EmailCategory,
  EmailEmbedding,
  EmailMessage,
  EmailThread,
  PaginatedResult,
  SyncState,
} from "@/types";

interface UserTokenRow {
  id: string;
  google_access_token: string | null;
  google_refresh_token: string | null;
  google_token_expires_at: string | null;
}

interface ThreadRow {
  id: string;
  user_id: string;
  subject: string;
  snippet: string;
  participants: string[];
  last_message_at: string;
  message_count: number;
  summary: string | null;
  category: EmailCategory | null;
  is_read: boolean;
  labels: string[];
  created_at: string;
}

interface MessageRow {
  id: string;
  thread_id: string;
  user_id: string;
  from_name: string;
  from_email: string;
  to_recipients: EmailMessage["toRecipients"];
  cc_recipients: EmailMessage["ccRecipients"];
  subject: string;
  body_text: string;
  body_html: string;
  snippet: string;
  date: string;
  rfc_message_id: string | null;
  in_reply_to: string | null;
  references: string | null;
  gmail_labels: string[];
  summary: string | null;
  is_read: boolean;
  created_at: string;
}

/** Converts a stable provider identifier into a UUID suitable for database keys. */
export function providerUserId(providerAccountId: string): string {
  const hash = createHash("sha256").update(`google:${providerAccountId}`).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

/** Throws when a Supabase operation returns an error. */
function assertNoError(error: { message: string } | null, operation: string): void {
  if (error) throw new Error(`${operation}: ${error.message}`);
}

/** Maps a database thread row to the application thread shape. */
function mapThread(row: ThreadRow): EmailThread {
  return {
    id: row.id,
    userId: row.user_id,
    subject: row.subject,
    snippet: row.snippet,
    participants: row.participants,
    lastMessageAt: row.last_message_at,
    messageCount: row.message_count,
    summary: row.summary,
    category: row.category,
    isRead: row.is_read,
    labels: row.labels,
    createdAt: row.created_at,
  };
}

/** Maps a database message row to the application message shape. */
function mapMessage(row: MessageRow): EmailMessage {
  return {
    id: row.id,
    threadId: row.thread_id,
    userId: row.user_id,
    fromName: row.from_name,
    fromEmail: row.from_email,
    toRecipients: row.to_recipients,
    ccRecipients: row.cc_recipients,
    subject: row.subject,
    bodyText: row.body_text,
    bodyHtml: row.body_html,
    snippet: row.snippet,
    date: row.date,
    inReplyTo: row.in_reply_to,
    references: row.references,
    messageId: row.rfc_message_id,
    gmailLabels: row.gmail_labels,
    summary: row.summary,
    isRead: row.is_read,
    createdAt: row.created_at,
  };
}

/** Upserts a signed-in Google user and encrypted OAuth tokens. */
export async function upsertUser(input: {
  id: string;
  email: string;
  name?: string | null;
  avatarUrl?: string | null;
  accessToken?: string | null;
  refreshToken?: string | null;
  expiresAt?: number | null;
}): Promise<void> {
  const { error } = await getSupabaseAdmin().from("users").upsert(
    {
      id: input.id,
      email: input.email,
      name: input.name ?? null,
      avatar_url: input.avatarUrl ?? null,
      google_access_token: input.accessToken ?? null,
      google_refresh_token: input.refreshToken ?? null,
      google_token_expires_at: input.expiresAt
        ? new Date(input.expiresAt * 1000).toISOString()
        : null,
    },
    { onConflict: "id" },
  );
  assertNoError(error, "Unable to upsert user");
}

/** Updates encrypted Google tokens after an OAuth refresh. */
export async function updateUserTokens(
  userId: string,
  accessToken: string,
  expiresAt: number,
  refreshToken?: string | null,
): Promise<void> {
  const values: Record<string, string | null> = {
    google_access_token: accessToken,
    google_token_expires_at: new Date(expiresAt * 1000).toISOString(),
  };
  if (refreshToken) values.google_refresh_token = refreshToken;
  const { error } = await getSupabaseAdmin().from("users").update(values).eq("id", userId);
  assertNoError(error, "Unable to update OAuth tokens");
}

/** Fetches encrypted OAuth tokens for a user. */
export async function getUserTokens(userId: string): Promise<UserTokenRow | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("users")
    .select("id, google_access_token, google_refresh_token, google_token_expires_at")
    .eq("id", userId)
    .maybeSingle();
  assertNoError(error, "Unable to fetch OAuth tokens");
  return data as UserTokenRow | null;
}

/** Looks up encrypted OAuth tokens by the Gmail account email address. */
export async function getUserTokensByEmail(email: string): Promise<UserTokenRow | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("users")
    .select("id, google_access_token, google_refresh_token, google_token_expires_at")
    .eq("email", email)
    .maybeSingle();
  assertNoError(error, "Unable to find webhook user");
  return data as UserTokenRow | null;
}

/** Upserts an email thread and its message in foreign-key-safe order. */
export async function upsertMessageAndThread(
  userId: string,
  message: EmailMessage,
): Promise<void> {
  const threadValues = {
    id: message.threadId,
    user_id: userId,
    subject: message.subject || "(No subject)",
    snippet: message.snippet,
    participants: Array.from(
      new Set([message.fromEmail, ...message.toRecipients.map((recipient) => recipient.email)]),
    ).filter(Boolean),
    last_message_at: message.date,
    message_count: 1,
    is_read: message.isRead,
    labels: message.gmailLabels,
  };
  const { error: threadError } = await getSupabaseAdmin()
    .from("email_threads")
    .upsert(threadValues, { onConflict: "id" });
  assertNoError(threadError, `Unable to upsert thread ${message.threadId}`);

  const { error: messageError } = await getSupabaseAdmin().from("email_messages").upsert(
    {
      id: message.id,
      thread_id: message.threadId,
      user_id: userId,
      from_name: message.fromName,
      from_email: message.fromEmail,
      to_recipients: message.toRecipients,
      cc_recipients: message.ccRecipients,
      subject: message.subject,
      body_text: message.bodyText,
      body_html: message.bodyHtml,
      snippet: message.snippet,
      date: message.date,
      rfc_message_id: message.messageId,
      in_reply_to: message.inReplyTo,
      references: message.references,
      gmail_labels: message.gmailLabels,
      is_read: message.isRead,
    },
    { onConflict: "id" },
  );
  assertNoError(messageError, `Unable to upsert message ${message.id}`);
}

/** Recomputes denormalized thread metadata from its stored messages. */
export async function refreshThreadMetadata(userId: string, threadId: string): Promise<void> {
  const client = getSupabaseAdmin();
  const { data, error } = await client
    .from("email_messages")
    .select("date, is_read, gmail_labels, from_email, to_recipients, snippet, subject")
    .eq("user_id", userId)
    .eq("thread_id", threadId)
    .order("date", { ascending: true });
  assertNoError(error, "Unable to recalculate thread metadata");
  const rows = (data ?? []) as Array<{
    date: string;
    is_read: boolean;
    gmail_labels: string[];
    from_email: string;
    to_recipients: EmailMessage["toRecipients"];
    snippet: string;
    subject: string;
  }>;
  if (!rows.length) return;
  const latest = rows[rows.length - 1];
  const participants = Array.from(
    new Set(rows.flatMap((row) => [row.from_email, ...row.to_recipients.map((entry) => entry.email)])),
  ).filter(Boolean);
  const labels = Array.from(new Set(rows.flatMap((row) => row.gmail_labels)));
  const { error: updateError } = await client
    .from("email_threads")
    .update({
      subject: latest.subject,
      snippet: latest.snippet,
      participants,
      last_message_at: latest.date,
      message_count: rows.length,
      is_read: rows.every((row) => row.is_read),
      labels,
    })
    .eq("id", threadId)
    .eq("user_id", userId);
  assertNoError(updateError, "Unable to update thread metadata");
}

/** Records the latest successful Gmail sync timestamp on the user. */
export async function updateUserLastSync(userId: string, timestamp: string): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from("users")
    .update({ last_sync_at: timestamp })
    .eq("id", userId);
  assertNoError(error, "Unable to update user sync timestamp");
}

/** Returns paginated inbox threads with optional category and search filters. */
export async function listThreads(input: {
  userId: string;
  category?: string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<PaginatedResult<EmailThread>> {
  const page = Math.max(input.page ?? 1, 1);
  const limit = Math.min(Math.max(input.limit ?? 25, 1), 100);
  const from = (page - 1) * limit;
  let query = getSupabaseAdmin()
    .from("email_threads")
    .select("*", { count: "exact" })
    .eq("user_id", input.userId);
  if (input.category) query = query.eq("category", input.category);
  if (input.search) {
    const term = input.search.replace(/[%_,]/g, " ").trim();
    query = query.or(`subject.ilike.%${term}%,snippet.ilike.%${term}%`);
  }
  const { data, error, count } = await query
    .order("last_message_at", { ascending: false })
    .range(from, from + limit - 1);
  assertNoError(error, "Unable to list inbox threads");
  const total = count ?? 0;
  return {
    data: ((data ?? []) as ThreadRow[]).map(mapThread),
    page,
    limit,
    total,
    totalPages: Math.max(Math.ceil(total / limit), 1),
  };
}

/** Returns a thread and its chronological messages for the owning user. */
export async function getThreadById(userId: string, threadId: string): Promise<EmailThread | null> {
  const client = getSupabaseAdmin();
  const [threadResult, messageResult] = await Promise.all([
    client.from("email_threads").select("*").eq("user_id", userId).eq("id", threadId).maybeSingle(),
    client
      .from("email_messages")
      .select("*")
      .eq("user_id", userId)
      .eq("thread_id", threadId)
      .order("date", { ascending: true }),
  ]);
  assertNoError(threadResult.error, "Unable to fetch thread");
  assertNoError(messageResult.error, "Unable to fetch thread messages");
  if (!threadResult.data) return null;
  return {
    ...mapThread(threadResult.data as ThreadRow),
    messages: ((messageResult.data ?? []) as MessageRow[]).map(mapMessage),
  };
}

/** Returns one email message belonging to the specified user. */
export async function getMessageById(userId: string, messageId: string): Promise<EmailMessage | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("email_messages")
    .select("*")
    .eq("user_id", userId)
    .eq("id", messageId)
    .maybeSingle();
  assertNoError(error, "Unable to fetch email message");
  return data ? mapMessage(data as MessageRow) : null;
}

/** Updates the generated summary for a message or thread. */
export async function updateSummary(
  kind: "message" | "thread",
  id: string,
  userId: string,
  summary: string,
): Promise<void> {
  const table = kind === "message" ? "email_messages" : "email_threads";
  const { error } = await getSupabaseAdmin()
    .from(table)
    .update({ summary })
    .eq("id", id)
    .eq("user_id", userId);
  assertNoError(error, `Unable to update ${kind} summary`);
}

/** Stores a category result and updates the owning thread. */
export async function saveThreadCategory(input: {
  threadId: string;
  userId: string;
  category: EmailCategory;
  confidence: number;
  modelUsed: string;
}): Promise<void> {
  const client = getSupabaseAdmin();
  const [updateResult, insertResult] = await Promise.all([
    client
      .from("email_threads")
      .update({ category: input.category })
      .eq("id", input.threadId)
      .eq("user_id", input.userId),
    client.from("email_categories").insert({
      id: randomUUID(),
      thread_id: input.threadId,
      user_id: input.userId,
      category: input.category,
      confidence: input.confidence,
      model_used: input.modelUsed,
    }),
  ]);
  assertNoError(updateResult.error, "Unable to update thread category");
  assertNoError(insertResult.error, "Unable to store category audit record");
}

/** Returns the current Gmail synchronization state for a user. */
export async function getSyncState(userId: string): Promise<SyncState | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("sync_state")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  assertNoError(error, "Unable to fetch sync state");
  if (!data) return null;
  return {
    id: data.id as string,
    userId: data.user_id as string,
    historyId: data.history_id as string | null,
    lastFullSyncAt: data.last_full_sync_at as string | null,
    lastIncrementalSyncAt: data.last_incremental_sync_at as string | null,
    syncStatus: data.sync_status as SyncState["syncStatus"],
    createdAt: data.created_at as string,
  };
}

/** Upserts Gmail synchronization progress for a user. */
export async function upsertSyncState(
  userId: string,
  values: Partial<Omit<SyncState, "id" | "userId" | "createdAt">>,
): Promise<void> {
  const { error } = await getSupabaseAdmin().from("sync_state").upsert(
    {
      user_id: userId,
      history_id: values.historyId,
      last_full_sync_at: values.lastFullSyncAt,
      last_incremental_sync_at: values.lastIncrementalSyncAt,
      sync_status: values.syncStatus ?? "idle",
    },
    { onConflict: "user_id" },
  );
  assertNoError(error, "Unable to update sync state");
}

/** Replaces all vector chunks for an email message. */
export async function replaceEmbeddings(
  message: EmailMessage,
  userId: string,
  chunks: Array<{ content: string; embedding: number[] }>,
): Promise<void> {
  const client = getSupabaseAdmin();
  const { error: deleteError } = await client
    .from("email_embeddings")
    .delete()
    .eq("message_id", message.id)
    .eq("user_id", userId);
  assertNoError(deleteError, "Unable to clear message embeddings");
  if (!chunks.length) return;
  const { error } = await client.from("email_embeddings").insert(
    chunks.map((chunk, index) => ({
      message_id: message.id,
      thread_id: message.threadId,
      user_id: userId,
      content_chunk: chunk.content,
      chunk_index: index,
      embedding: chunk.embedding,
    })),
  );
  assertNoError(error, "Unable to store message embeddings");
}

/** Runs pgvector similarity search scoped to one user. */
export async function matchEmbeddings(
  userId: string,
  embedding: number[],
  count: number,
): Promise<EmailEmbedding[]> {
  const { data, error } = await getSupabaseAdmin().rpc("match_email_embeddings", {
    query_embedding: embedding,
    match_user_id: userId,
    match_count: count,
  });
  assertNoError(error, "Unable to search email embeddings");
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    messageId: String(row.message_id),
    threadId: String(row.thread_id),
    userId: String(row.user_id),
    contentChunk: String(row.content_chunk),
    chunkIndex: Number(row.chunk_index),
    similarity: Number(row.similarity),
  }));
}

/** Creates a chat session and returns its generated identifier. */
export async function createChatSession(userId: string, title: string): Promise<string> {
  const { data, error } = await getSupabaseAdmin()
    .from("chat_sessions")
    .insert({ user_id: userId, title: title.slice(0, 120) || "New chat" })
    .select("id")
    .single();
  assertNoError(error, "Unable to create chat session");
  if (!data) throw new Error("Unable to create chat session: no identifier returned");
  return String(data.id);
}

/** Stores one user or assistant chat message. */
export async function saveChatMessage(sessionId: string, message: ChatMessage): Promise<void> {
  const { error } = await getSupabaseAdmin().from("chat_messages").insert({
    session_id: sessionId,
    role: message.role,
    content: message.content,
    source_message_ids: message.sourceMessageIds ?? [],
    source_thread_ids: message.sourceThreadIds ?? [],
  });
  assertNoError(error, "Unable to store chat message");
}
