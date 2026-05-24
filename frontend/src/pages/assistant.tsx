'use client';
import { useState, useEffect, useRef, FormEvent, KeyboardEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Robot, Gear, User, PaperPlaneTilt, Stop, WarningCircle, ArrowLeft, Trash,
  FileText, Lightbulb, ArrowsClockwise, ClipboardText,
} from '@phosphor-icons/react';

const API_BASE = typeof window !== 'undefined' ? 'http://' + window.location.hostname + ':8081' : '';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface AIConfig {
  provider: string;
  model: string;
  hasApiKey?: boolean;
}

function getToken(): string | null {
  return typeof window !== 'undefined' ? localStorage.getItem('token') : null;
}

async function fetchAI<T>(path: string, body?: unknown, token?: string | null): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const opts: RequestInit = { method: body ? 'POST' : 'GET', headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(API_BASE + path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || res.statusText);
  return data as T;
}

const SUGGESTED_PROMPTS: { icon: ReactNode; text: string }[] = [
  { icon: <FileText size={20} weight="duotone" />, text: 'Помоги составить отчёт о статусе проекта' },
  { icon: <Lightbulb size={20} weight="duotone" />, text: 'Объясни этот фрагмент кода' },
  { icon: <ArrowsClockwise size={20} weight="duotone" />, text: 'Отрефактори функцию ради производительности' },
  { icon: <ClipboardText size={20} weight="duotone" />, text: 'Собери повестку для командного синка' },
];

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function parseContent(content: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;
  const inlineCodeRegex = /`([^`]+)`/g;

  let lastIndex = 0;
  let match;

  const segments: { type: 'text' | 'code'; content: string; lang?: string }[] = [];

  codeBlockRegex.lastIndex = 0;
  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', content: content.slice(lastIndex, match.index) });
    }
    segments.push({ type: 'code', content: match[2], lang: match[1] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < content.length) {
    segments.push({ type: 'text', content: content.slice(lastIndex) });
  }

  segments.forEach((seg, i) => {
    if (seg.type === 'code') {
      parts.push(
        <pre
          key={i}
          className="my-2 overflow-x-auto rounded-xl border border-line bg-bg-alt p-3.5 font-mono text-[0.82rem] leading-relaxed text-fg"
        >
          <code>{seg.content.trim()}</code>
        </pre>
      );
    } else {
      const parts2: React.ReactNode[] = [];
      let text = seg.content;
      inlineCodeRegex.lastIndex = 0;
      let idx = 0;
      while ((match = inlineCodeRegex.exec(text)) !== null) {
        if (match.index > idx) {
          parts2.push(text.slice(idx, match.index));
        }
        parts2.push(
          <code key={'ic' + idx} className="rounded-md bg-bg-alt px-1.5 py-0.5 font-mono text-[0.88em] text-fg">
            {match[1]}
          </code>
        );
        idx = match.index + match[0].length;
      }
      if (idx < text.length) parts2.push(text.slice(idx));
      if (parts2.length > 0) parts.push(<span key={'t' + i} className="whitespace-pre-wrap">{parts2}</span>);
    }
  });

  return parts.length > 0 ? parts : [content];
}

export default function AssistantPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<AIConfig | null>(null);
  const [error, setError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      window.location.href = '/login';
      return;
    }
    void loadConfig();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function loadConfig(): Promise<void> {
    try {
      const token = getToken();
      const data = await fetchAI<AIConfig>('/api/admin/ai-config', undefined, token);
      setConfig(data);
    } catch {
      // non-critical
    }
  }

  async function sendMessage(content: string): Promise<void> {
    if (!content.trim() || loading) return;
    const token = getToken();
    if (!token) return;

    const userMsg: Message = {
      id: Date.now().toString() + '-u',
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setError('');

    const assistantMsgId = Date.now().toString() + '-a';
    setMessages(prev => [...prev, {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    }]);

    try {
      const data = await fetchAI<{ response: string }>('/api/ai/chat', {
        messages: messages.map(m => ({ role: m.role, content: m.content })).concat([{ role: 'user', content: content.trim() }]),
      }, token);

      setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, content: data.response } : m));
    } catch (e: unknown) {
      setMessages(prev => prev.filter(m => m.id !== assistantMsgId));
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e?: FormEvent): void {
    e?.preventDefault();
    if (!input.trim()) return;
    void sendMessage(input);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendMessage(input);
    }
  }

  function clearChat(): void {
    setMessages([]);
    setError('');
  }

  const modelLabel = config?.model
    ? config.model.length > 30 ? config.model.slice(0, 30) + '…' : config.model
    : 'Не настроено';

  return (
    <div className="flex h-[100dvh] flex-col bg-bg">
      {/* Header */}
      <header className="flex items-center justify-between gap-4 border-b border-line bg-surface/80 px-5 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-fg-muted transition hover:bg-surface-hover hover:text-fg"
            title="Назад"
            aria-label="Назад"
          >
            <ArrowLeft size={18} weight="bold" />
          </Link>
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 text-accent">
              <Robot size={18} weight="fill" />
            </span>
            <span className="font-semibold tracking-tight text-fg">AI-ассистент</span>
            {config?.model && (
              <span className="rounded-md bg-bg-alt px-2 py-0.5 font-mono text-xs text-fg-secondary">
                {modelLabel}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              title="Очистить чат"
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-fg-secondary transition hover:bg-surface-hover hover:text-fg active:scale-[0.98]"
            >
              <Trash size={15} weight="bold" />
              Очистить
            </button>
          )}
          <Link
            href="/settings"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-fg-muted transition hover:bg-surface-hover hover:text-fg"
            title="Настройки ИИ"
          >
            <Gear size={18} />
          </Link>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="mx-auto flex min-h-full max-w-[680px] flex-col items-center justify-center px-6 py-12 text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 160, damping: 18 }}
              className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10 text-accent"
            >
              <Robot size={34} weight="duotone" />
            </motion.div>
            <h1 className="mt-6 text-2xl font-semibold tracking-tight text-fg">
              Чем могу помочь?
            </h1>
            <p className="mt-2 max-w-[46ch] text-[0.95rem] leading-relaxed text-fg-secondary">
              Помогу с текстами, анализом, кодом и брейнштормом. Выберите подсказку ниже или задайте вопрос.
            </p>
            <motion.div
              initial="hidden"
              animate="show"
              variants={{ show: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } } }}
              className="mt-8 grid w-full grid-cols-1 gap-2.5 sm:grid-cols-2"
            >
              {SUGGESTED_PROMPTS.map((prompt, i) => (
                <motion.button
                  key={i}
                  variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
                  onClick={() => void sendMessage(prompt.text)}
                  whileTap={{ scale: 0.98 }}
                  className="group flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-left text-sm text-fg-secondary transition hover:border-accent/40 hover:bg-surface-hover hover:text-fg"
                >
                  <span className="text-accent transition group-hover:scale-110">{prompt.icon}</span>
                  <span className="leading-snug">{prompt.text}</span>
                </motion.button>
              ))}
            </motion.div>
          </div>
        ) : (
          <div className="mx-auto flex max-w-[760px] flex-col gap-5 px-5 py-8">
            {messages.map(msg => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 200, damping: 24 }}
                className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                    msg.role === 'assistant' ? 'bg-accent/10 text-accent' : 'bg-fg/5 text-fg-secondary'
                  }`}
                >
                  {msg.role === 'assistant'
                    ? <Robot size={18} weight="fill" />
                    : <User size={18} weight="fill" />}
                </div>
                <div className={`flex min-w-0 flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`max-w-full rounded-2xl px-4 py-2.5 text-[0.95rem] leading-relaxed ${
                      msg.role === 'user'
                        ? 'rounded-tr-sm bg-accent text-white'
                        : 'rounded-tl-sm border border-line bg-surface text-fg'
                    }`}
                  >
                    {msg.content
                      ? parseContent(msg.content)
                      : msg.role === 'assistant' && loading && (
                          <span className="flex items-center gap-1 py-1" aria-label="Печатает…">
                            {[0, 1, 2].map(d => (
                              <motion.span
                                key={d}
                                className="h-1.5 w-1.5 rounded-full bg-fg-muted"
                                animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
                                transition={{ duration: 1, repeat: Infinity, delay: d * 0.15 }}
                              />
                            ))}
                          </span>
                        )}
                    {msg.role === 'assistant' && loading && msg.content && (
                      <span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse bg-accent align-middle" />
                    )}
                  </div>
                  <span className="px-1 font-mono text-[0.7rem] text-fg-muted">{formatTime(msg.timestamp)}</span>
                </div>
              </motion.div>
            ))}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-sm text-danger"
                  role="alert"
                >
                  <WarningCircle size={16} weight="fill" className="shrink-0" />
                  {error}
                </motion.div>
              )}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="border-t border-line bg-surface/80 px-5 py-4 backdrop-blur-sm">
        <div className="mx-auto max-w-[760px]">
          <form onSubmit={handleSubmit} className="flex items-end gap-2.5">
            <div className="flex flex-1 items-end rounded-2xl border border-line bg-bg px-4 py-2.5 transition focus-within:border-accent focus-within:ring-4 focus-within:ring-accent/15">
              <textarea
                ref={textareaRef}
                className="max-h-[200px] w-full resize-none bg-transparent text-[0.95rem] leading-relaxed text-fg outline-none placeholder:text-fg-muted"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Спросите что угодно… (Enter — отправить, Shift+Enter — перенос)"
                rows={1}
                disabled={loading}
                aria-label="Поле ввода сообщения"
              />
            </div>
            <motion.button
              type="submit"
              whileTap={{ scale: 0.94 }}
              disabled={loading || !input.trim()}
              title={loading ? 'Генерация…' : 'Отправить'}
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${
                loading ? 'bg-danger hover:bg-danger/90' : 'bg-accent hover:bg-accent-hover'
              }`}
            >
              {loading ? <Stop size={18} weight="fill" /> : <PaperPlaneTilt size={18} weight="fill" />}
            </motion.button>
          </form>
          <p className="mt-2 text-center text-[0.72rem] text-fg-muted">
            Ответы формирует настроенная модель. Результаты могут различаться.
          </p>
        </div>
      </div>
    </div>
  );
}
