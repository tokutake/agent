import type { Message, OpenRouterModel, ReasoningMode } from '../types/chat';

const BASE_URL = 'https://openrouter.ai/api/v1';

export async function fetchModels(apiKey: string): Promise<OpenRouterModel[]> {
  try {
    const response = await fetch(`${BASE_URL}/models`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Premium AI Chat',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData?.error?.message || `Failed to fetch models: ${response.statusText}`);
    }

    const data = await response.json();
    // OpenRouter returns list of models in data.data
    return data.data || [];
  } catch (error) {
    console.error('Error fetching models from OpenRouter:', error);
    throw error;
  }
}

interface StreamOptions {
  apiKey: string;
  model: string;
  messages: Message[];
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  reasoningMode?: ReasoningMode;
  webSearch?: boolean;
  onChunk: (content: string) => void;
  onReasoning?: (reasoning: string) => void;
  onDone: (info?: { finishReason?: string | null }) => void;
  onError: (error: Error) => void;
}

/**
 * Dispatch a parsed SSE payload: stream reasoning/content chunks, and surface
 * any `error` event from OpenRouter. Free-model rate limits (and other
 * mid-stream failures) arrive as a `choices`-less `data: {"error": {...}}`
 * event rather than an HTTP error — without handling this, the UI hangs on
 * "streaming" forever because neither onDone nor onError ever fires.
 *
 * Returns false when an error was surfaced, signalling the caller to stop.
 */
function dispatchPayload(
  data: any,
  callbacks: {
    onChunk: (content: string) => void;
    onReasoning?: (reasoning: string) => void;
    onError: (error: Error) => void;
  }
): boolean {
  if (data?.error) {
    const raw = data.error;
    const message =
      (raw && raw.message) || (typeof raw === 'string' ? raw : 'Unknown API error');
    callbacks.onError(new Error(message));
    return false;
  }
  const reasoning = data?.choices?.[0]?.delta?.reasoning || '';
  if (reasoning && callbacks.onReasoning) {
    callbacks.onReasoning(reasoning);
  }
  const content = data?.choices?.[0]?.delta?.content || '';
  if (content) {
    callbacks.onChunk(content);
  }
  return true;
}

/**
 * Build the OpenRouter `reasoning` request param from a ReasoningMode.
 * Returns undefined for 'auto' (omit the param so the model decides).
 */
function buildReasoningParam(mode: ReasoningMode = 'auto'): Record<string, unknown> | undefined {
  switch (mode) {
    case 'off':
      return { reasoning: { exclude: true } };
    case 'auto':
      return undefined;
    case 'low':
    case 'medium':
    case 'high':
    case 'max':
      return { reasoning: { effort: mode } };
    default:
      return undefined;
  }
}

export async function streamCompletion({
  apiKey,
  model,
  messages,
  systemPrompt,
  temperature = 0.7,
  maxTokens,
  reasoningMode = 'auto',
  webSearch = false,
  onChunk,
  onReasoning,
  onDone,
  onError,
}: StreamOptions) {
  try {
    const formattedMessages = [];

    // Add system prompt first if available
    if (systemPrompt && systemPrompt.trim()) {
      formattedMessages.push({
        role: 'system',
        content: systemPrompt,
      });
    }

    // Map messages to API format
    formattedMessages.push(
      ...messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }))
    );

    // Build the request body, adding the normalized `reasoning` param when set.
    // When no explicit max_tokens is set, default to a generous cap. This model
    // family (reasoning models) can emit very long answers on hard prompts, so a
    // small cap like 4096 silently truncates the reply at the token limit.
    const reasoningParam = buildReasoningParam(reasoningMode);
    const safeMaxTokens = maxTokens && maxTokens > 0 ? maxTokens : 16384;
    const requestBody: Record<string, unknown> = {
      model,
      messages: formattedMessages,
      temperature,
      max_tokens: safeMaxTokens,
      stream: true,
    };
    if (reasoningParam) {
      Object.assign(requestBody, reasoningParam);
    }
    // OpenRouter's built-in Web Search plugin: the model fetches live results
    // and weaves them into the reply. No extra API key or provider needed.
    if (webSearch) {
      requestBody.plugins = [{ id: 'web' }];
    }

    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Premium AI Chat',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData?.error?.message || `API error: ${response.status} ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Response body is not readable');
    }

    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let finishReason: string | null = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');

      // Keep the last partial line in the buffer
      buffer = lines.pop() || '';

      for (const line of lines) {
        const cleanedLine = line.trim();
        if (!cleanedLine) continue;

        if (cleanedLine === 'data: [DONE]') {
          onDone({ finishReason });
          return;
        }

        if (cleanedLine.startsWith('data: ')) {
          try {
            const jsonStr = cleanedLine.slice(6);
            if (jsonStr === '[DONE]') {
              onDone({ finishReason });
              return;
            }
            const data = JSON.parse(jsonStr);
            // Track the latest finish_reason so we can report truncation.
            const fr = data?.choices?.[0]?.finish_reason;
            if (fr) finishReason = fr;
            if (!dispatchPayload(data, { onChunk, onReasoning, onError })) {
              onDone({ finishReason });
              return;
            }
          } catch (e) {
            console.warn('Failed to parse SSE JSON line:', cleanedLine, e);
          }
        }
      }
    }

    // Flush any remaining buffer contents
    if (buffer && buffer.startsWith('data: ')) {
      try {
        const jsonStr = buffer.slice(6).trim();
        if (jsonStr !== '[DONE]') {
          const data = JSON.parse(jsonStr);
          const fr = data?.choices?.[0]?.finish_reason;
          if (fr) finishReason = fr;
          dispatchPayload(data, { onChunk, onReasoning, onError });
        }
      } catch (e) {
        console.warn('Failed to parse remaining buffer:', buffer, e);
      }
    }

    onDone({ finishReason });
  } catch (error) {
    console.error('Error during streaming:', error);
    onError(error instanceof Error ? error : new Error(String(error)));
  }
}
