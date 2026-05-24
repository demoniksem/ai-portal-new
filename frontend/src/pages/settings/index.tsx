'use client';
import React, { useEffect, useState, FormEvent } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, Robot, Brain, Desktop, Gear, WarningCircle, CheckCircle, Lightbulb, Eye, EyeSlash, Sparkle, ArrowLeft } from '@phosphor-icons/react';
import { MotionButton } from '../../components/ui/MotionButton';

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
  openrouter: { icon: <Globe size={22} weight="duotone" />, label: 'OpenRouter (рекомендуется — есть бесплатные модели)' },
  openai: { icon: <Robot size={22} weight="duotone" />, label: 'OpenAI (GPT-4, GPT-4o)' },
  anthropic: { icon: <Brain size={22} weight="duotone" />, label: 'Anthropic (Claude)' },
  minimax: { icon: <Sparkle size={22} weight="duotone" />, label: 'MiniMax (M2 — совместим с Anthropic)' },
  local: { icon: <Desktop size={22} weight="duotone" />, label: 'Локальный / свой эндпоинт' },
};

const PROVIDER_HINTS: Record<string, string> = {
  openrouter: 'OpenRouter объединяет множество провайдеров. Есть бесплатные модели. Ключ — на openrouter.ai',
  openai: 'Официальный API OpenAI. Нужен ключ с platform.openai.com',
  anthropic: 'Модели Claude от Anthropic. Нужен ключ с console.anthropic.com',
  minimax: 'MiniMax через Anthropic-совместимый эндпоинт. Ключ — на api.minimax.io',
  local: 'Подключение к локальной модели (Ollama, LM Studio и т.п.)',
};

