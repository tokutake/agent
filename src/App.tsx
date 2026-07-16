import { useState, useEffect, useMemo } from 'react';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { SettingsPanel } from './components/SettingsPanel';
import type { ChatSession, Message, OpenRouterModel, ReasoningMode } from './types/chat';
import { fetchModels, streamCompletion } from './services/openrouter';
import { FALLBACK_MODELS, filterToBlacklist } from './lib/models';
import { cleanModelName } from './lib/providers';

const DEFAULT_MODELS: OpenRouterModel[] = FALLBACK_MODELS;

export default function App() {
  // --- LocalStorage State Initialization ---
  const [apiKey, setApiKey] = useState<string>(() => {
    return localStorage.getItem('novachat_apikey') || '';
  });

  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const saved = localStorage.getItem('novachat_sessions');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error parsing saved sessions:', e);
      }
    }
    // Create initial default session
    const initId = Date.now().toString();
    return [
      {
        id: initId,
        title: 'New Chat',
        messages: [],
        model: 'google/gemini-3.5-flash',
        systemPrompt: 'You are Pythia, a helpful and highly creative AI assistant. Provide concise, clear, and comprehensive answers. Format math and code elements beautifully.',
        temperature: 0.7,
        reasoningMode: 'auto',
        createdAt: Date.now(),
      },
    ];
  });

  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => {
    const savedId = localStorage.getItem('novachat_active_id');
    if (savedId) return savedId;
    return localStorage.getItem('novachat_sessions') 
      ? JSON.parse(localStorage.getItem('novachat_sessions')!)[0]?.id || null 
      : null;
  });

  const [models, setModels] = useState<OpenRouterModel[]>(() => {
    const saved = localStorage.getItem('novachat_models');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return DEFAULT_MODELS;
  });

  // --- UI State ---
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // --- Save state changes to LocalStorage ---
  useEffect(() => {
    localStorage.setItem('novachat_apikey', apiKey);
  }, [apiKey]);

  useEffect(() => {
    localStorage.setItem('novachat_sessions', JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    if (activeSessionId) {
      localStorage.setItem('novachat_active_id', activeSessionId);
    } else {
      localStorage.removeItem('novachat_active_id');
    }
  }, [activeSessionId]);

  useEffect(() => {
    localStorage.setItem('novachat_models', JSON.stringify(models));
  }, [models]);

  // --- Load Models from OpenRouter ---
  const handleLoadModels = async (keyToUse = apiKey) => {
    if (!keyToUse.trim()) return;
    setIsLoadingModels(true);
    try {
      const fetched = await fetchModels(keyToUse);
      if (fetched && fetched.length > 0) {
        // Keep only the newest version of each model family (blacklist
        // approach): drop image/audio/experimental models and older
        // releases, but never require a hand-maintained whitelist.
        const filtered = filterToBlacklist(fetched);
        if (filtered.length > 0) {
          setModels(filtered);
        }
      }
    } catch (e) {
      console.error('Failed to fetch models, keeping current list:', e);
    } finally {
      setIsLoadingModels(false);
    }
  };

  // Fetch models once when API key is first available
  useEffect(() => {
    if (apiKey.trim() && models === DEFAULT_MODELS) {
      handleLoadModels();
    }
  }, []);

  const handleApiKeyChange = (newKey: string) => {
    setApiKey(newKey);
    if (newKey.trim()) {
      handleLoadModels(newKey);
    }
  };

  // --- Session Management ---
  const activeSession = useMemo(() => {
    return sessions.find((s) => s.id === activeSessionId) || null;
  }, [sessions, activeSessionId]);

  const activeModelName = useMemo(() => {
    if (!activeSession) return 'None';
    const found = models.find((m) => m.id === activeSession.model);
    return found ? cleanModelName(found.name) : activeSession.model.split('/').pop() || activeSession.model;
  }, [activeSession, models]);

  const handleSelectSession = (id: string) => {
    setActiveSessionId(id);
  };

  const handleNewSession = () => {
    const newId = Date.now().toString();
    const newSession: ChatSession = {
      id: newId,
      title: 'New Chat',
      messages: [],
      model: activeSession?.model || 'google/gemini-3.5-flash',
      systemPrompt: activeSession?.systemPrompt || 'You are Pythia, a helpful and highly creative AI assistant. Provide concise, clear, and comprehensive answers. Format math and code elements beautifully.',
      temperature: activeSession?.temperature ?? 0.7,
      reasoningMode: activeSession?.reasoningMode || 'auto',
      createdAt: Date.now(),
    };
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newId);
  };

  const handleDeleteSession = (id: string) => {
    setSessions((prev) => {
      const filtered = prev.filter((s) => s.id !== id);
      if (filtered.length === 0) {
        const fallbackId = Date.now().toString();
        return [
          {
            id: fallbackId,
            title: 'New Chat',
            messages: [],
            model: 'google/gemini-3.5-flash',
            systemPrompt: 'You are Pythia, a helpful and highly creative AI assistant.',
            temperature: 0.7,
            reasoningMode: 'auto',
            createdAt: Date.now(),
          },
        ];
      }
      return filtered;
    });

    if (activeSessionId === id) {
      // Switch active session to the first available
      const remaining = sessions.filter((s) => s.id !== id);
      if (remaining.length > 0) {
        setActiveSessionId(remaining[0].id);
      }
    }
  };

  const handleRenameSession = (id: string, newTitle: string) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, title: newTitle } : s))
    );
  };

  // --- Session Config Setters ---
  const handleModelChange = (model: string) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === activeSessionId ? { ...s, model } : s))
    );
  };

  const handleSystemPromptChange = (systemPrompt: string) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === activeSessionId ? { ...s, systemPrompt } : s))
    );
  };

  const handleTemperatureChange = (temperature: number) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === activeSessionId ? { ...s, temperature } : s))
    );
  };

  const handleMaxTokensChange = (maxTokens: number | undefined) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === activeSessionId ? { ...s, maxTokens } : s))
    );
  };

  const handleReasoningChange = (reasoningMode: ReasoningMode) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === activeSessionId ? { ...s, reasoningMode } : s))
    );
  };

  // --- Messaging Operations ---
  const handleSendMessage = async (content: string) => {
    if (!activeSession || !apiKey.trim() || isStreaming) return;

    // Create user message
    const userMessage: Message = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      role: 'user',
      content,
      timestamp: Date.now(),
    };

    // Assistant placeholder
    const assistantMessageId = `msg-${Date.now() + 1}-${Math.random().toString(36).substr(2, 9)}`;
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: Date.now() + 1,
      model: activeSession.model,
    };

    // Update session state locally (appending user message and placeholder)
    let updatedMessages = [...activeSession.messages, userMessage];
    
    // Auto-rename chat if it is still named 'New Chat'
    let updatedTitle = activeSession.title;
    if (activeSession.title === 'New Chat' && activeSession.messages.length === 0) {
      updatedTitle = content.length > 25 ? `${content.slice(0, 25)}...` : content;
    }

    setSessions((prev) =>
      prev.map((s) =>
        s.id === activeSession.id
          ? {
              ...s,
              title: updatedTitle,
              messages: [...updatedMessages, assistantMessage],
            }
          : s
      )
    );

    setIsStreaming(true);

    // Call OpenRouter stream
    await streamCompletion({
      apiKey,
      model: activeSession.model,
      messages: updatedMessages,
      systemPrompt: activeSession.systemPrompt,
      temperature: activeSession.temperature,
      maxTokens: activeSession.maxTokens,
      reasoningMode: activeSession.reasoningMode,
      onReasoning: (chunk) => {
        setSessions((prev) =>
          prev.map((s) => {
            if (s.id !== activeSession.id) return s;
            return {
              ...s,
              messages: s.messages.map((m) =>
                m.id === assistantMessageId ? { ...m, reasoning: (m.reasoning || '') + chunk } : m
              ),
            };
          })
        );
      },
      onChunk: (chunk) => {
        setSessions((prev) =>
          prev.map((s) => {
            if (s.id !== activeSession.id) return s;
            return {
              ...s,
              messages: s.messages.map((m) =>
                m.id === assistantMessageId ? { ...m, content: m.content + chunk } : m
              ),
            };
          })
        );
      },
      onDone: () => {
        setIsStreaming(false);
      },
      onError: (error) => {
        console.error('Streaming error:', error);
        setSessions((prev) =>
          prev.map((s) => {
            if (s.id !== activeSession.id) return s;
            return {
              ...s,
              messages: s.messages.map((m) =>
                m.id === assistantMessageId
                  ? {
                      ...m,
                      content:
                        m.content +
                        `\n\n*(Error: ${error.message || 'An error occurred during generation. Please verify your API Key.'})*`,
                    }
                  : m
              ),
            };
          })
        );
        setIsStreaming(false);
      },
    });
  };

  const handleRegenerateMessage = async (lastUserMsgId: string) => {
    if (!activeSession || !apiKey.trim() || isStreaming) return;

    // Find the message index
    const userMsgIndex = activeSession.messages.findIndex((m) => m.id === lastUserMsgId);
    if (userMsgIndex === -1) return;

    // Truncate session history after the user message, and setup a fresh assistant message
    const messagesHistory = activeSession.messages.slice(0, userMsgIndex + 1);
    
    const assistantMessageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      model: activeSession.model,
    };

    setSessions((prev) =>
      prev.map((s) =>
        s.id === activeSession.id
          ? {
              ...s,
              messages: [...messagesHistory, assistantMessage],
            }
          : s
      )
    );

    setIsStreaming(true);

    await streamCompletion({
      apiKey,
      model: activeSession.model,
      messages: messagesHistory,
      systemPrompt: activeSession.systemPrompt,
      temperature: activeSession.temperature,
      maxTokens: activeSession.maxTokens,
      reasoningMode: activeSession.reasoningMode,
      onReasoning: (chunk) => {
        setSessions((prev) =>
          prev.map((s) => {
            if (s.id !== activeSession.id) return s;
            return {
              ...s,
              messages: s.messages.map((m) =>
                m.id === assistantMessageId ? { ...m, reasoning: (m.reasoning || '') + chunk } : m
              ),
            };
          })
        );
      },
      onChunk: (chunk) => {
        setSessions((prev) =>
          prev.map((s) => {
            if (s.id !== activeSession.id) return s;
            return {
              ...s,
              messages: s.messages.map((m) =>
                m.id === assistantMessageId ? { ...m, content: m.content + chunk } : m
              ),
            };
          })
        );
      },
      onDone: () => {
        setIsStreaming(false);
      },
      onError: (error) => {
        setSessions((prev) =>
          prev.map((s) => {
            if (s.id !== activeSession.id) return s;
            return {
              ...s,
              messages: s.messages.map((m) =>
                m.id === assistantMessageId
                  ? {
                      ...m,
                      content:
                        m.content +
                        `\n\n*(Error: ${error.message || 'An error occurred during generation. Please verify your API Key.'})*`,
                    }
                  : m
              ),
            };
          })
        );
        setIsStreaming(false);
      },
    });
  };

  const handleEditMessage = async (msgId: string, newContent: string) => {
    if (!activeSession || !apiKey.trim() || isStreaming) return;

    // Find the message index
    const msgIndex = activeSession.messages.findIndex((m) => m.id === msgId);
    if (msgIndex === -1) return;

    // Update the message content
    const updatedUserMsg = { ...activeSession.messages[msgIndex], content: newContent };
    
    // Slice everything up to this user message
    const messagesHistory = [...activeSession.messages.slice(0, msgIndex), updatedUserMsg];

    // Assistant placeholder
    const assistantMessageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      model: activeSession.model,
    };

    setSessions((prev) =>
      prev.map((s) =>
        s.id === activeSession.id
          ? {
              ...s,
              messages: [...messagesHistory, assistantMessage],
            }
          : s
      )
    );

    setIsStreaming(true);

    await streamCompletion({
      apiKey,
      model: activeSession.model,
      messages: messagesHistory,
      systemPrompt: activeSession.systemPrompt,
      temperature: activeSession.temperature,
      maxTokens: activeSession.maxTokens,
      reasoningMode: activeSession.reasoningMode,
      onReasoning: (chunk) => {
        setSessions((prev) =>
          prev.map((s) => {
            if (s.id !== activeSession.id) return s;
            return {
              ...s,
              messages: s.messages.map((m) =>
                m.id === assistantMessageId ? { ...m, reasoning: (m.reasoning || '') + chunk } : m
              ),
            };
          })
        );
      },
      onChunk: (chunk) => {
        setSessions((prev) =>
          prev.map((s) => {
            if (s.id !== activeSession.id) return s;
            return {
              ...s,
              messages: s.messages.map((m) =>
                m.id === assistantMessageId ? { ...m, content: m.content + chunk } : m
              ),
            };
          })
        );
      },
      onDone: () => {
        setIsStreaming(false);
      },
      onError: (error) => {
        setSessions((prev) =>
          prev.map((s) => {
            if (s.id !== activeSession.id) return s;
            return {
              ...s,
              messages: s.messages.map((m) =>
                m.id === assistantMessageId
                  ? {
                      ...m,
                      content:
                        m.content +
                        `\n\n*(Error: ${error.message || 'An error occurred during generation. Please verify your API Key.'})*`,
                    }
                  : m
              ),
            };
          })
        );
        setIsStreaming(false);
      },
    });
  };

  return (
    <div className="app-container">
      <Sidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={handleSelectSession}
        onNewSession={handleNewSession}
        onDeleteSession={handleDeleteSession}
        onRenameSession={handleRenameSession}
        apiKey={apiKey}
        onApiKeyChange={handleApiKeyChange}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      
      <ChatArea
        session={activeSession}
        onSendMessage={handleSendMessage}
        onRegenerateMessage={handleRegenerateMessage}
        onEditMessage={handleEditMessage}
        isStreaming={isStreaming}
        activeModelName={activeModelName}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenMenu={() => setSidebarOpen(true)}
        apiKey={apiKey}
      />

      <SettingsPanel
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        selectedModel={activeSession?.model || 'google/gemini-3.5-flash'}
        onModelChange={handleModelChange}
        systemPrompt={activeSession?.systemPrompt || ''}
        onSystemPromptChange={handleSystemPromptChange}
        temperature={activeSession?.temperature ?? 0.7}
        onTemperatureChange={handleTemperatureChange}
        maxTokens={activeSession?.maxTokens}
        onMaxTokensChange={handleMaxTokensChange}
        reasoningMode={activeSession?.reasoningMode || 'auto'}
        onReasoningChange={handleReasoningChange}
        models={models}
        isLoadingModels={isLoadingModels}
        onRefreshModels={() => handleLoadModels()}
        apiKey={apiKey}
      />
    </div>
  );
}
