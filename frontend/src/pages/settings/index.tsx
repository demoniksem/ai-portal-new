'use client';
import React, { useEffect, useState, FormEvent } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { Globe, Robot, Brain, Desktop, Gear, WarningCircle, CheckCircle, Lightbulb, Eye, EyeSlash } from '@phosphor-icons/react';
import styles from '../../styles/AISettings.module.css';

const API = typeof window !== 'undefined'
  ? 'http://' + window.location.hostname + ':8081'
  : '';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

async function api<T = unknown>(
  method: string,
  path: string,
  body?: unknown,
  token?: string | null,
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const opts: RequestInit = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(API + path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || res.statusText);
  return data as T;
}

// Provider config
const PROVIDER_LABELS: Record<string, { icon: React.ReactNode; label: string }> = {
  openrouter: { icon: <Globe size={24} weight="duotone" />, label: 'OpenRouter (Recommended — Free models available)' },
  openai: { icon: <Robot size={24} weight="duotone" />, label: 'OpenAI (GPT-4, GPT-4o)' },
  anthropic: { icon: <Brain size={24} weight="duotone" />, label: 'Anthropic (Claude)' },
  local: { icon: <Desktop size={24} weight="duotone" />, label: 'Local / Custom Endpoint' },
};

const PROVIDER_HINTS: Record<string, string> = {
  openrouter: 'OpenRouter aggregates many AI providers. Free models available. Get key at openrouter.ai',
  openai: 'Official OpenAI API. Requires API key from platform.openai.com',
  anthropic: 'Anthropic Claude models. Requires API key from console.anthropic.com',
  local: 'Connect to a locally running AI model (Ollama, LM Studio, etc.)',
};

const LOCAL_PROVIDER_HINTS: Record<string, string> = {
  openrouter: 'Format: https://openrouter.ai/api/v1/chat/completions',
  openai: 'Format: https://api.openai.com/v1/chat/completions',
  anthropic: 'Format: https://api.anthropic.com/v1/messages',
  local: 'Format: http://localhost:11434/v1/chat/completions (Ollama default)',
};

