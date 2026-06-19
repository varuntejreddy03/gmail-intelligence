import type { GaxiosError } from "gaxios";

const MAX_UNITS_PER_SECOND = 250;
let availableUnits = MAX_UNITS_PER_SECOND;
let lastRefill = Date.now();
let limiterChain: Promise<void> = Promise.resolve();

/** Sleeps for the requested number of milliseconds. */
function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

/** Extracts an HTTP status code from an unknown Google API error. */
function getStatus(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const candidate = error as Partial<GaxiosError> & { status?: number };
  return candidate.response?.status ?? candidate.status;
}

/** Reserves Gmail quota units using a serialized token bucket. */
async function reserveQuota(units: number): Promise<void> {
  const previous = limiterChain;
  let release: () => void = () => undefined;
  limiterChain = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    while (true) {
      const now = Date.now();
      const elapsed = now - lastRefill;
      if (elapsed >= 1000) {
        const windows = Math.floor(elapsed / 1000);
        availableUnits = Math.min(
          MAX_UNITS_PER_SECOND,
          availableUnits + windows * MAX_UNITS_PER_SECOND,
        );
        lastRefill += windows * 1000;
      }
      if (availableUnits >= units) {
        availableUnits -= units;
        return;
      }
      await sleep(Math.max(1000 - (now - lastRefill), 10));
    }
  } finally {
    release();
  }
}

/** Runs an asynchronous Gmail operation after reserving quota units. */
export async function withRateLimit<T>(operation: () => Promise<T>, units = 5): Promise<T> {
  await reserveQuota(Math.max(1, units));
  return operation();
}

/** Retries transient Gmail errors with exponential backoff and jitter. */
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 5,
  onUnauthorized?: () => Promise<void>,
): Promise<T> {
  let refreshed = false;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      const status = getStatus(error);
      if (status === 401 && onUnauthorized && !refreshed) {
        refreshed = true;
        await onUnauthorized();
        continue;
      }
      const transient = status === 429 || (status !== undefined && status >= 500);
      if (!transient || attempt === maxRetries) throw error;
      const delay = Math.min(2 ** attempt * 1000, 32_000) + Math.floor(Math.random() * 500);
      await sleep(delay);
    }
  }
  throw new Error("Gmail operation exhausted its retry budget");
}

/** Chains Gmail quota limiting and retry behavior for one operation. */
export async function rateLimitedGmailCall<T>(
  operation: () => Promise<T>,
  units = 5,
  onUnauthorized?: () => Promise<void>,
): Promise<T> {
  return withRetry(() => withRateLimit(operation, units), 5, onUnauthorized);
}
