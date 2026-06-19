import { AppError } from "./AppError";

export class GmailError extends AppError {
  constructor(message: string, public readonly gmailStatus?: number) {
    super(message, "GMAIL_ERROR", 502);
  }
}

export class GmailRateLimitError extends GmailError {
  constructor() {
    super("Gmail API rate limit exceeded. Please retry shortly.", 429);
  }
}
