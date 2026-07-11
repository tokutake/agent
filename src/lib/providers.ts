// Maps OpenRouter model id prefixes (e.g. "google/gemini-2.5-flash") to
// a human-friendly provider / company name used to group the model menu.

const PROVIDER_NAMES: Record<string, string> = {
  google: 'Google',
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  'meta-llama': 'Meta',
  deepseek: 'DeepSeek',
  'x-ai': 'xAI',
  mistralai: 'Mistral',
  qwen: 'Qwen',
  microsoft: 'Microsoft',
  cohere: 'Cohere',
  perplexity: 'Perplexity',
};

// Preferred display order for grouped sections (others fall back to alpha).
export const PROVIDER_ORDER: string[] = [
  'Google',
  'OpenAI',
  'Anthropic',
  'Meta',
  'DeepSeek',
  'xAI',
  'Mistral',
  'Qwen',
  'Microsoft',
  'Cohere',
  'Perplexity',
];

export function getProviderName(modelId: string): string {
  const prefix = (modelId.split('/')[0] || '').toLowerCase();
  if (PROVIDER_NAMES[prefix]) return PROVIDER_NAMES[prefix];
  // Unknown provider: capitalize the raw prefix (e.g. "ai21" -> "Ai21").
  return prefix.charAt(0).toUpperCase() + prefix.slice(1);
}

// OpenRouter model names come prefixed with the company (e.g. "Google:
// Gemini 3.5 Flash"). Since the menu already shows the company as a group
// header, strip that prefix for a cleaner option label.
export function cleanModelName(rawName: string): string {
  const idx = rawName.indexOf(': ');
  return idx !== -1 ? rawName.slice(idx + 2).trim() : rawName;
}
