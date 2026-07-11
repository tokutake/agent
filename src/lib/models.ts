import type { OpenRouterModel } from '../types/chat';

// --- Blacklist-based model filtering -------------------------------------
//
// We no longer hand-maintain a whitelist of "latest" models (which goes stale
// the moment a new model ships). Instead we fetch the full OpenRouter catalog
// and *drop* what we don't want, keeping only the newest major version of each
// model family:
//
//   1. Noise / non-text models are removed by BLACKLIST_PATTERNS (images,
//      audio, music, experimental / preview builds, provider-alias "~/...").
//   2. Within each family we keep only the model(s) with the highest version
//      number. Parallel variants that share the same version (e.g. -mini,
//      -pro, -fast, -thinking) are all kept, so the user can still choose
//      between sizes / flavours of the latest release.
//
// A "family" is the provider plus the leading alphabetic token(s) of the model
// name (e.g. "gpt", "claude", "gemini", "llama", "deepseek", "grok", "qwen",
// "mistral"). Sub-lines like claude-opus vs claude-sonnet stay separate, so
// each gets its own latest.
//
// To exclude more, just add a pattern to BLACKLIST_PATTERNS below.

// Provider alias endpoints ("~/...") are pointers to other models — skip them.
function providerOf(id: string): string {
  return id.split('/')[0] || '';
}

// Tokens that denote size / flavour variants. They are ignored when comparing
// versions, so e.g. "gpt-4.1" and "gpt-4.1-mini" are treated as the same
// version and both kept if that version is the newest.
const VARIANT_TOKENS = new Set([
  'mini', 'nano', 'pro', 'fast', 'slow', 'lite', 'max', 'large', 'small',
  'base', 'free', 'thinking', 'preview', 'exp', 'experimental', 'beta',
  'chat', 'latest', 'high', 'low', 'turbo', 'it', 'instruct', 'sft', 'rl',
  'flash', 'ultra', 'air', 'xt', 'plus', 'next', 'coder', 'vl',
]);

// id substrings that should never appear in the picker.
const BLACKLIST_PATTERNS: RegExp[] = [
  /^~/i,                                       // provider alias endpoints
  /image/i,                                    // image-generation models
  /audio|music|lyria|tts|voice/i,              // audio / music / speech models
  /-(exp|experimental|preview|beta)\b/i,       // experimental builds
];

// A small fallback used only before the first API fetch, so the picker is not
// empty on first load. Once models are fetched, the blacklist filter takes
// over and this list becomes irrelevant.
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

// Provider + leading alphabetic token(s) of the model name, ignoring the
// first numeric token and any trailing variant tokens.
function familyKey(id: string): string {
  const name = (id.split('/').pop() || id).split(':')[0];
  const tokens = name.split(/[-.]/);
  const base: string[] = [];
  for (const t of tokens) {
    if (/^\d/.test(t)) break;            // stop at the first version number
    if (VARIANT_TOKENS.has(t.toLowerCase())) break;
    base.push(t);
  }
  return `${providerOf(id)}:${base.join('-')}`;
}

// Version as a tuple of integers, ignoring variant tokens.
function versionTuple(id: string): number[] {
  const name = (id.split('/').pop() || id).split(':')[0];
  const nums = name.match(/\d+/g);
  return nums ? nums.map(Number) : [];
}

function compareTuples(a: number[], b: number[]): number {
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) return x - y;
  }
  return 0;
}

function isBlacklisted(id: string): boolean {
  return BLACKLIST_PATTERNS.some((re) => re.test(id));
}

// Keep only the newest major version of each model family from a raw
// OpenRouter response, dropping noise and older releases.
export function filterToBlacklist(fetched: OpenRouterModel[]): OpenRouterModel[] {
  const visible = fetched.filter((m) => m.id && m.name && !isBlacklisted(m.id));

  // Group by family.
  const groups = new Map<string, OpenRouterModel[]>();
  for (const m of visible) {
    const key = familyKey(m.id);
    const arr = groups.get(key);
    if (arr) arr.push(m);
    else groups.set(key, [m]);
  }

  const result: OpenRouterModel[] = [];
  for (const members of groups.values()) {
    if (members.length === 1) {
      result.push(members[0]);
      continue;
    }
    const tuples = members.map((m) => versionTuple(m.id));
    let maxTuple = tuples[0];
    for (const t of tuples.slice(1)) {
      if (compareTuples(t, maxTuple) > 0) maxTuple = t;
    }
    const hasVersioned = tuples.some((t) => t.length > 0);
    members.forEach((m, i) => {
      const t = tuples[i];
      // Keep if it has no version (ambiguous -> never auto-drop) or its
      // version equals the family's maximum.
      if (!hasVersioned || t.length === 0 || compareTuples(t, maxTuple) === 0) {
        result.push(m);
      }
    });
  }

  // Sort by name for a stable, scannable list.
  result.sort((a, b) => a.name.localeCompare(b.name));
  return result;
}
