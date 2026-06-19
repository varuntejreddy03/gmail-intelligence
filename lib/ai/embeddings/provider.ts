import OpenAI from "openai";

const MAX_BATCH_SIZE = 50;
const EMBEDDING_MODEL = process.env.OPENROUTER_EMBEDDING_MODEL || "openai/text-embedding-3-small";

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    const key = process.env.OPENROUTER_API_KEY;
    if (!key) throw new Error("OPENROUTER_API_KEY is not set");
    client = new OpenAI({ apiKey: key, baseURL: "https://openrouter.ai/api/v1" });
  }
  return client;
}

/** Generates embeddings for an array of texts. Batch-aware, provider-agnostic at call site. */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (!texts.length) return [];
  const results: number[][] = [];
  for (let i = 0; i < texts.length; i += MAX_BATCH_SIZE) {
    const batch = texts.slice(i, i + MAX_BATCH_SIZE);
    const vectors = await callWithRetry(batch);
    results.push(...vectors);
  }
  return results;
}

/** Single-text convenience wrapper. */
export async function generateSingleEmbedding(text: string): Promise<number[]> {
  const [vec] = await generateEmbeddings([text]);
  return vec ?? Array<number>(768).fill(0);
}

/** Builds the embedding input for an email. */
export function buildEmbeddingInput(subject: string, from: string, snippet: string): string {
  return `${subject}\n${from}\n${snippet.slice(0, 500)}`;
}

async function callWithRetry(batch: string[], attempt = 0): Promise<number[][]> {
  const start = Date.now();
  try {
    const res = await getClient().embeddings.create({
      model: EMBEDDING_MODEL,
      input: batch,
      dimensions: 768,
    });
    console.log(`[Embeddings] model=${EMBEDDING_MODEL} batch=${batch.length} latency=${Date.now() - start}ms`);
    return res.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
  } catch (err: unknown) {
    const status = (err as { status?: number }).status;
    console.warn(`[Embeddings] ERROR status=${status} batch=${batch.length} attempt=${attempt}`);

    if (status === 429 && attempt < 3) {
      await sleep(Math.pow(2, attempt) * 1000);
      return callWithRetry(batch, attempt + 1);
    }
    if (status === 529 && attempt < 1) {
      await sleep(1000);
      return callWithRetry(batch, attempt + 1);
    }
    return batch.map(() => Array<number>(768).fill(0));
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
