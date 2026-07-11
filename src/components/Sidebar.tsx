import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Plus, Trash2, Edit3, Eye, EyeOff, Bird, X } from 'lucide-react';
import type { ChatSession } from '../types/chat';

interface SidebarProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onDeleteSession: (id: string) => void;
  onRenameSession: (id: string, newTitle: string) => void;
  apiKey: string;
  onApiKeyChange: (key: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  onRenameSession,
  apiKey,
  onApiKeyChange,
  isOpen,
  onClose,
}) => {
  const [showKey, setShowKey] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editVal, setEditVal] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const startEditing = (e: React.MouseEvent, session: ChatSession) => {
    e.stopPropagation();
    setEditingId(session.id);
    setEditVal(session.title);
  };

  const saveRename = (id: string) => {
    if (editVal.trim()) {
      onRenameSession(id, editVal.trim());
    }
    setEditingId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter') {
      saveRename(id);
    } else if (e.key === 'Escape') {
      setEditingId(null);
    }
  };

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-header">
        <div className="brand">
          <Bird size={20} className="brand-icon" />
          <span>Pythia</span>
        </div>
        <button 
          className="menu-toggle" 
          onClick={onClose} 
          style={{ display: isOpen ? 'block' : 'none' }}
          aria-label="Close menu"
        >
          <X size={20} />
        </button>
      </div>

      <button className="new-chat-btn" onClick={() => { onNewSession(); onClose(); }}>
        <Plus size={18} />
        New Chat
      </button>

      <div className="sessions-list">
        {sessions.map((session) => (
          <div
            key={session.id}
            className={`session-item ${session.id === activeSessionId ? 'active' : ''}`}
            onClick={() => {
              onSelectSession(session.id);
              onClose();
            }}
          >
            <div className="session-info">
              <MessageSquare size={16} style={{ flexShrink: 0, color: session.id === activeSessionId ? '#f5c869' : 'var(--text-muted)' }} />
              {editingId === session.id ? (
                <input
                  ref={editInputRef}
                  type="text"
                  className="session-rename-input"
                  value={editVal}
                  onChange={(e) => setEditVal(e.target.value)}
                  onBlur={() => saveRename(session.id)}
                  onKeyDown={(e) => handleKeyDown(e, session.id)}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid var(--accent-primary)',
                    borderRadius: '4px',
                    color: '#fff',
                    padding: '2px 6px',
                    fontSize: '0.9rem',
                    width: '100%',
                    outline: 'none',
                  }}
                />
              ) : (
                <span className="session-title">{session.title}</span>
              )}
            </div>

            {editingId !== session.id && (
              <div className="session-actions">
                <button
                  className="session-action-btn"
                  onClick={(e) => startEditing(e, session)}
                  title="Rename chat"
                >
                  <Edit3 size={13} />
                </button>
                <button
                  className="session-action-btn delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteSession(session.id);
                  }}
                  title="Delete chat"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="sidebar-footer">
        <div className="api-key-container">
          <label className="api-key-label">OpenRouter API Key</label>
          <div className="api-key-input-wrapper">
            <input
              type={showKey ? 'text' : 'password'}
              className="api-key-input"
              placeholder="sk-or-..."
              value={apiKey}
              onChange={(e) => onApiKeyChange(e.target.value)}
            />
            <button
              className="api-key-toggle-btn"
              onClick={() => setShowKey(!showKey)}
              title={showKey ? 'Hide key' : 'Show key'}
            >
              {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
