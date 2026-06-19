import { google, type gmail_v1 } from "googleapis";

import { rateLimitedGmailCall } from "@/lib/gmail/rate-limiter";
import type { SendEmailParams } from "@/types";

export interface MessageListResult {
  messages: gmail_v1.Schema$Message[];
  nextPageToken?: string;
}

export interface HistoryListResult {
  history: gmail_v1.Schema$History[];
  historyId?: string;
  nextPageToken?: string;
}

/** Creates an authenticated Gmail API v1 client for an OAuth access token. */
export function getGmailClient(accessToken: string): gmail_v1.Gmail {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.gmail({ version: "v1", auth });
}

/** Lists Gmail message identifiers with pagination support. */
export async function listMessages(
  client: gmail_v1.Gmail,
  params: { pageToken?: string; maxResults?: number; q?: string } = {},
): Promise<MessageListResult> {
  const response = await rateLimitedGmailCall(
    () =>
      client.users.messages.list({
        userId: "me",
        pageToken: params.pageToken,
        maxResults: params.maxResults ?? 100,
        q: params.q,
      }),
    5,
  );
  return {
    messages: response.data.messages ?? [],
    nextPageToken: response.data.nextPageToken ?? undefined,
  };
}

/** Fetches one complete Gmail message. */
export async function getMessage(
  client: gmail_v1.Gmail,
  messageId: string,
): Promise<gmail_v1.Schema$Message> {
  const response = await rateLimitedGmailCall(
    () => client.users.messages.get({ userId: "me", id: messageId, format: "full" }),
    5,
  );
  return response.data;
}

/** Fetches a Gmail thread and all of its messages. */
export async function getThread(
  client: gmail_v1.Gmail,
  threadId: string,
): Promise<gmail_v1.Schema$Thread> {
  const response = await rateLimitedGmailCall(
    () => client.users.threads.get({ userId: "me", id: threadId, format: "full" }),
    10,
  );
  return response.data;
}

/** Removes CR/LF characters to prevent mail header injection. */
function sanitizeHeader(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

/** Encodes an RFC 2822 email and sends it through Gmail. */
export async function sendEmail(
  client: gmail_v1.Gmail,
  params: SendEmailParams,
): Promise<{ messageId: string; threadId: string }> {
  const recipients = Array.isArray(params.to) ? params.to : [params.to];
  const headers = [
    `To: ${recipients.map(sanitizeHeader).join(", ")}`,
    `Subject: ${sanitizeHeader(params.subject)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
  ];
  if (params.inReplyTo) headers.push(`In-Reply-To: ${sanitizeHeader(params.inReplyTo)}`);
  if (params.references) headers.push(`References: ${sanitizeHeader(params.references)}`);
  const raw = Buffer.from(`${headers.join("\r\n")}\r\n\r\n${params.body}`, "utf8").toString(
    "base64url",
  );
  const response = await rateLimitedGmailCall(
    () =>
      client.users.messages.send({
        userId: "me",
        requestBody: { raw, threadId: params.threadId },
      }),
    100,
  );
  return {
    messageId: response.data.id ?? "",
    threadId: response.data.threadId ?? params.threadId ?? "",
  };
}

/** Lists all labels in the authenticated Gmail account. */
export async function getLabels(client: gmail_v1.Gmail): Promise<gmail_v1.Schema$Label[]> {
  const response = await rateLimitedGmailCall(
    () => client.users.labels.list({ userId: "me" }),
    1,
  );
  return response.data.labels ?? [];
}

/** Lists mailbox changes after a Gmail history identifier. */
export async function getHistoryList(
  client: gmail_v1.Gmail,
  startHistoryId: string,
  pageToken?: string,
): Promise<HistoryListResult> {
  const response = await rateLimitedGmailCall(
    () =>
      client.users.history.list({
        userId: "me",
        startHistoryId,
        pageToken,
        historyTypes: ["messageAdded", "labelAdded", "labelRemoved"],
      }),
    2,
  );
  return {
    history: response.data.history ?? [],
    historyId: response.data.historyId ?? undefined,
    nextPageToken: response.data.nextPageToken ?? undefined,
  };
}

/** Returns the authenticated Gmail profile, including its latest history ID. */
export async function getProfile(client: gmail_v1.Gmail): Promise<gmail_v1.Schema$Profile> {
  const response = await rateLimitedGmailCall(
    () => client.users.getProfile({ userId: "me" }),
    1,
  );
  return response.data;
}
