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
  onChunk: (content: string) => void;
  onReasoning?: (reasoning: string) => void;
  onDone: () => void;
  onError: (error: Error) => void;
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
    const requestBody: Record<string, unknown> = {
      model,
      messages: formattedMessages,
      temperature,
      max_tokens: maxTokens,
      stream: true,
    };
    const reasoningParam = buildReasoningParam(reasoningMode);
    if (reasoningParam) {
      Object.assign(requestBody, reasoningParam);
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
          onDone();
          return;
        }

        if (cleanedLine.startsWith('data: ')) {
          try {
            const jsonStr = cleanedLine.slice(6);
            if (jsonStr === '[DONE]') {
              onDone();
              return;
            }
            const data = JSON.parse(jsonStr);
            const reasoning = data.choices?.[0]?.delta?.reasoning || '';
            if (reasoning && onReasoning) {
              onReasoning(reasoning);
            }
            const content = data.choices?.[0]?.delta?.content || '';
            if (content) {
              onChunk(content);
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
          const reasoning = data.choices?.[0]?.delta?.reasoning || '';
          if (reasoning && onReasoning) {
            onReasoning(reasoning);
          }
          const content = data.choices?.[0]?.delta?.content || '';
          if (content) {
            onChunk(content);
          }
        }
      } catch (e) {
        console.warn('Failed to parse remaining buffer:', buffer, e);
      }
    }

    onDone();
  } catch (error) {
    console.error('Error during streaming:', error);
    onError(error instanceof Error ? error : new Error(String(error)));
  }
}
