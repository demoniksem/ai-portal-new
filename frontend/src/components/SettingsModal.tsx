'use client';
import React, { useState, useEffect } from 'react';

const API = typeof window !== 'undefined' ? 'http://' + window.location.hostname + ':8081' : '';
const PROVIDERS = ['openrouter', 'openai', 'anthropic', 'openclaw', 'local'];

function getToken(): string | null {
  return typeof window !== 'undefined' ? localStorage.getItem('token') : null;
}

interface AiSettings {
  provider: string;
  model: string;
  temperature: number;
  maxTokens: number;
  hasApiKey?: boolean;
}

export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const [provider, setProvider] = useState('openrouter');
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(4000);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    const token = getToken();
    if (!token) { setLoading(false); return; }
    fetch(API + '/api/settings/ai', { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json())
      .then((d: AiSettings) => {
        setProvider(d.provider || 'openrouter');
        setModel(d.model || '');
        setTemperature(d.temperature ?? 0.7);
        setMaxTokens(d.maxTokens ?? 4000);
        setHasApiKey(!!d.hasApiKey);
      })
      .catch(() => setStatus('Не удалось загрузить настройки'))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    const token = getToken();
    if (!token) return;
    setSaving(true); setStatus('');
    try {
      const res = await fetch(API + '/api/settings/ai', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ provider, apiKey: apiKey || undefined, model, temperature, maxTokens }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || 'Ошибка сохранения');
      setApiKey('');
      setHasApiKey(!!(data as AiSettings).hasApiKey || hasApiKey);
      setStatus('Сохранено');
      setTimeout(() => setStatus(''), 2000);
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: 'min(92vw, 460px)', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 16, padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text)' }}>Настройки AI</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--color-text-muted)' }}>✕</button>
        </div>

        {loading ? (
          <div style={{ color: 'var(--color-text-muted)' }}>Загрузка…</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
              Провайдер
              <select value={provider} onChange={e => setProvider(e.target.value)}
                style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-background)', color: 'var(--color-text)' }}>
                {PROVIDERS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
              Модель
              <input value={model} onChange={e => setModel(e.target.value)} placeholder="например, gpt-4o"
                style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-background)', color: 'var(--color-text)' }} />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
              API ключ {hasApiKey && <span style={{ color: 'var(--color-text-muted)' }}>(сохранён ранее — оставьте пустым, чтобы не менять)</span>}
              <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="sk-..."
                style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-background)', color: 'var(--color-text)' }} />
            </label>

            <div style={{ display: 'flex', gap: 10, marginTop: 6, alignItems: 'center' }}>
              <button onClick={handleSave} disabled={saving || !model.trim()}
                style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: 'var(--color-primary)', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
                {saving ? 'Сохранение…' : 'Сохранить'}
              </button>
              <button onClick={onClose}
                style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
                Закрыть
              </button>
              {status && <span style={{ fontSize: '0.85rem', color: status === 'Сохранено' ? '#22c55e' : '#ef4444' }}>{status}</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
