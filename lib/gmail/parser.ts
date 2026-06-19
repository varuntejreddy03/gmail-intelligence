import type { gmail_v1 } from "googleapis";

import { htmlToPlainText, sanitizeEmailHtml } from "@/lib/utils/sanitize";
import type { EmailMessage, ParsedEmailAddress } from "@/types";

interface ExtractedBodies {
  plain: string[];
  html: string[];
}

/** Decodes a Gmail base64url payload into UTF-8 text. */
function decodeBody(data?: string | null): string {
  if (!data) return "";
  try {
    return Buffer.from(data, "base64url").toString("utf8");
  } catch {
    return "";
  }
}

/** Recursively extracts text/plain and text/html bodies from MIME parts. */
function collectBodies(part: gmail_v1.Schema$MessagePart | undefined, output: ExtractedBodies): void {
  if (!part) return;
  const mimeType = part.mimeType?.toLowerCase();
  const content = decodeBody(part.body?.data);
  if (content && mimeType === "text/plain") output.plain.push(content);
  if (content && mimeType === "text/html") output.html.push(content);
  for (const child of part.parts ?? []) collectBodies(child, output);
}

/** Returns a case-insensitive Gmail header value. */
function getHeader(headers: gmail_v1.Schema$MessagePartHeader[], name: string): string {
  return headers.find((header) => header.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

/** Splits an address header on commas outside quoted names and angle brackets. */
function splitAddresses(header: string): string[] {
  const addresses: string[] = [];
  let current = "";
  let quoted = false;
  let angleDepth = 0;
  for (const character of header) {
    if (character === '"') quoted = !quoted;
    if (!quoted && character === "<") angleDepth += 1;
    if (!quoted && character === ">") angleDepth = Math.max(angleDepth - 1, 0);
    if (character === "," && !quoted && angleDepth === 0) {
      if (current.trim()) addresses.push(current.trim());
      current = "";
    } else {
      current += character;
    }
  }
  if (current.trim()) addresses.push(current.trim());
  return addresses;
}

/** Parses a display-name email address header. */
export function parseEmailAddress(header: string): ParsedEmailAddress {
  const match = header.trim().match(/^(?:"?([^"<]*)"?\s*)?<([^>]+)>$/);
  if (match) return { name: match[1]?.trim() || match[2].trim(), email: match[2].trim() };
  const email = header.trim();
  return { name: email.split("@")[0] || email, email };
}

/** Parses a comma-separated address header into structured recipients. */
function parseAddressList(header: string): ParsedEmailAddress[] {
  return splitAddresses(header).map(parseEmailAddress).filter((address) => address.email);
}

/** Parses a raw Gmail API message into a normalized application message. */
export function parseMessage(rawMessage: gmail_v1.Schema$Message): EmailMessage {
  const headers = rawMessage.payload?.headers ?? [];
  const bodies: ExtractedBodies = { plain: [], html: [] };
  collectBodies(rawMessage.payload ?? undefined, bodies);
  if (!bodies.plain.length && !bodies.html.length) {
    const content = decodeBody(rawMessage.payload?.body?.data);
    if (rawMessage.payload?.mimeType === "text/html") bodies.html.push(content);
    else bodies.plain.push(content);
  }
  const from = parseEmailAddress(getHeader(headers, "from"));
  const bodyHtml = sanitizeEmailHtml(bodies.html.join("\n"));
  const bodyText = bodies.plain.join("\n").trim() || htmlToPlainText(bodyHtml);
  const parsedDate = new Date(getHeader(headers, "date"));
  const labels = rawMessage.labelIds ?? [];
  return {
    id: rawMessage.id ?? "",
    threadId: rawMessage.threadId ?? "",
    fromName: from.name,
    fromEmail: from.email,
    toRecipients: parseAddressList(getHeader(headers, "to")),
    ccRecipients: parseAddressList(getHeader(headers, "cc")),
    subject: getHeader(headers, "subject") || "(No subject)",
    bodyText,
    bodyHtml,
    snippet: rawMessage.snippet ?? bodyText.slice(0, 240),
    date: Number.isNaN(parsedDate.valueOf()) ? new Date(Number(rawMessage.internalDate ?? 0)).toISOString() : parsedDate.toISOString(),
    inReplyTo: getHeader(headers, "in-reply-to") || null,
    references: getHeader(headers, "references") || null,
    messageId: getHeader(headers, "message-id") || null,
    gmailLabels: labels,
    isRead: !labels.includes("UNREAD"),
  };
}

/** Extracts compact plain text from a parsed email message. */
export function extractPlainText(message: EmailMessage): string {
  return (message.bodyText || htmlToPlainText(message.bodyHtml)).replace(/\s+/g, " ").trim();
}

/** Builds a chronological, size-limited conversation context for AI processing. */
export function buildThreadContext(messages: EmailMessage[], maxCharacters = 100_000): string {
  const blocks = [...messages]
    .sort((left, right) => Date.parse(left.date) - Date.parse(right.date))
    .map(
      (message) =>
        `From: ${message.fromName} <${message.fromEmail}>\nDate: ${message.date}\nSubject: ${message.subject}\n\n${extractPlainText(message)}\n---`,
    );
  const selected: string[] = [];
  let length = 0;
  for (let index = blocks.length - 1; index >= 0; index -= 1) {
    const block = blocks[index];
    if (length + block.length > maxCharacters && selected.length) break;
    selected.unshift(block.slice(-maxCharacters));
    length += block.length;
  }
  return selected.join("\n").slice(-maxCharacters);
}
