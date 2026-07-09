import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, User, Bot, Sparkles, Menu, Settings2, 
  Copy, Check, Edit2, RotateCw, ArrowDown, ArrowUpRight, AlertTriangle 
} from 'lucide-react';
import type { ChatSession, Message } from '../types/chat';
import { Markdown } from './Markdown';

interface ChatAreaProps {
  session: ChatSession | null;
  onSendMessage: (content: string) => void;
  onRegenerateMessage: (msgId: string) => void;
  onEditMessage: (msgId: string, newContent: string) => void;
  isStreaming: boolean;
  activeModelName: string;
  onOpenSettings: () => void;
  onOpenMenu: () => void;
  apiKey: string;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  session,
  onSendMessage,
  onRegenerateMessage,
  onEditMessage,
  isStreaming,
  activeModelName,
  onOpenSettings,
  onOpenMenu,
  apiKey,
}) => {
  const [inputText, setInputText] = useState('');
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize input textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [inputText]);

  // Scroll to bottom helper
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  // Scroll on session change or new messages (only if close to bottom)
  useEffect(() => {
    if (!isStreaming) {
      scrollToBottom('auto');
    } else {
      scrollToBottom('smooth');
    }
  }, [session?.messages.length, isStreaming]);

  // Handle scroll to toggle the bottom arrow button
  const handleScroll = () => {
    if (viewportRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = viewportRef.current;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 200;
      setShowScrollBtn(!isNearBottom && scrollHeight > clientHeight);
    }
  };

  const handleSend = () => {
    if (!inputText.trim() || isStreaming || !apiKey) return;
    onSendMessage(inputText.trim());
    setInputText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  const handleStartEdit = (msg: Message) => {
    setEditingMsgId(msg.id);
    setEditingText(msg.content);
  };

  const handleSaveEdit = (id: string) => {
    if (editingText.trim()) {
      onEditMessage(id, editingText.trim());
    }
    setEditingMsgId(null);
  };

  const handleEditKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSaveEdit(id);
    } else if (e.key === 'Escape') {
      setEditingMsgId(null);
    }
  };

  const suggestions = [
    { title: 'Create React Component', text: 'Write a modern React counter component using Hooks and CSS modules.' },
    { title: 'Explain Quantum Computing', text: 'Explain how a quantum computer works in simple terms for a 10-year old.' },
    { title: 'Optimize Code Performance', text: 'Here is a JavaScript loop. Suggest how to optimize it for speed: \n```js\nfor(let i=0; i<arr.length; i++) { ... }\n```' },
    { title: 'Draft an Email Pitch', text: 'Write a persuasive email pitch to a potential client for web development services.' },
  ];

  const hasMessages = session && session.messages.length > 0;

  return (
    <main className="main-chat-container">
      {/* Header */}
      <header className="chat-header">
        <div className="header-meta">
          <button className="menu-toggle" onClick={onOpenMenu} aria-label="Open menu">
            <Menu size={20} />
          </button>
          <div>
            <h1 className="chat-header-title">{session?.title || 'Nova Chat'}</h1>
            {hasMessages && (
              <span className="active-model-badge">{activeModelName}</span>
            )}
          </div>
        </div>

        <div className="header-actions">
          <button className="header-btn" onClick={onOpenSettings} title="Settings">
            <Settings2 size={16} />
            <span>Config</span>
          </button>
        </div>
      </header>

      {/* Messages viewport */}
      <div 
        className="messages-viewport" 
        ref={viewportRef} 
        onScroll={handleScroll}
      >
        {!hasMessages ? (
          <div className="welcome-screen">
            <div className="welcome-logo">
              <Sparkles size={36} />
            </div>
            <h1>Nova AI Chat</h1>
            <p>
              An elegant, fully customized interface built for seamless interaction. Connect to open models on OpenRouter.
            </p>

            {!apiKey && (
              <div 
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '12px 18px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'rgba(234, 179, 8, 0.08)',
                  border: '1px solid rgba(234, 179, 8, 0.25)',
                  color: '#fbbf24',
                  fontSize: '0.85rem',
                  maxWidth: '500px',
                  margin: '10px 0',
                }}
              >
                <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                <span>To get started, please paste your OpenRouter API key into the input field at the bottom left.</span>
              </div>
            )}

            <div className="welcome-suggestions">
              {suggestions.map((s, idx) => (
                <button
                  key={idx}
                  className="suggestion-card"
                  onClick={() => {
                    if (apiKey) {
                      onSendMessage(s.text);
                    } else {
                      setInputText(s.text);
                    }
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3>{s.title}</h3>
                    <ArrowUpRight size={14} style={{ color: 'var(--text-muted)' }} />
                  </div>
                  <p>{s.text.slice(0, 75)}...</p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          session.messages.map((msg, index) => {
            const isUser = msg.role === 'user';
            return (
              <div key={msg.id} className={`message-wrapper ${isUser ? 'user' : 'assistant'}`}>
                <div className="message-meta-top">
                  {isUser ? (
                    <>
                      <span>You</span>
                      <User size={12} style={{ color: 'var(--text-muted)' }} />
                    </>
                  ) : (
                    <>
                      <Bot size={12} style={{ color: 'var(--accent-secondary)' }} />
                      <span>{msg.model?.split('/').pop() || 'Assistant'}</span>
                    </>
                  )}
                  <span>•</span>
                  <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>

                <div className="message-bubble">
                  {editingMsgId === msg.id ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', minWidth: '250px' }}>
                      <textarea
                        className="settings-textarea"
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        onKeyDown={(e) => handleEditKeyDown(e, msg.id)}
                        rows={3}
                        style={{ width: '100%', padding: '8px', fontSize: '0.9rem', color: '#fff' }}
                      />
                      <div style={{ display: 'flex', gap: '6px', alignSelf: 'flex-end' }}>
                        <button 
                          className="header-btn" 
                          style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                          onClick={() => setEditingMsgId(null)}
                        >
                          Cancel
                        </button>
                        <button 
                          className="new-chat-btn" 
                          style={{ padding: '4px 10px', fontSize: '0.75rem', margin: 0 }}
                          onClick={() => handleSaveEdit(msg.id)}
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <Markdown content={msg.content} />
                      {/* Streaming cursor if it is the last message and is streaming */}
                      {!isUser && isStreaming && index === session.messages.length - 1 && (
                        <span className="streaming-cursor" />
                      )}
                    </>
                  )}

                  {/* Actions on hover */}
                  {editingMsgId !== msg.id && (
                    <div className="message-actions-hover">
                      <button
                        className="bubble-action-btn"
                        onClick={() => handleCopy(msg.id, msg.content)}
                        title="Copy message"
                      >
                        {copiedId === msg.id ? <Check size={13} style={{ color: '#22c55e' }} /> : <Copy size={13} />}
                      </button>
                      {isUser ? (
                        <button
                          className="bubble-action-btn"
                          onClick={() => handleStartEdit(msg)}
                          title="Edit message"
                        >
                          <Edit2 size={13} />
                        </button>
                      ) : (
                        <button
                          className="bubble-action-btn"
                          onClick={() => onRegenerateMessage(session.messages[index - 1]?.id)}
                          title="Regenerate response"
                          disabled={isStreaming}
                        >
                          <RotateCw size={13} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Floating scroll to bottom button */}
      {showScrollBtn && (
        <button
          onClick={() => scrollToBottom('smooth')}
          style={{
            position: 'absolute',
            bottom: '100px',
            right: '24px',
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-primary)',
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 99,
            transition: 'opacity var(--transition-fast), transform var(--transition-fast)',
          }}
          title="Scroll to bottom"
        >
          <ArrowDown size={16} />
        </button>
      )}

      {/* Input area */}
      <div className="input-area-container">
        <div className="input-bar-wrapper">
          <textarea
            ref={textareaRef}
            className="input-textarea"
            placeholder={apiKey ? "Message Nova..." : "Please enter your OpenRouter API key to start chatting..."}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!apiKey || isStreaming}
            rows={1}
          />
          <button
            className="send-message-btn"
            onClick={handleSend}
            disabled={!inputText.trim() || isStreaming || !apiKey}
            aria-label="Send message"
          >
            <Send size={16} />
          </button>
          
          <div className="input-footer-settings">
            <span 
              className="input-model-selector-trigger" 
              onClick={onOpenSettings}
            >
              Active: {activeModelName}
            </span>
            <span>Press Enter to send, Shift+Enter for newline</span>
          </div>
        </div>
      </div>
    </main>
  );
};
