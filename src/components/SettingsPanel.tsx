import React, { useState, useMemo, useRef, useEffect } from 'react';
import { X, Search, RefreshCw, AlertCircle, Info, ChevronDown } from 'lucide-react';
import type { OpenRouterModel } from '../types/chat';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  selectedModel: string;
  onModelChange: (model: string) => void;
  systemPrompt: string;
  onSystemPromptChange: (prompt: string) => void;
  temperature: number;
  onTemperatureChange: (temp: number) => void;
  maxTokens: number | undefined;
  onMaxTokensChange: (tokens: number | undefined) => void;
  models: OpenRouterModel[];
  isLoadingModels: boolean;
  onRefreshModels: () => void;
  apiKey: string;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  isOpen,
  onClose,
  selectedModel,
  onModelChange,
  systemPrompt,
  onSystemPromptChange,
  temperature,
  onTemperatureChange,
  maxTokens,
  onMaxTokensChange,
  models,
  isLoadingModels,
  onRefreshModels,
  apiKey,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredModels = useMemo(() => {
    if (!searchTerm.trim()) return models;
    const term = searchTerm.toLowerCase();
    return models.filter(
      (m) =>
        m.name.toLowerCase().includes(term) ||
        m.id.toLowerCase().includes(term)
    );
  }, [models, searchTerm]);

  const activeModel = useMemo(() => {
    return models.find((m) => m.id === selectedModel) || {
      id: selectedModel,
      name: selectedModel.split('/').pop() || selectedModel,
      context_length: 0,
      pricing: { prompt: '0', completion: '0' },
    };
  }, [models, selectedModel]);

  const formatPrice = (priceStr: string) => {
    const price = parseFloat(priceStr);
    if (isNaN(price)) return 'N/A';
    // OpenRouter prices are per-token. Let's convert to price per 1M tokens.
    const pricePerMillion = price * 1000000;
    if (pricePerMillion === 0) return 'Free';
    return `$${pricePerMillion.toFixed(2)}`;
  };

  return (
    <>
      <div 
        className={`settings-overlay-backdrop ${isOpen ? 'open' : ''}`}
        onClick={onClose}
      />
      <div className={`settings-overlay ${isOpen ? 'open' : ''}`}>
        <div className="settings-header">
          <h2>Configuration</h2>
          <button className="bubble-action-btn" onClick={onClose} aria-label="Close settings">
            <X size={20} />
          </button>
        </div>

        <div className="settings-body">
          {/* Model Selection */}
          <div className="settings-group">
            <div className="settings-label">
              <span>Model</span>
              {apiKey && (
                <button
                  onClick={onRefreshModels}
                  disabled={isLoadingModels}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--accent-secondary)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.75rem',
                  }}
                >
                  <RefreshCw size={12} className={isLoadingModels ? 'spin-anim' : ''} style={{ animation: isLoadingModels ? 'spin 1.5s linear infinite' : 'none' }} />
                  Reload
                </button>
              )}
            </div>
            
            <div className="model-picker-container" ref={dropdownRef}>
              <div 
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'rgba(0,0,0,0.2)',
                  cursor: 'pointer',
                }}
                onClick={() => setShowDropdown(!showDropdown)}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff' }}>
                    {activeModel.name}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {activeModel.id}
                  </div>
                </div>
                <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} />
              </div>

              {showDropdown && (
                <div className="model-list-dropdown">
                  <div style={{ padding: '8px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Search size={14} style={{ color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      className="model-search-input"
                      placeholder="Search models..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        padding: '4px 0',
                        fontSize: '0.85rem',
                        outline: 'none',
                        width: '100%',
                      }}
                    />
                  </div>

                  <div style={{ overflowY: 'auto', maxHeight: '200px' }}>
                    {filteredModels.length === 0 ? (
                      <div style={{ padding: '12px', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                        No models found
                      </div>
                    ) : (
                      filteredModels.map((m) => (
                        <div
                          key={m.id}
                          className={`model-option ${m.id === selectedModel ? 'selected' : ''}`}
                          onClick={() => {
                            onModelChange(m.id);
                            setShowDropdown(false);
                          }}
                        >
                          <span className="model-option-name">{m.name}</span>
                          <span className="model-option-id">{m.id}</span>
                          <div className="model-option-meta">
                            <span>Context: {(m.context_length / 1024).toFixed(0)}k</span>
                            <span>
                              In: {formatPrice(m.pricing.prompt)} | Out: {formatPrice(m.pricing.completion)} (/1M)
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            {!apiKey && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#eab308', fontSize: '0.75rem', marginTop: '4px' }}>
                <AlertCircle size={12} />
                <span>Enter OpenRouter API Key in Sidebar to reload and fetch custom models.</span>
              </div>
            )}
          </div>

          {/* System Prompt */}
          <div className="settings-group">
            <label className="settings-label">System Prompt</label>
            <textarea
              className="settings-textarea"
              placeholder="You are a helpful, creative assistant..."
              value={systemPrompt}
              onChange={(e) => onSystemPromptChange(e.target.value)}
              rows={4}
            />
            <span className="settings-description">
              Defines the AI's persona, boundaries, and overall response style.
            </span>
          </div>

          {/* Temperature Slider */}
          <div className="settings-group">
            <div className="settings-label">
              <span>Temperature</span>
              <span className="slider-val">{temperature.toFixed(1)}</span>
            </div>
            <div className="slider-container">
              <input
                type="range"
                className="settings-slider"
                min="0.0"
                max="2.0"
                step="0.1"
                value={temperature}
                onChange={(e) => onTemperatureChange(parseFloat(e.target.value))}
              />
            </div>
            <span className="settings-description">
              Controls randomness: lower numbers are focused and deterministic; higher values are creative and random.
            </span>
          </div>

          {/* Max Tokens */}
          <div className="settings-group">
            <div className="settings-label">
              <span>Max Tokens</span>
              <span className="slider-val">{maxTokens || 'Auto'}</span>
            </div>
            <div className="slider-container">
              <input
                type="range"
                className="settings-slider"
                min="0"
                max="8192"
                step="128"
                value={maxTokens || 0}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  onMaxTokensChange(val === 0 ? undefined : val);
                }}
              />
            </div>
            <span className="settings-description">
              Sets the upper limit of tokens to generate. Leave at 0 (Auto) for model defaults.
            </span>
          </div>

          {/* Context Length info */}
          <div 
            style={{
              padding: '12px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'rgba(6, 182, 212, 0.05)',
              border: '1px solid rgba(6, 182, 212, 0.15)',
              display: 'flex',
              gap: '10px',
              fontSize: '0.8rem',
              color: 'var(--text-secondary)',
              lineHeight: '1.4',
              marginTop: '10px',
            }}
          >
            <Info size={16} style={{ flexShrink: 0, color: 'var(--accent-secondary)' }} />
            <div>
              <strong>Context Limit:</strong> This model supports up to {activeModel.context_length.toLocaleString()} tokens of total context (including history & prompt).
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
};
