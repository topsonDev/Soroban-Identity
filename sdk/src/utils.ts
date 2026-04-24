import { StrKey } from "@stellar/stellar-sdk";

/**
 * Retries an async function with exponential backoff on transient network errors.
 * Contract-level errors (non-network) are NOT retried.
 *
 * @param fn          - Async function to execute.
 * @param maxRetries  - Maximum number of retry attempts (default: 3).
 * @param baseDelayMs - Initial delay in ms, doubles each retry (default: 500).
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 500
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      if (!isTransientError(err) || attempt === maxRetries) throw err;
      lastError = err;
      await delay(baseDelayMs * 2 ** attempt);
    }
  }
  throw lastError;
}

function isTransientError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes("503") ||
    msg.includes("timeout") ||
    msg.includes("network") ||
    msg.includes("econnreset") ||
    msg.includes("econnrefused") ||
    msg.includes("fetch failed")
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => (globalThis as unknown as { setTimeout: (fn: () => void, ms: number) => void }).setTimeout(resolve, ms));
}

/**
 * Validates a Stellar address using StrKey.
 * Throws an InvalidAddress error with a descriptive message if the address is invalid.
 */
export function validateStellarAddress(address: string): void {
  if (!StrKey.isValidEd25519PublicKey(address)) {
    throw new Error(`InvalidAddress: "${address}" is not a valid Stellar address`);
  }
}
