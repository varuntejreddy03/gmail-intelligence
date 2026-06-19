export { EMAIL_SUMMARY_PROMPT, THREAD_SUMMARY_PROMPT } from "./summarize";
export { COMPOSE_PROMPT, REPLY_PROMPT } from "./compose";
export { CATEGORIZE_PROMPT } from "./categorize";
export { CHAT_SYSTEM_PROMPT } from "./chat";

/** Replaces named placeholders in a prompt template. */
export function fillPrompt(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, value),
    template,
  );
}
