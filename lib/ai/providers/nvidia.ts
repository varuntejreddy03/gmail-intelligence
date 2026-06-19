import OpenAI from "openai";

import { CATEGORIZE_PROMPT, fillPrompt } from "@/lib/ai/prompts";
import { optionalEnv, requireEnv } from "@/lib/env";
import { EMAIL_CATEGORIES, type EmailCategory } from "@/types";

let client: OpenAI | null = null;

/** Returns a lazy OpenAI-compatible NVIDIA NIM client. */
function getNvidiaClient(): OpenAI {
  if (!client) {
    client = new OpenAI({
      apiKey: requireEnv("NVIDIA_API_KEY"),
      baseURL: optionalEnv("NVIDIA_API_BASE") ?? "https://integrate.api.nvidia.com/v1",
    });
  }
  return client;
}

/** Classifies an email with NVIDIA NIM and a safe Personal fallback. */
export async function categorizeEmail(
  emailContent: string,
  subject: string,
): Promise<{ category: EmailCategory; confidence: number }> {
  try {
    const response = await getNvidiaClient().chat.completions.create({
      model: "meta/llama-3.1-8b-instruct",
      temperature: 0,
      max_tokens: 80,
      messages: [
        {
          role: "user",
          content: fillPrompt(CATEGORIZE_PROMPT, {
            subject: subject.slice(0, 500),
            snippet: emailContent.slice(0, 500),
          }),
        },
      ],
    });
    const content = response.choices[0]?.message.content?.trim() ?? "";
    const parsed = JSON.parse(content.replace(/^```json\s*|\s*```$/g, "")) as {
      category?: string;
      confidence?: number;
    };
    if (!EMAIL_CATEGORIES.includes(parsed.category as EmailCategory)) {
      throw new Error("NVIDIA returned an unsupported category");
    }
    return {
      category: parsed.category as EmailCategory,
      confidence: Math.min(Math.max(Number(parsed.confidence) || 0, 0), 1),
    };
  } catch {
    return { category: "Personal", confidence: 0 };
  }
}
