'use client';
import React, { useState, useCallback } from 'react';
import { Space, Page, PageBlock } from '../types/api';
import { buildAI, createPage } from '../lib/api';

interface AIAssistantProps {
  spaces: { id: number; name: string }[];
  onClose: () => void;
  onPageCreated: (page: Page) => void;
  onToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  currentSpaceId?: number | null;
}

type Step = 'prompt' | 'preview' | 'saving';

interface GeneratedPage {
  title: string;
  content: PageBlock[];
}

const MACRO_ICONS: Record<string, string> = {
  info: 'ℹ️', tip: '💡', note: '📝', warning: '⚠️', decision: '🎯',
  expand: '▶️', mention: '👤', quote: '💬', divider: '―', video: '🎥',
  chart: '📊', progress: '📈', calendar: '📅', toc: '📑',
};

function renderBlock(block: PageBlock, index: number): React.ReactNode {
  switch (block.type) {
    case 'heading':
      return <h2 key={index} style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--color-text, #1a1a2e)', marginBottom: 8, marginTop: index > 0 ? 20 : 0 }}>{block.text}</h2>;
    case 'text':
      return <p key={index} style={{ color: 'var(--color-text-secondary, #4a5568)', lineHeight: 1.7, marginBottom: 8 }}>{block.text}</p>;
    case 'list':
      return (
        <ul key={index} style={{ color: 'var(--color-text-secondary, #4a5568)', paddingLeft: 20, marginBottom: 8 }}>
          {(block.items || []).map((item, i) => <li key={i} style={{ marginBottom: 4 }}>{item}</li>)}
        </ul>
      );
    case 'code':
      return <pre key={index} style={{ background: 'var(--color-background-alt, #f3f4f6)', border: '1px solid var(--color-text-muted, #e5e7eb)', borderRadius: 6, padding: 12, fontSize: '0.85rem', overflowX: 'auto', marginBottom: 8 }}>{block.code}</pre>;
    case 'table':
      return (
        <div key={index} style={{ marginBottom: 12, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
            <thead>
              <tr>
                {(block.headers || []).map((h, i) => <th key={i} style={{ padding: '8px 12px', background: 'var(--color-background-alt, #f3f4f6)', borderBottom: '2px solid var(--color-text-muted, #e5e7eb)', textAlign: 'left', fontWeight: 600 }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {(block.rows || []).map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => <td key={j} style={{ padding: '8px 12px', borderBottom: '1px solid var(--color-text-muted, #e5e7eb)' }}>{cell}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'macro': {
      const name = (block.macroName || '').toLowerCase();
      if (name === 'status') {
        const status = String(block.macroProps?.status || block.macroProps?.value || 'default').toLowerCase();
        const colors: Record<string, { bg: string; color: string }> = {
          done: { bg: '#dcfce7', color: '#166534' },
          in_progress: { bg: '#fef9c3', color: '#854d0e' },
          blocked: { bg: '#fee2e2', color: '#991b1b' },
          review: { bg: '#dbeafe', color: '#1e40af' },
          testing: { bg: '#ffedd5', color: '#9a3412' },
        };
        const c = colors[status] || { bg: '#f3f4f6', color: '#374151' };
        return <span key={index} style={{ display: 'inline-block', background: c.bg, color: c.color, fontSize: '0.8rem', padding: '3px 10px', borderRadius: 9999, fontWeight: 600, marginRight: 6, marginBottom: 6 }}>{String(block.macroProps?.label || block.macroProps?.status || status)}</span>;
      }
      if (name === 'panel' || ['info', 'tip', 'note', 'warning'].includes(name)) {
        const variant = ['info', 'tip', 'note', 'warning'].includes(name) ? name : (block.macroProps?.variant as string) || 'info';
        const colors: Record<string, { bg: string; border: string; color: string }> = {
          info: { bg: '#dbeafe', border: '#3b82f6', color: '#1e40af' },
          tip: { bg: '#dcfce7', border: '#22c55e', color: '#166534' },
          note: { bg: '#fef9c3', border: '#eab308', color: '#854d0e' },
          warning: { bg: '#fee2e2', border: '#ef4444', color: '#991b1b' },
        };
        const c = colors[variant] || colors.info;
        return (
          <div key={index} style={{ background: c.bg, borderLeft: `4px solid ${c.border}`, borderRadius: 4, padding: '12px 16px', marginBottom: 12 }}>
            <strong style={{ color: c.color }}>{String(block.macroProps?.title || variant)}</strong>
            {block.macroProps?.children ? <p style={{ margin: '8px 0 0', color: c.color, opacity: 0.85 }}>{String(block.macroProps.children)}</p> : null}
          </div>
        );
      }
      if (name === 'expand') {
        return (
          <div key={index} style={{ border: '1px solid var(--color-text-muted, #e5e7eb)', borderRadius: 6, marginBottom: 12, overflow: 'hidden' }}>
            <div style={{ background: 'var(--color-background-alt, #f3f4f6)', padding: '10px 14px', fontWeight: 600, fontSize: '0.9rem' }}>▶️ {String(block.macroProps?.title || 'Подробнее')}</div>
            {block.macroProps?.children ? <div style={{ padding: '12px 14px', fontSize: '0.9rem' }}>{String(block.macroProps.children)}</div> : null}
          </div>
        );
      }
      if (name === 'mention') {
        return <span key={index} style={{ background: '#dbeafe', border: '1px solid #3b82f6', borderRadius: 4, padding: '2px 8px', fontSize: '0.85rem', color: '#1e40af' }}>👤 {String(block.macroProps?.name || block.macroProps?.user || '')}</span>;
      }
      if (name === 'quote' || name === 'blockquote') {
        return <blockquote key={index} style={{ borderLeft: '4px solid var(--color-text-muted, #e5e7eb)', paddingLeft: 16, margin: '12px 0', color: 'var(--color-text-secondary, #4a5568)', fontStyle: 'italic' }}>{String(block.macroProps?.children || block.macroProps?.text || '')}</blockquote>;
      }
      if (name === 'divider' || name === 'hr') {
        return <hr key={index} style={{ borderBottom: '2px solid var(--color-text-muted, #e5e7eb)', margin: '20px 0' }} />;
      }
      if (name === 'decision') {
        return (
          <div key={index} style={{ border: '1px solid var(--color-primary, #667eea)', borderRadius: 8, padding: '12px 16px', marginBottom: 12 }}>
            <div style={{ fontWeight: 600, color: 'var(--color-primary, #667eea)', marginBottom: 6 }}>🎯 Решение</div>
            {block.macroProps?.description ? <p style={{ margin: 0, color: 'var(--color-text, #1a1a2e)' }}>{String(block.macroProps.description)}</p> : null}
          </div>
        );
      }
      if (name === 'video') {
        const src = String(block.macroProps?.src || block.macroProps?.url || '');
        return src ? (
          <div key={index} style={{ borderRadius: 8, overflow: 'hidden', marginBottom: 12, border: '1px solid var(--color-text-muted, #e5e7eb)' }}>
            <div style={{ padding: '8px 12px', background: 'var(--color-background-alt, #f3f4f6)', fontSize: '0.85rem', color: 'var(--color-text-secondary, #4a5568)' }}>🎥 {String(block.macroProps?.title || 'Video')}</div>
            <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden' }}>
              <iframe src={src} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }} allowFullScreen title={String(block.macroProps?.title || 'Video')} />
            </div>
          </div>
        ) : null;
      }
      // Generic macro fallback
      return (
        <div key={index} style={{ background: 'var(--color-background-alt, #f3f4f6)', border: '1px solid var(--color-text-muted, #e5e7eb)', borderRadius: 6, padding: '10px 14px', marginBottom: 8, fontSize: '0.88rem', color: 'var(--color-text-secondary, #4a5568)' }}>
          <strong>{MACRO_ICONS[name] || '🔧'} {String(block.macroName)}</strong>
          {block.macroProps && Object.keys(block.macroProps).length > 0 && (
            <div style={{ marginTop: 4, fontSize: '0.8rem', opacity: 0.75 }}>
              {Object.entries(block.macroProps).slice(0, 3).map(([k, v]) => `${k}: ${String(v)}`).join(' · ')}
            </div>
          )}
        </div>
      );
    }
    default:
      return null;
  }
}

export default function AIAssistant({ spaces, onClose, onPageCreated, onToast, currentSpaceId }: AIAssistantProps) {
  const [step, setStep] = useState<Step>('prompt');
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [generated, setGenerated] = useState<GeneratedPage | null>(null);
  const [editedTitle, setEditedTitle] = useState('');
  const [editedContent, setEditedContent] = useState('');
  const [selectedSpaceId, setSelectedSpaceId] = useState<number>(currentSpaceId || spaces[0]?.id || 0);
  const [saving, setSaving] = useState(false);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) { setError('Введите промпт'); return; }
    setGenerating(true);
    setError('');
    try {
      const result = await buildAI(prompt.trim());
      const page: GeneratedPage = { title: result.title, content: (result.content as PageBlock[]) || [] };
      setGenerated(page);
      setEditedTitle(page.title);
      setEditedContent(JSON.stringify({ title: page.title, content: page.content }, null, 2));
      setStep('preview');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Ошибка генерации';
      setError(msg.includes('503') ? 'AI сервис недоступен. Проверьте настройки в Settings → AI.' : msg.includes('not configured') ? 'API ключ AI не настроен. Откройте Settings → AI.' : `Ошибка: ${msg}`);
    } finally {
      setGenerating(false);
    }
  }, [prompt]);

  const handleRegenerate = useCallback(() => {
    setGenerated(null);
    setStep('prompt');
  }, []);

  const handleSave = useCallback(async () => {
    if (!selectedSpaceId) { setError('Выберите пространство'); return; }
    let content: unknown;
    try { content = JSON.parse(editedContent); } catch { content = editedContent; }
    setSaving(true);
    setError('');
    try {
      const page = await createPage({ title: editedTitle, spaceId: selectedSpaceId, content });
      onPageCreated(page);
      onToast(`Страница "${page.title}" создана`, 'success');
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Ошибка сохранения';
      setError(`Не удалось сохранить: ${msg}`);
    } finally {
      setSaving(false);
    }
  }, [selectedSpaceId, editedTitle, editedContent, onPageCreated, onToast, onClose]);

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: 'var(--color-surface, #fff)', borderRadius: 12,
        width: '100%', maxWidth: 720, maxHeight: '90vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--color-text-muted, #e5e7eb)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <span style={{ fontSize: '1.4rem' }}>🤖</span>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text, #1a1a2e)' }}>AI Ассистент</h2>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-text-secondary, #6b7280)' }}>
              {step === 'prompt' ? 'Опишите страницу — AI сгенерирует контент' : step === 'preview' ? 'Предпросмотр — отредактируйте перед сохранением' : 'Сохранение...'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {step === 'preview' && (
              <button onClick={handleRegenerate} style={{ padding: '6px 14px', background: 'var(--color-background-alt, #f3f4f6)', border: '1px solid var(--color-text-muted, #e5e7eb)', borderRadius: 6, cursor: 'pointer', fontSize: '0.85rem', color: 'var(--color-text-secondary, #6b7280)' }}>
                🔄 Заново
              </button>
            )}
            <button onClick={onClose} style={{ width: 32, height: 32, background: 'var(--color-background-alt, #f3f4f6)', border: '1px solid var(--color-text-muted, #e5e7eb)', borderRadius: 6, cursor: 'pointer', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {error && (
            <div style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', marginBottom: 16, color: '#991b1b', fontSize: '0.88rem' }}>
              ❌ {error}
            </div>
          )}

          {step === 'prompt' && (
            <div>
              <p style={{ marginBottom: 16, color: 'var(--color-text-secondary, #4a5568)', fontSize: '0.9rem', lineHeight: 1.6 }}>
                Опишите страницу на русском языке. AI сгенерирует заголовок и структурированный контент с заголовками, текстом, таблицами и макросами.
              </p>
              <textarea
                value={prompt}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPrompt(e.target.value)}
                onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void handleGenerate(); }}
                placeholder="Например: Создай страницу о развитии команды разработки за 2025 год с метриками, планами и решениями"
                style={{
                  width: '100%', minHeight: 140, padding: 12, borderRadius: 8,
                  border: '1px solid var(--color-text-muted, #e5e7eb)',
                  fontSize: '0.92rem', fontFamily: 'inherit', resize: 'vertical',
                  boxSizing: 'border-box', outline: 'none',
                  background: 'var(--color-background-alt, #f9fafb)',
                  color: 'var(--color-text, #1a1a2e)',
                }}
                autoFocus
              />
              <p style={{ marginTop: 8, fontSize: '0.78rem', color: 'var(--color-text-secondary, #9ca3af)' }}>
                Ctrl+Enter для генерации
              </p>
              <div style={{ marginTop: 16, padding: '12px 14px', background: 'var(--color-background-alt, #f3f4f6)', borderRadius: 8, fontSize: '0.82rem', color: 'var(--color-text-secondary, #6b7280)' }}>
                💡 <strong>Примеры:</strong> «План спринта Q2 для команды бэкенд», «Онбординг нового сотрудника в отдел маркетинга», «Техническая документация по API авторизации»
              </div>
            </div>
          )}

          {step === 'preview' && generated && (
            <div>
              {/* Preview */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary, #9ca3af)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Предпросмотр</div>
                <div style={{ background: 'var(--color-background-alt, #f9fafb)', borderRadius: 8, padding: '16px 20px', border: '1px solid var(--color-text-muted, #e5e7eb)' }}>
                  {generated.content.map((block, i) => renderBlock(block, i))}
                </div>
              </div>

              {/* Edit section */}
              <div>
                <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary, #9ca3af)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Редактирование</div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary, #6b7280)', display: 'block', marginBottom: 4 }}>Заголовок</label>
                  <input
                    value={editedTitle}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditedTitle(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--color-text-muted, #e5e7eb)', fontSize: '0.9rem', boxSizing: 'border-box', outline: 'none', background: 'var(--color-surface, #fff)', color: 'var(--color-text, #1a1a2e)' }}
                  />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary, #6b7280)', display: 'block', marginBottom: 4 }}>Контент (JSON)</label>
                  <textarea
                    value={editedContent}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditedContent(e.target.value)}
                    style={{
                      width: '100%', minHeight: 200, padding: 10, borderRadius: 6,
                      border: '1px solid var(--color-text-muted, #e5e7eb)',
                      fontSize: '0.82rem', fontFamily: 'monospace', resize: 'vertical',
                      boxSizing: 'border-box', outline: 'none',
                      background: 'var(--color-background-alt, #f9fafb)',
                      color: 'var(--color-text, #1a1a2e)',
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary, #6b7280)', display: 'block', marginBottom: 4 }}>Сохранить в пространство</label>
                  <select
                    value={selectedSpaceId}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedSpaceId(Number(e.target.value))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--color-text-muted, #e5e7eb)', fontSize: '0.9rem', boxSizing: 'border-box', outline: 'none', cursor: 'pointer', background: 'var(--color-surface, #fff)', color: 'var(--color-text, #1a1a2e)' }}
                  >
                    {spaces.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--color-text-muted, #e5e7eb)', display: 'flex', gap: 10, justifyContent: 'flex-end', flexShrink: 0 }}>
          <button onClick={onClose} style={{ padding: '9px 20px', background: 'var(--color-background-alt, #f3f4f6)', border: '1px solid var(--color-text-muted, #e5e7eb)', borderRadius: 7, cursor: 'pointer', fontSize: '0.9rem', color: 'var(--color-text-secondary, #6b7280)' }}>
            Отмена
          </button>
          {step === 'prompt' && (
            <button
              onClick={() => void handleGenerate()}
              disabled={generating || !prompt.trim()}
              style={{
                padding: '9px 20px', background: generating ? '#9ca3af' : '#667eea',
                border: 'none', borderRadius: 7, cursor: generating ? 'not-allowed' : 'pointer',
                fontSize: '0.9rem', fontWeight: 600, color: '#fff',
                display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              {generating ? '⏳ Генерация...' : '✨ Сгенерировать'}
            </button>
          )}
          {step === 'preview' && (
            <button
              onClick={() => void handleSave()}
              disabled={saving || !selectedSpaceId}
              style={{
                padding: '9px 20px', background: saving ? '#9ca3af' : '#22c55e',
                border: 'none', borderRadius: 7, cursor: saving ? 'not-allowed' : 'pointer',
                fontSize: '0.9rem', fontWeight: 600, color: '#fff',
              }}
            >
              {saving ? '⏳ Сохранение...' : '💾 Сохранить страницу'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
