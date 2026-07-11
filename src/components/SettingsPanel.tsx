import React, { useState, useMemo } from 'react';
import { X, RefreshCw, AlertCircle, Info } from 'lucide-react';
import type { OpenRouterModel } from '../types/chat';
import { getProviderName, PROVIDER_ORDER, cleanModelName } from '../lib/providers';

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
  // Companies (providers) present in the model list, in display order.
  const groupedProviders = useMemo(() => {
    const groups = new Map<string, OpenRouterModel[]>();
    for (const m of models) {
      const provider = getProviderName(m.id);
      const arr = groups.get(provider);
      if (arr) arr.push(m);
      else groups.set(provider, [m]);
    }
    const names = Array.from(groups.keys()).sort((a, b) => {
      const ia = PROVIDER_ORDER.indexOf(a);
      const ib = PROVIDER_ORDER.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
    return names.map((name) => ({
      name,
      models: groups
        .get(name)!
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name)),
    }));
  }, [models]);

  // Initially select the company of the active model (fallback: first one).
  const [selectedProvider, setSelectedProvider] = useState<string>(() => {
    const initial = models.find((m) => m.id === selectedModel);
    const name = initial ? getProviderName(initial.id) : groupedProviders[0]?.name ?? '';
    // Ensure the company actually exists in the list; otherwise pick the first.
    return groupedProviders.some((g) => g.name === name) ? name : (groupedProviders[0]?.name ?? '');
  });

  // Models for the currently selected company.
  const modelsForProvider = useMemo(() => {
    const group = groupedProviders.find((g) => g.name === selectedProvider);
    return group ? group.models : [];
  }, [groupedProviders, selectedProvider]);
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
            
            <div className="model-picker-container">
              {/* Company (provider) selector */}
              <label className="model-select-label" htmlFor="provider-select">Company</label>
              <select
                id="provider-select"
                className="model-select"
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value)}
              >
                {groupedProviders.map((g) => (
                  <option key={g.name} value={g.name}>
                    {g.name} ({g.models.length})
                  </option>
                ))}
              </select>

              {/* Model selector for the chosen company */}
              <label className="model-select-label" htmlFor="model-select">Model</label>
              <select
                id="model-select"
                className="model-select"
                value={selectedModel}
                onChange={(e) => onModelChange(e.target.value)}
              >
                {modelsForProvider.length === 0 ? (
                  <option value="" disabled>No models found</option>
                ) : (
                  modelsForProvider.map((m) => (
                    <option key={m.id} value={m.id}>
                      {cleanModelName(m.name)} — In: {formatPrice(m.pricing.prompt)} / Out: {formatPrice(m.pricing.completion)}
                    </option>
                  ))
                )}
              </select>

              <div className="model-current-meta">
                <span className="model-option-id">{activeModel.id}</span>
                <div className="model-option-meta">
                  <span>Context: {(activeModel.context_length / 1024).toFixed(0)}k</span>
                  <span>
                    In: {formatPrice(activeModel.pricing.prompt)} | Out: {formatPrice(activeModel.pricing.completion)} (/1M)
                  </span>
                </div>
              </div>
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
              backgroundColor: 'rgba(245, 200, 105, 0.05)',
              border: '1px solid rgba(245, 200, 105, 0.15)',
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
