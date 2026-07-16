import type { OpenRouterModel } from '../types/chat';

// --- Model filtering ------------------------------------------------------
//
// We fetch the full OpenRouter catalog and keep almost everything, only
// dropping noise (non-text models: images, audio, music, experimental/preview
// builds, provider-alias "~/..." endpoints). We no longer try to collapse each
// model family down to a single "latest" version — that heuristic mis-parsed
// size/revision numbers (e.g. "550b", "a55b") as version digits and silently
// hid legitimate new releases like NVIDIA's Nemotron Ultra/Super/Nano lines.
//
// Instead, the full list is sorted newest-first by the OpenRouter `created`
// timestamp, so users always see the latest models at the top and can still
// pick any size / flavour they want.

// id substrings that should never appear in the picker.
const BLACKLIST_PATTERNS: RegExp[] = [
  /^~/i,                                       // provider alias endpoints
  /image/i,                                    // image-generation models
  /audio|music|lyria|tts|voice/i,              // audio / music / speech models
  /-(exp|experimental|preview|beta)\b/i,       // experimental builds
];

function isBlacklisted(id: string): boolean {
  return BLACKLIST_PATTERNS.some((re) => re.test(id));
}

// A small fallback used only before the first API fetch, so the picker is not
// empty on first load. Once models are fetched, the full catalog takes over.
export const FALLBACK_MODELS: OpenRouterModel[] = [
  { id: 'google/gemini-3.5-flash', name: 'Gemini 3.5 Flash', context_length: 1048576, pricing: { prompt: '0.0000015', completion: '0.000009' } },
  { id: 'openai/gpt-5.6-luna', name: 'GPT-5.6 Luna', context_length: 1050000, pricing: { prompt: '0.000001', completion: '0.000006' } },
  { id: 'openai/gpt-5.6-terra-pro', name: 'GPT-5.6 Terra Pro', context_length: 1050000, pricing: { prompt: '0.0000025', completion: '0.000015' } },
  { id: 'anthropic/claude-sonnet-5', name: 'Claude Sonnet 5', context_length: 1000000, pricing: { prompt: '0.000002', completion: '0.00001' } },
  { id: 'anthropic/claude-opus-4.8', name: 'Claude Opus 4.8', context_length: 1000000, pricing: { prompt: '0.000005', completion: '0.000025' } },
  { id: 'meta-llama/llama-4-scout', name: 'Llama 4 Scout', context_length: 10000000, pricing: { prompt: '0.0000001', completion: '0.0000003' } },
  { id: 'deepseek/deepseek-v4-flash', name: 'DeepSeek V4 Flash', context_length: 1048576, pricing: { prompt: '0.000000077', completion: '0.000000154' } },
  { id: 'x-ai/grok-4.20', name: 'Grok 4.20', context_length: 2000000, pricing: { prompt: '0.00000125', completion: '0.0000025' } },
  { id: 'mistralai/mistral-large-2512', name: 'Mistral Large 3', context_length: 262144, pricing: { prompt: '0.0000005', completion: '0.0000015' } },
  { id: 'qwen/qwen3.7-max', name: 'Qwen3.7 Max', context_length: 1000000, pricing: { prompt: '0.00000125', completion: '0.00000375' } },
];

// Drop noise and return the models sorted newest-first by the OpenRouter
// `created` timestamp (models without a timestamp sink to the bottom).
export function filterToBlacklist(fetched: OpenRouterModel[]): OpenRouterModel[] {
  return fetched
    .filter((m) => m.id && m.name && !isBlacklisted(m.id))
    .sort((a, b) => (b.created ?? 0) - (a.created ?? 0));
}
