'use client';
import { useState, useEffect, useRef, useCallback, FormEvent, KeyboardEvent, type ReactNode } from 'react';
import Link from 'next/link';
import {
  Robot, Gear, User, PaperPlaneTilt, Stop, WarningCircle,
  FileText, Lightbulb, ArrowsClockwise, ClipboardText,
} from '@phosphor-icons/react';
import styles from '@/styles/Assistant.module.css';

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
  { icon: <FileText size={18} weight="duotone" />, text: 'Help me write a project status report' },
  { icon: <Lightbulb size={18} weight="duotone" />, text: 'Explain this code snippet' },
  { icon: <ArrowsClockwise size={18} weight="duotone" />, text: 'Refactor this function for better performance' },
  { icon: <ClipboardText size={18} weight="duotone" />, text: 'Create a meeting agenda for our team sync' },
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
  let currentText = content;

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
        <pre key={i} className={styles.codeBlock}>
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
        parts2.push(<code key={'ic' + idx} style={{ background: '#f3f4f6', padding: '1px 5px', borderRadius: 4, fontSize: '0.88em' }}>{match[1]}</code>);
        idx = match.index + match[0].length;
      }
      if (idx < text.length) parts2.push(text.slice(idx));
      if (parts2.length > 0) parts.push(<span key={'t' + i}>{parts2}</span>);
    }
  });

  return parts.length > 0 ? parts : [content];
}

export default function AssistantPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
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
    : 'Not configured';

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Link href="/" style={{ textDecoration: 'none', color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>← Back</Link>
          <div className={styles.headerTitle}>
            <span style={{ display: 'inline-flex', color: 'var(--color-primary)' }}><Robot size={20} weight="duotone" /></span>
            <span>AI Assistant</span>
            {config?.model && <span className={styles.modelBadge}>{modelLabel}</span>}
          </div>
        </div>
        <div className={styles.headerRight}>
          {messages.length > 0 && (
            <button className={styles.clearBtn} onClick={clearChat} title="Clear chat">Clear</button>
          )}
          <Link href="/settings" className={styles.iconBtn} title="AI Settings"><Gear size={18} /></Link>
        </div>
      </div>

      {/* Messages */}
      <div className={styles.messagesWrapper}>
        {messages.length === 0 ? (
          <div className={styles.welcome}>
            <div className={styles.welcomeIcon}><Robot size={40} weight="duotone" /></div>
            <h1 className={styles.welcomeTitle}>How can I help you today?</h1>
            <p className={styles.welcomeSubtitle}>
              I can assist with writing, analysis, coding, brainstorming, and more.
              Select a prompt below or type your question.
            </p>
            <div className={styles.suggestions}>
              {SUGGESTED_PROMPTS.map((prompt, i) => (
                <button
                  key={i}
                  className={styles.suggestionBtn}
                  onClick={() => void sendMessage(prompt.text)}
                >
                  <span>{prompt.icon}</span>
                  <span>{prompt.text}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className={styles.messages}>
            {messages.map(msg => (
              <div key={msg.id} className={`${styles.message} ${styles[msg.role]}`}>
                <div className={`${styles.avatar} ${styles[msg.role]}`}>
                  {msg.role === 'assistant' ? <Robot size={18} weight="duotone" /> : <User size={18} weight="duotone" />}
                </div>
                <div style={{ flex: 1 }}>
                  <div className={styles.bubble}>
                    {parseContent(msg.content || '')}
                    {msg.role === 'assistant' && loading && (
                      <div className={styles.loadingDots}>
                        <div className={styles.loadingDot} />
                        <div className={styles.loadingDot} />
                        <div className={styles.loadingDot} />
                      </div>
                    )}
                    {msg.role === 'assistant' && loading && msg.content && (
                      <span className={styles.streamingCursor} />
                    )}
                  </div>
                  <div className={styles.timestamp}>{formatTime(msg.timestamp)}</div>
                </div>
              </div>
            ))}
            {error && (
              <div style={{
                padding: '12px 16px',
                background: 'var(--color-error-light)',
                border: '1px solid var(--color-error)',
                borderRadius: 8,
                color: 'var(--color-error)',
                fontSize: '0.88rem',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <WarningCircle size={16} weight="fill" />{error}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className={styles.inputArea}>
        <div className={styles.inputWrapper}>
          {config?.model && (
            <div className={styles.contextIndicator}>
              <div className={styles.contextDot} />
              <span>Using {config.model}</span>
            </div>
          )}
          <form className={styles.inputForm} onSubmit={e => { e.preventDefault(); void handleSubmit(); }}>
            <div className={styles.inputContainer}>
              <textarea
                ref={textareaRef}
                className={styles.textarea}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask me anything… (Enter to send, Shift+Enter for newline)"
                rows={1}
                disabled={loading}
                aria-label="Message input"
              />
            </div>
            <button
              type="submit"
              className={`${styles.sendBtn} ${loading ? styles.stopBtn : ''}`}
              disabled={loading || !input.trim()}
              title={loading ? 'Stop' : 'Send'}
            >
              {loading ? <Stop size={18} weight="fill" /> : <PaperPlaneTilt size={18} weight="fill" />}
            </button>
          </form>
          <div style={{ textAlign: 'center', marginTop: 8, fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
            AI responses are generated based on your configured model. Results may vary.
          </div>
        </div>
      </div>
    </div>
  );
}