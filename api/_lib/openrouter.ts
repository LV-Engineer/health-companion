export const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// The model id lives in one env value so it can be swapped without touching code.
export function getModel(): string {
  const model = process.env.OPENROUTER_MODEL;
  if (!model) throw new Error('OPENROUTER_MODEL is not set');
  return model;
}

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504, 529]);
const MAX_RETRIES = 3;
const MAX_DELAY_MS = 8000;

export async function fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch(url, init);
    if (response.ok || !RETRYABLE_STATUSES.has(response.status)) return response;

    lastError = new Error(`OpenRouter error (${response.status}): ${await response.text()}`);
    if (attempt < MAX_RETRIES) {
      const retryAfter = Number(response.headers.get('retry-after'));
      const delay = retryAfter > 0 ? retryAfter * 1000 : 1000 * 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, Math.min(delay, MAX_DELAY_MS)));
    }
  }
  throw lastError!;
}
