// Reasoning mode for OpenRouter reasoning models.
// 'auto' = omit the param (model decides); 'off' = exclude thinking entirely;
// others map to the `reasoning.effort` request param.
export type ReasoningMode = 'auto' | 'off' | 'low' | 'medium' | 'high' | 'max';

export const REASONING_MODES: { value: ReasoningMode; label: string }[] = [
  { value: 'auto', label: 'Auto (model decides)' },
  { value: 'off', label: 'Off' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'max', label: 'Max' },
];

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  model?: string;
  reasoning?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  model: string;
  systemPrompt: string;
  temperature: number;
  maxTokens?: number;
  reasoningMode: ReasoningMode;
  webSearch: boolean;
  createdAt: number;
}

export interface OpenRouterModel {
  id: string;
  name: string;
  description?: string;
  context_length: number;
  created?: number;
  pricing: {
    prompt: string;
    completion: string;
  };
}
