import { ValidationError } from "../errors";

export function validateSendRequest(body: Record<string, unknown>): {
  to: string; subject: string; body: string;
  inReplyTo?: string; references?: string; threadId?: string;
} {
  const { to, subject, body: emailBody, inReplyTo, references, threadId } = body;
  if (!to || typeof to !== "string") throw new ValidationError("to is required");
  if (!subject || typeof subject !== "string") throw new ValidationError("subject is required");
  if (!emailBody || typeof emailBody !== "string") throw new ValidationError("body is required");
  if ((subject as string).length > 998) throw new ValidationError("subject must not exceed 998 characters");

  return {
    to: to as string,
    subject: subject as string,
    body: emailBody as string,
    inReplyTo: inReplyTo as string | undefined,
    references: references as string | undefined,
    threadId: threadId as string | undefined,
  };
}
