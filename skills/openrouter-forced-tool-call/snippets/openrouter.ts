export const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Carries the HTTP status of the last failed attempt so callers can tell "busy" from "broken".
export class OpenRouterError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'OpenRouterError';
  }
}

// The model id lives in one env value so it can be swapped without touching code.
export function getModel(): string {
  const model = process.env.OPENROUTER_MODEL;
  if (!model) throw new Error('OPENROUTER_MODEL is not set');
  return model;
}

// Optional comma-separated model ids. OpenRouter tries them in order when the primary
// model is rate limited or down (request field `models`).
export function getFallbackModels(): string[] {
  return (process.env.OPENROUTER_FALLBACK_MODELS ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504, 529]);
const MAX_RETRIES = 3;
const MAX_DELAY_MS = 8000;

export async function fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
  let last: { status: number; body: string } | null = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch(url, init);
    if (response.ok || !RETRYABLE_STATUSES.has(response.status)) return response;

    last = { status: response.status, body: await response.text() };
    if (attempt < MAX_RETRIES) {
      const retryAfter = Number(response.headers.get('retry-after'));
      const delay = retryAfter > 0 ? retryAfter * 1000 : 1000 * 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, Math.min(delay, MAX_DELAY_MS)));
    }
  }
  throw new OpenRouterError(last!.status, `OpenRouter error (${last!.status}): ${last!.body}`);
}
