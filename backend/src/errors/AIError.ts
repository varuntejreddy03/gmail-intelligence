import { AppError } from "./AppError";

export class AIError extends AppError {
  constructor(message: string, public readonly provider?: string) {
    super(message, "AI_ERROR", 502);
  }
}

export class AIRateLimitError extends AIError {
  constructor(provider: string) {
    super(`${provider} rate limit exceeded. Falling back or retrying.`, provider);
  }
}
