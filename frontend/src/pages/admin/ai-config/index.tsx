'use client';
import React, { useState, useEffect } from 'react';
import AdminLayout from '../../../components/admin/AdminLayout';
import { getAiConfig, updateAiConfig, resetAiConfig, AiConfig } from '../../../lib/admin-api';
import styles from '../../../styles/admin.module.css';

const PROVIDERS = [
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'ollama', label: 'Ollama' },
  { value: 'custom', label: 'Custom (compatible)' },
];

const MODEL_SUGGESTIONS: Record<string, string[]> = {
  openrouter: ['qwen/qwen3.6-plus:free', 'anthropic/claude-sonnet-4', 'openai/gpt-4o'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
  anthropic: ['claude-sonnet-4', 'claude-3-5-sonnet-20241022', 'claude-3-opus-20240229'],
  ollama: ['llama3.2', 'qwen2.5', 'mistral'],
  custom: [],
};

export default function AiConfigPage() {
  const [config, setConfig] = useState<AiConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const [provider, setProvider] = useState('openrouter');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(4000);
  const [apiBaseUrl, setApiBaseUrl] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [showApiKey, setShowApiKey] = useState(false);

  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  async function loadConfig() {
    setLoading(true);
    setError('');
    try {
      const data = await getAiConfig();
      setConfig(data);
      setProvider(data.provider || 'openrouter');
      setModel(data.model || '');
      setTemperature(data.temperature ?? 0.7);
      setMaxTokens(data.maxTokens ?? 4000);
      setApiBaseUrl(data.apiBaseUrl || '');
      setEnabled(data.enabled !== false);
      // Don't pre-fill apiKey — only show hasApiKey indicator
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const data = await updateAiConfig({
        provider,
        apiKey: apiKey || undefined,
        model,
        temperature,
        maxTokens,
        apiBaseUrl: apiBaseUrl || null,
        enabled,
      });
      setConfig(data);
      setApiKey('');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    if (!confirm('Сбросить AI конфигурацию до значений по умолчанию?')) return;
    setResetting(true);
    setError('');
    try {
      await resetAiConfig();
      setApiKey('');
      loadConfig();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setResetting(false);
    }
  }

  function handleProviderChange(val: string) {
    setProvider(val);
    const suggestions = MODEL_SUGGESTIONS[val];
    if (suggestions && suggestions.length > 0) setModel(suggestions[0]);
  }

  if (loading) return <AdminLayout><div className={styles.loadingContainer}>Загрузка...</div></AdminLayout>;

  return (
    <AdminLayout>
      <div style={{ marginBottom: 24 }}>
        <h1 className={styles.pageTitle}>AI Конфигурация</h1>
        <p className={styles.pageSubtitle}>Настройки AI-провайдера для генерации контента</p>
      </div>

      <form onSubmit={e => { e.preventDefault(); void handleSave(e); }}>
        {/* Enabled toggle */}
        <div className={styles.section} style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <label style={{ fontWeight: 600, fontSize: '0.95rem' }}>AI генерация</label>
            <button
              type="button"
              onClick={() => setEnabled(v => !v)}
              style={{
                width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer',
                background: enabled ? 'var(--color-success, #22c55e)' : 'var(--color-border)',
                transition: 'background 0.2s', position: 'relative',
              }}
            >
              <div style={{
                width: 22, height: 22, borderRadius: '50%', background: '#fff',
                position: 'absolute', top: 2,
                left: enabled ? 24 : 2,
                transition: 'left 0.2s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
              }} />
            </button>
            <span style={{ fontSize: '0.85rem', color: enabled ? 'var(--color-success, #22c55e)' : 'var(--color-text-muted)' }}>
              {enabled ? 'Включено' : 'Отключено'}
            </span>
          </div>
        </div>

        <div className={styles.section} style={{ marginBottom: 24 }}>
          <h2 className={styles.sectionTitle}>Провайдер</h2>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Провайдер</label>
            <select
              className={styles.formSelect}
              value={provider}
              onChange={e => handleProviderChange(e.target.value)}
            >
              {PROVIDERS.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>API Ключ {config?.hasApiKey && <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>(сохранён ранее)</span>}</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showApiKey ? 'text' : 'password'}
                className={styles.formInput}
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder={provider === 'openrouter' ? 'sk-or-v1-...' : provider === 'ollama' ? '' : 'sk-...'}
                style={{ paddingRight: 44 }}
              />
              <button
                type="button"
                onClick={() => setShowApiKey(v => !v)}
                style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--color-text-muted)', fontSize: '0.85rem',
                }}
              >
                {showApiKey ? 'Скрыть' : 'Показать'}
              </button>
            </div>
          </div>

          {provider === 'custom' && (
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>API Base URL</label>
              <input
                type="text"
                className={styles.formInput}
                value={apiBaseUrl}
                onChange={e => setApiBaseUrl(e.target.value)}
                placeholder="https://api.openai.com/v1"
              />
            </div>
          )}

          {provider === 'ollama' && (
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Base URL Ollama</label>
              <input
                type="text"
                className={styles.formInput}
                value={apiBaseUrl}
                onChange={e => setApiBaseUrl(e.target.value)}
                placeholder="http://localhost:11434/v1"
              />
            </div>
          )}
        </div>

        <div className={styles.section} style={{ marginBottom: 24 }}>
          <h2 className={styles.sectionTitle}>Модель</h2>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Модель</label>
            {MODEL_SUGGESTIONS[provider] && MODEL_SUGGESTIONS[provider].length > 0 && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                {MODEL_SUGGESTIONS[provider].map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setModel(m)}
                    style={{
                      padding: '3px 10px', borderRadius: 6, border: '1px solid',
                      borderColor: model === m ? 'var(--color-primary)' : 'var(--color-border)',
                      background: model === m ? 'var(--color-primary)' : 'transparent',
                      color: model === m ? '#fff' : 'var(--color-text)',
                      cursor: 'pointer', fontSize: '0.8rem',
                    }}
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}
            <input
              type="text"
              className={styles.formInput}
              value={model}
              onChange={e => setModel(e.target.value)}
              placeholder={provider === 'openrouter' ? 'qwen/qwen3.6-plus:free' : 'gpt-4o'}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>
              Temperature: <strong>{temperature}</strong>
            </label>
            <input
              type="range"
              min="0" max="2" step="0.05"
              value={temperature}
              onChange={e => setTemperature(parseFloat(e.target.value))}
              style={{ width: '100%', cursor: 'pointer' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
              <span>Точный (0)</span>
              <span>Креативный (2)</span>
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Max Tokens</label>
            <input
              type="number"
              className={styles.formInput}
              value={maxTokens}
              onChange={e => setMaxTokens(parseInt(e.target.value) || 0)}
              min={100} max={100000}
            />
            <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
              Максимальное количество токенов в ответе. Рекомендуется 2000–8000.
            </p>
          </div>
        </div>

        {error && <div className={`${styles.alert} ${styles.alertError}`} style={{ marginBottom: 16 }}>{error}</div>}
        {saved && <div className={`${styles.alert} ${styles.alertSuccess}`} style={{ marginBottom: 16 }}>✓ Настройки сохранены</div>}

        <div style={{ display: 'flex', gap: 12 }}>
          <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={saving || !enabled}>
            {saving ? 'Сохранение…' : 'Сохранить'}
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnGhost}`}
            onClick={handleReset}
            disabled={resetting}
          >
            {resetting ? '...' : 'Сбросить'}
          </button>
        </div>

        {config?.updatedAt && (
          <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: 16 }}>
            Обновлено: {new Date(config.updatedAt).toLocaleString('ru-RU')}
          </p>
        )}
      </form>
    </AdminLayout>
  );
}