// Model catalog (mirrors backend AI_PROVIDER_MODELS)
const AI_PROVIDER_MODELS: Record<string, Array<{ id: string; name: string }>> = {
  openrouter: [
    { id: 'qwen/qwen3.6-plus:free', name: 'Qwen 3.6 Plus (Free)' },
    { id: 'google/gemini-2.0-flash-exp:free', name: 'Gemini 2.0 Flash (Free)' },
    { id: 'meta-llama/llama-3.1-8b-instruct:free', name: 'Llama 3.1 8B (Free)' },
    { id: 'anthropic/claude-3.5-haiku:free', name: 'Claude 3.5 Haiku (Free)' },
    { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini' },
    { id: 'anthropic/claude-3-opus', name: 'Claude 3 Opus' },
  ],
  openai: [
    { id: 'gpt-4o', name: 'GPT-4o' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
  ],
  anthropic: [
    { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet' },
    { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' },
    { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku' },
  ],
  local: [
    { id: 'local-model', name: 'Local Model (custom endpoint)' },
  ],
  openclaw: [
    { id: 'openclaw/gateway', name: 'OpenClaw Gateway (HTTP API)' },
  ],
};

// AI Config type (matches /api/admin/ai-config response)
interface AIConfig {
  provider?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  apiBaseUrl?: string | null;
  enabled?: boolean;
  hasApiKey?: boolean;
}

interface AIModel {
  id: string;
  name: string;
}

export default function AISettings() {
  const [settings, setSettings] = useState<AIConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [provider, setProvider] = useState('openrouter');
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [model, setModel] = useState('');
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(4000);
  const [availableModels, setAvailableModels] = useState<AIModel[]>(AI_PROVIDER_MODELS.openrouter);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!getToken()) {
      window.location.href = '/login';
      return;
    }
    void loadSettings();
  }, []);

  async function loadSettings(): Promise<void> {
    try {
      const token = getToken();
      // GET /api/admin/ai-config — company-level AI config
      const data = await api<AIConfig>('GET', '/api/admin/ai-config', undefined, token);
      setSettings(data);
      const cfgProvider = data.provider || 'openrouter';
      setProvider(cfgProvider);
      setModel(data.model || AI_PROVIDER_MODELS[cfgProvider]?.[0]?.id || '');
      setTemperature(data.temperature ?? 0.7);
      setMaxTokens(data.maxTokens ?? 4000);
      setAvailableModels(AI_PROVIDER_MODELS[cfgProvider] || AI_PROVIDER_MODELS.openrouter);
    } catch (e: unknown) {
      setError('Failed to load settings: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setLoading(false);
    }
  }

  function handleProviderChange(newProvider: string): void {
    setProvider(newProvider);
    const models = AI_PROVIDER_MODELS[newProvider] || [];
    setAvailableModels(models);
    setModel(models[0]?.id || '');
    setSaved(false);
  }

  async function handleSave(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError('');
    setSaved(false);
    setSaving(true);
    try {
      const token = getToken();
      // POST /api/admin/ai-config — create or update company-level config
      const data = await api<AIConfig>('POST', '/api/admin/ai-config', {
        provider,
        apiKey: apiKey || undefined,
        model,
        temperature,
        maxTokens,
      }, token);
      setSettings(data);
      setApiKey('');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: unknown) {
      setError('Save failed: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingContent}>
          <div className={styles.loadingIcon}><Gear size={28} weight="duotone" /></div>
          <div className={styles.loadingText}>Loading settings...</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>AI Settings — AI Portal</title>
      </Head>
      <div className={styles.page}>
        <div className={styles.topBar}>
          <Link href="/" className={styles.backLink}>← Back to Portal</Link>
          <span style={{ color: 'var(--color-border)' }}>|</span>
          <span className={styles.pageTitle} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Gear size={16} weight="duotone" />AI Settings</span>
        </div>

        <div className={styles.main}>
          <h1 className={styles.heading}>AI Settings</h1>
          <p className={styles.subheading}>
            Configure your AI provider, model, and generation parameters for the entire company.
          </p>

          {/* Provider Selection */}
          <div className={styles.card}>
            <div className={styles.cardTitle}>
              <span className={styles.stepNum}>1</span>
              AI Provider
            </div>
            <div className={styles.providerGrid}>
              {Object.entries(PROVIDER_LABELS).map(([key, { icon, label }]) => (
                <div
                  key={key}
                  onClick={() => handleProviderChange(key)}
                  className={`${styles.providerCard} ${provider === key ? styles.selected : ''}`}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => { if (e.key === 'Enter') handleProviderChange(key); }}
                  aria-pressed={provider === key}
                >
                  <div className={styles.providerIcon}>{icon}</div>
                  <div className={styles.providerName}>{label}</div>
                  <div className={styles.providerDesc}>{PROVIDER_HINTS[key]}</div>
                </div>
              ))}
            </div>
          </div>

          {/* API Key */}
          <div className={styles.card}>
            <div className={styles.cardTitle}>
              <span className={styles.stepNum}>2</span>
              API Key
            </div>
            <p className={styles.hint}>{PROVIDER_HINTS[provider]}</p>
            <div className={styles.inputWrapper}>
              <input
                type={showApiKey ? 'text' : 'password'}
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder={settings?.hasApiKey ? '•••••••• (already set — enter new value to replace)' : 'Paste your API key here...'}
                className={styles.input}
                aria-label="API key"
              />
              <button
                onClick={() => setShowApiKey(!showApiKey)}
                className={styles.togglePassword}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
              >
                {showApiKey ? <><EyeSlash size={15} weight="duotone" />Hide</> : <><Eye size={15} weight="duotone" />Show</>}
              </button>
            </div>
            {settings?.hasApiKey && !apiKey && (
              <div className={styles.apiKeyStatus}>
                ✓ API key already configured
              </div>
            )}
          </div>

          {/* Model Selection */}
          <div className={styles.card}>
            <div className={styles.cardTitle}>
              <span className={styles.stepNum}>3</span>
              Model
            </div>
            {availableModels.length > 0 ? (
              <select
                value={model}
                onChange={e => { setModel(e.target.value); setSaved(false); }}
                className={styles.modelSelect}
                aria-label="Select model"
              >
                {availableModels.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={model}
                onChange={e => { setModel(e.target.value); setSaved(false); }}
                placeholder="Model identifier (e.g., gpt-4o, claude-3-5-sonnet-20241022)"
                className={styles.input}
                aria-label="Model identifier"
              />
            )}
            <div className={styles.modelHint}>{LOCAL_PROVIDER_HINTS[provider]}</div>
          </div>

          {/* Generation Parameters */}
          <div className={styles.card}>
            <div className={styles.cardTitle}>
              <span className={styles.stepNum}>4</span>
              Generation Parameters
            </div>

            <div className={styles.sliderSection}>
              <div className={styles.sliderLabel}>
                <span>Temperature</span>
                <span className={styles.sliderValue}>{temperature}</span>
              </div>
              <input
                type="range"
                min="0"
                max="2"
                step="0.05"
                value={temperature}
                onChange={e => { setTemperature(parseFloat(e.target.value)); setSaved(false); }}
                className={styles.slider}
                aria-valuemin={0}
                aria-valuemax={2}
                aria-valuenow={temperature}
              />
              <div className={styles.sliderLabels}>
                <span>0 — Precise</span>
                <span>1 — Balanced</span>
                <span>2 — Creative</span>
              </div>
            </div>

            <div className={styles.sliderSection}>
              <div className={styles.sliderLabel}>
                <span>Max Tokens</span>
                <span className={styles.sliderValue}>{maxTokens}</span>
              </div>
              <input
                type="range"
                min="500"
                max="16000"
                step="500"
                value={maxTokens}
                onChange={e => { setMaxTokens(parseInt(e.target.value)); setSaved(false); }}
                className={styles.slider}
                aria-valuemin={500}
                aria-valuemax={16000}
                aria-valuenow={maxTokens}
              />
              <div className={styles.sliderLabels}>
                <span>500 — Short</span>
                <span>8000 — Medium</span>
                <span>16000 — Long</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          {error && (
            <div className={`${styles.alert} ${styles.alertError}`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <WarningCircle size={16} weight="fill" />{error}
            </div>
          )}

          {saved && (
            <div className={`${styles.alert} ${styles.alertSuccess}`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircle size={16} weight="fill" />Settings saved successfully!
            </div>
          )}

          <div className={styles.buttonGroup}>
            <button
              onClick={e => { void handleSave(e); }}
              disabled={saving}
              className={`${styles.btn} ${styles.btnPrimary}`}
            >
              {saving ? 'Saving…' : 'Save Settings'}
            </button>
          </div>

          <div className={styles.tipBox}>
            <div className={styles.tipTitle} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Lightbulb size={15} weight="fill" />Tip</div>
            <div className={styles.tipText}>
              OpenRouter offers free models (marked "Free") that don't require payment.
              For higher rate limits, add credits at <strong>openrouter.ai</strong>.
              Your API key is stored securely in the database and never displayed after saving.
              These settings apply to the entire company.
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
