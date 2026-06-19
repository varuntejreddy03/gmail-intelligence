import {
  getGmailClient,
  getHistoryList,
  getMessage,
  getProfile,
  listMessages,
} from "@/lib/gmail/client";
import { parseMessage } from "@/lib/gmail/parser";
import { generateEmbeddings, buildEmbeddingInput } from "@/lib/ai/embeddings";
import {
  getSyncState,
  refreshThreadMetadata,
  updateUserLastSync,
  upsertMessageAndThread,
  upsertSyncState,
} from "@/lib/database/queries";
import { getSupabaseAdmin } from "@/lib/database/client";

const MAX_MESSAGES = 10_000;
const BATCH_SIZE = 10;

/** Fetches, parses, stores, and embeds a set of Gmail message identifiers. */
async function processMessageIds(
  messageIds: string[],
  userId: string,
  accessToken: string,
): Promise<Set<string>> {
  const client = getGmailClient(accessToken);
  const affectedThreads = new Set<string>();
  const embeddingQueue: Array<{ id: string; threadId: string; text: string }> = [];

  for (let index = 0; index < messageIds.length; index += BATCH_SIZE) {
    const batch = messageIds.slice(index, index + BATCH_SIZE);
    const rawMessages = await Promise.all(batch.map((messageId) => getMessage(client, messageId)));
    for (const raw of rawMessages) {
      const message = parseMessage(raw);
      if (!message.id || !message.threadId) continue;
      await upsertMessageAndThread(userId, message);
      affectedThreads.add(message.threadId);
      embeddingQueue.push({
        id: message.id,
        threadId: message.threadId,
        text: buildEmbeddingInput(message.subject, message.fromEmail, message.snippet || message.bodyText),
      });
    }
  }

  // Batch embed and upsert
  if (embeddingQueue.length > 0) {
    try {
      const texts = embeddingQueue.map((e) => e.text);
      const vectors = await generateEmbeddings(texts);
      const rows = embeddingQueue.map((e, i) => ({
        message_id: e.id,
        thread_id: e.threadId,
        user_id: userId,
        content_chunk: e.text,
        chunk_index: 0,
        embedding: vectors[i],
      }));
      await getSupabaseAdmin().from("email_embeddings").upsert(rows, { onConflict: "message_id,chunk_index" });
    } catch (err) {
      console.error("[Sync] Embedding batch failed (non-blocking):", err instanceof Error ? err.message : err);
    }
  }

  await Promise.all(
    Array.from(affectedThreads).map((threadId) => refreshThreadMetadata(userId, threadId)),
  );
  return affectedThreads;
}

/** Performs the initial paginated Gmail import, capped at 10,000 messages. */
export async function initialSync(userId: string, accessToken: string): Promise<void> {
  const existing = await getSyncState(userId);
  if (existing?.lastFullSyncAt) return;
  await upsertSyncState(userId, { syncStatus: "running" });
  try {
    const client = getGmailClient(accessToken);
    const messageIds: string[] = [];
    let pageToken: string | undefined;
    do {
      const page = await listMessages(client, {
        pageToken,
        maxResults: Math.min(500, MAX_MESSAGES - messageIds.length),
      });
      messageIds.push(
        ...page.messages.map((message) => message.id).filter((id): id is string => Boolean(id)),
      );
      pageToken = page.nextPageToken;
    } while (pageToken && messageIds.length < MAX_MESSAGES);
    await processMessageIds(messageIds.slice(0, MAX_MESSAGES), userId, accessToken);
    const profile = await getProfile(client);
    const timestamp = new Date().toISOString();
    await upsertSyncState(userId, {
      historyId: profile.historyId ?? null,
      lastFullSyncAt: timestamp,
      syncStatus: "idle",
    });
    await updateUserLastSync(userId, timestamp);
  } catch (error) {
    await upsertSyncState(userId, { syncStatus: "error" });
    throw error;
  }
}

/** Applies Gmail history changes since the last recorded history identifier. */
export async function incrementalSync(userId: string, accessToken: string): Promise<void> {
  const state = await getSyncState(userId);
  if (!state?.historyId) return initialSync(userId, accessToken);
  await upsertSyncState(userId, { syncStatus: "running" });
  try {
    const messageIds = new Set<string>();
    let pageToken: string | undefined;
    let latestHistoryId = state.historyId;
    do {
      const page = await getHistoryList(getGmailClient(accessToken), state.historyId, pageToken);
      for (const entry of page.history) {
        for (const added of entry.messagesAdded ?? []) {
          if (added.message?.id) messageIds.add(added.message.id);
        }
        for (const changed of [...(entry.labelsAdded ?? []), ...(entry.labelsRemoved ?? [])]) {
          if (changed.message?.id) messageIds.add(changed.message.id);
        }
      }
      latestHistoryId = page.historyId ?? latestHistoryId;
      pageToken = page.nextPageToken;
    } while (pageToken);
    await processMessageIds(Array.from(messageIds), userId, accessToken);
    const timestamp = new Date().toISOString();
    await upsertSyncState(userId, {
      historyId: latestHistoryId,
      lastIncrementalSyncAt: timestamp,
      syncStatus: "idle",
    });
    await updateUserLastSync(userId, timestamp);
  } catch (error) {
    await upsertSyncState(userId, { syncStatus: "error" });
    throw error;
  }
}