const LOCAL_PROVIDER_HINTS: Record<string, string> = {
  openrouter: 'Формат: https://openrouter.ai/api/v1/chat/completions',
  openai: 'Формат: https://api.openai.com/v1/chat/completions',
  anthropic: 'Формат: https://api.anthropic.com/v1/messages',
  minimax: 'Base URL: https://api.minimax.io/anthropic (эндпоинт добавит /v1/messages)',
  local: 'Формат: http://localhost:11434/v1/chat/completions (Ollama по умолчанию)',
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
  minimax: [
    { id: 'MiniMax-M2', name: 'MiniMax M2' },
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

const inputClass =
  'w-full rounded-xl border border-line bg-bg py-2.5 px-3.5 text-[0.95rem] text-fg ' +
  'placeholder:text-fg-muted outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/15';

function StepBadge({ n }: { n: number }) {
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-accent/10 font-mono text-xs font-semibold text-accent">
      {n}
    </span>
  );
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
  const [apiBaseUrl, setApiBaseUrl] = useState('');
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
      const data = await api<AIConfig>('GET', '/api/admin/ai-config', undefined, token);
      setSettings(data);
      const cfgProvider = data.provider || 'openrouter';
      setProvider(cfgProvider);
      setModel(data.model || AI_PROVIDER_MODELS[cfgProvider]?.[0]?.id || '');
      setTemperature(data.temperature ?? 0.7);
      setMaxTokens(data.maxTokens ?? 4000);
      setApiBaseUrl(data.apiBaseUrl || '');
      setAvailableModels(AI_PROVIDER_MODELS[cfgProvider] || AI_PROVIDER_MODELS.openrouter);
    } catch (e: unknown) {
      setError('Не удалось загрузить настройки: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setLoading(false);
    }
  }

  function handleProviderChange(newProvider: string): void {
    setProvider(newProvider);
    const models = AI_PROVIDER_MODELS[newProvider] || [];
    setAvailableModels(models);
    setModel(models[0]?.id || '');
    if (newProvider === 'minimax' && !apiBaseUrl) setApiBaseUrl('https://api.minimax.io/anthropic');
    setSaved(false);
  }

  // Providers that need an explicit base URL.
  const needsBaseUrl = provider === 'minimax' || provider === 'local';

  async function handleSave(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError('');
    setSaved(false);
    setSaving(true);
    try {
      const token = getToken();
      const data = await api<AIConfig>('POST', '/api/admin/ai-config', {
        provider,
        apiKey: apiKey || undefined,
        model,
        temperature,
        maxTokens,
        apiBaseUrl: needsBaseUrl ? (apiBaseUrl.trim() || null) : null,
      }, token);
      setSettings(data);
      setApiKey('');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: unknown) {
      setError('Не удалось сохранить: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-bg">
        <div className="flex flex-col items-center gap-3 text-fg-secondary">
          <Gear size={28} weight="duotone" className="animate-spin text-accent" style={{ animationDuration: '2.5s' }} />
          <span className="text-sm">Загрузка настроек…</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Настройки ИИ — AI Portal</title>
      </Head>
      <div className="min-h-[100dvh] bg-bg">
        <div className="mx-auto max-w-[760px] px-6 py-10">
          {/* Header */}
          <header className="flex items-center gap-3">
            <Link
              href="/"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-fg-muted transition hover:bg-surface-hover hover:text-fg"
              title="Назад к порталу"
              aria-label="Назад к порталу"
            >
              <ArrowLeft size={18} weight="bold" />
            </Link>
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-accent">
                <Gear size={16} weight="fill" />
                Конфигурация
              </div>
              <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-fg">Настройки ИИ</h1>
            </div>
          </header>
          <p className="mt-3 max-w-[60ch] text-[0.95rem] leading-relaxed text-fg-secondary">
            Провайдер, модель и параметры генерации для всей компании.
          </p>

          <form onSubmit={handleSave} className="mt-8 overflow-hidden rounded-2xl border border-line bg-surface shadow-diffusion">
            <div className="divide-y divide-line">
              {/* Step 1 — Provider */}
              <section className="p-6">
                <div className="flex items-center gap-2.5 text-sm font-semibold text-fg">
                  <StepBadge n={1} />
                  Провайдер ИИ
                </div>
                <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {Object.entries(PROVIDER_LABELS).map(([key, { icon, label }]) => {
                    const active = provider === key;
                    return (
                      <button
                        type="button"
                        key={key}
                        onClick={() => handleProviderChange(key)}
                        aria-pressed={active}
                        className={`flex flex-col gap-2 rounded-xl border p-4 text-left transition ${
                          active
                            ? 'border-accent bg-accent/5 ring-4 ring-accent/15'
                            : 'border-line bg-bg hover:border-accent/40 hover:bg-surface-hover'
                        }`}
                      >
                        <span className={active ? 'text-accent' : 'text-fg-secondary'}>{icon}</span>
                        <span className="text-sm font-semibold leading-snug text-fg">{label}</span>
                        <span className="text-xs leading-relaxed text-fg-muted">{PROVIDER_HINTS[key]}</span>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* Step 2 — API Key */}
              <section className="p-6">
                <div className="flex items-center gap-2.5 text-sm font-semibold text-fg">
                  <StepBadge n={2} />
                  API-ключ
                </div>
                <p className="mt-2 text-sm text-fg-secondary">{PROVIDER_HINTS[provider]}</p>
                <div className="mt-3 flex gap-2">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={e => setApiKey(e.target.value)}
                    placeholder={settings?.hasApiKey ? '•••••••• (уже задан — введите новое значение для замены)' : 'Вставьте ваш API-ключ…'}
                    className={inputClass}
                    aria-label="API-ключ"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-line bg-bg px-3 text-sm font-medium text-fg-secondary transition hover:bg-surface-hover hover:text-fg"
                    aria-label={showApiKey ? 'Скрыть ключ' : 'Показать ключ'}
                  >
                    {showApiKey ? <><EyeSlash size={15} weight="duotone" />Скрыть</> : <><Eye size={15} weight="duotone" />Показать</>}
                  </button>
                </div>
                {settings?.hasApiKey && !apiKey && (
                  <div className="mt-2.5 flex items-center gap-1.5 text-sm text-success">
                    <CheckCircle size={15} weight="fill" />
                    Ключ уже настроен
                  </div>
                )}
              </section>

              {/* Step 3 — Model */}
              <section className="p-6">
                <div className="flex items-center gap-2.5 text-sm font-semibold text-fg">
                  <StepBadge n={3} />
                  Модель
                </div>
                <div className="mt-4 flex flex-col gap-2">
                  {availableModels.length > 0 ? (
                    <select
                      value={model}
                      onChange={e => { setModel(e.target.value); setSaved(false); }}
                      className={inputClass + ' appearance-none'}
                      aria-label="Выбор модели"
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
                      placeholder="Идентификатор модели (напр. gpt-4o, claude-3-5-sonnet-20241022)"
                      className={inputClass}
                      aria-label="Идентификатор модели"
                    />
                  )}
                  <span className="text-xs text-fg-muted">{LOCAL_PROVIDER_HINTS[provider]}</span>
                </div>

                {needsBaseUrl && (
                  <div className="mt-4 flex flex-col gap-2">
                    <label htmlFor="base-url" className="text-sm font-medium text-fg">API Base URL</label>
                    <input
                      id="base-url"
                      type="text"
                      value={apiBaseUrl}
                      onChange={e => { setApiBaseUrl(e.target.value); setSaved(false); }}
                      placeholder={provider === 'minimax' ? 'https://api.minimax.io/anthropic' : 'http://localhost:11434/v1'}
                      className={inputClass}
                      aria-label="API base URL"
                    />
                  </div>
                )}
              </section>

              {/* Step 4 — Generation params */}
              <section className="p-6">
                <div className="flex items-center gap-2.5 text-sm font-semibold text-fg">
                  <StepBadge n={4} />
                  Параметры генерации
                </div>

                <div className="mt-5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-fg">Temperature</span>
                    <span className="rounded-md bg-bg-alt px-2 py-0.5 font-mono text-fg-secondary">{temperature}</span>
                  </div>
                  <input
                    type="range" min="0" max="2" step="0.05" value={temperature}
                    onChange={e => { setTemperature(parseFloat(e.target.value)); setSaved(false); }}
                    className="mt-2.5 w-full accent-accent"
                    aria-valuemin={0} aria-valuemax={2} aria-valuenow={temperature}
                  />
                  <div className="mt-1 flex justify-between text-xs text-fg-muted">
                    <span>0 — точно</span><span>1 — баланс</span><span>2 — креативно</span>
                  </div>
                </div>

                <div className="mt-6">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-fg">Max Tokens</span>
                    <span className="rounded-md bg-bg-alt px-2 py-0.5 font-mono text-fg-secondary">{maxTokens}</span>
                  </div>
                  <input
                    type="range" min="500" max="16000" step="500" value={maxTokens}
                    onChange={e => { setMaxTokens(parseInt(e.target.value)); setSaved(false); }}
                    className="mt-2.5 w-full accent-accent"
                    aria-valuemin={500} aria-valuemax={16000} aria-valuenow={maxTokens}
                  />
                  <div className="mt-1 flex justify-between text-xs text-fg-muted">
                    <span>500 — коротко</span><span>8000 — средне</span><span>16000 — длинно</span>
                  </div>
                </div>
              </section>
            </div>

            {/* Footer actions */}
            <div className="flex items-center justify-between gap-4 border-t border-line bg-bg-alt/40 px-6 py-4">
              <AnimatePresence mode="wait">
                {error ? (
                  <motion.div
                    key="err" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="flex items-center gap-1.5 text-sm text-danger" role="alert"
                  >
                    <WarningCircle size={15} weight="fill" className="shrink-0" />{error}
                  </motion.div>
                ) : saved ? (
                  <motion.div
                    key="ok" initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                    className="flex items-center gap-1.5 text-sm text-success"
                  >
                    <CheckCircle size={15} weight="fill" className="shrink-0" />Настройки сохранены
                  </motion.div>
                ) : <span />}
              </AnimatePresence>
              <MotionButton type="submit" loading={saving} className="shrink-0">
                {saving ? 'Сохранение…' : 'Сохранить'}
              </MotionButton>
            </div>
          </form>

          {/* Tip */}
          <div className="mt-5 flex gap-3 rounded-2xl border border-accent/20 bg-accent/[0.06] p-4">
            <Lightbulb size={18} weight="fill" className="mt-0.5 shrink-0 text-accent" />
            <div className="text-sm leading-relaxed text-fg-secondary">
              <span className="font-semibold text-fg">Совет.</span>{' '}
              У OpenRouter есть бесплатные модели (помечены «Free»), не требующие оплаты.
              Для бо́льших лимитов добавьте баланс на <strong className="text-fg">openrouter.ai</strong>.
              Ключ хранится в БД и не показывается после сохранения. Настройки применяются ко всей компании.
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
