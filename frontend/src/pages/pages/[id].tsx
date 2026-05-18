import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import axios from 'axios';
import nextDynamic from 'next/dynamic';
import styles from '../../styles/Home.module.css';

// TipTap requires browser APIs — load client-side only
const RichTextEditor = nextDynamic(() => import('../../components/RichTextEditor'), { ssr: false });

const API = typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:8081` : '';

function getToken(): string | null {
  return typeof window !== 'undefined' ? localStorage.getItem('token') : null;
}

export interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'warning';
}

/**
 * Represents a single content block on a page.
 * @property type - Discriminator: 'heading' | 'text' | 'table' | 'macro'
 * @property text  - Content for heading and text blocks
 * @property headers - Column headers for table blocks
 * @property rows   - Cell values for table blocks (array of rows)
 * @property macroName - Identifier for macro type (e.g. 'chart', 'progress', 'calendar')
 * @property macroProps - Key-value parameters passed to the macro renderer
 */
export interface Block {
  type: 'heading' | 'text' | 'table' | 'macro';
  text?: string;
  headers?: string[];
  rows?: string[][];
  macroName?: string;
  macroProps?: Record<string, unknown>;
}

/**
 * Page data shape returned by GET /api/pages/:id
 * content can be either legacy Block[] JSON or TipTap HTML string
 */
export interface PageData {
  id: string;
  title: string;
  content: Block[] | string;
}

/**
 * Hook providing toast notification state and controls.
 * @returns addToast(message, type, duration) - show a toast; removeToast(id) - dismiss a toast; ToastContainer - render portal
 */
function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (message: string, type: 'success' | 'error' | 'warning' = 'success', duration = 3000) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  };

  const removeToast = (id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const ToastContainer = () => {
    if (toasts.length === 0) return null;
    return (
      <div className={styles.toastContainer}>
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`${styles.toast} ${
              toast.type === 'success' ? styles.toastSuccess :
              toast.type === 'error' ? styles.toastError :
              styles.toastWarning
            }`}
          >
            <span className={styles.toastMessage}>
              {toast.type === 'success' ? '✓ ' : toast.type === 'error' ? '✗ ' : '⚠ '}
              {toast.message}
            </span>
            <button
              className={styles.toastClose}
              onClick={() => removeToast(toast.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    );
  };

  return { addToast, removeToast, ToastContainer };
}

// Block renderer (read-only view)
/**
 * Renders a single Block as a React element for view mode.
 * @param block - The block to render
 * @param i - Index used as React key and for animation delay
 * @returns React element — h2 (heading), p (text), table (table), or styled div (macro)
 */
function renderBlock(block: Block, i: number) {
  switch (block.type) {
    case 'heading':
      return (
        <h2
          key={i}
          className={styles.blockHeading}
          style={{ animationDelay: `${i * 0.05}s` }}
        >
          {block.text}
        </h2>
      );
    case 'text':
      return (
        <p
          key={i}
          className={styles.blockText}
          style={{ animationDelay: `${i * 0.05}s` }}
        >
          {block.text}
        </p>
      );
    case 'table':
      return (
        <div
          key={i}
          style={{ animationDelay: `${i * 0.05}s` }}
        >
          <table className={styles.blockTable}>
            <thead>
              <tr>
                {block.headers && block.headers.map((h, j) => (
                  <th key={j}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows && block.rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => (
                    <td key={c}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'macro':
      const macroIcons: Record<string, string> = {
        'chart': '📊',
        'table': '📋',
        'list': '📝',
        'card': '🎴',
        'profile': '👤',
        'calendar': '📅',
        'progress': '📈',
        'default': '📦'
      };
      const macroName = block.macroName || 'macro';
      const icon = macroIcons[macroName.toLowerCase()] || macroIcons['default'];
      return (
        <div
          key={i}
          className={styles.blockMacro}
          style={{ animationDelay: `${i * 0.05}s` }}
        >
          <div>
            <strong style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.5rem' }}>{icon}</span>
              {macroName.charAt(0).toUpperCase() + macroName.slice(1)}
            </strong>
            {block.macroProps && Object.keys(block.macroProps).length > 0 && (
              <div className={styles.macroPreview}>
                <strong>Props:</strong>
                <pre style={{ margin: '8px 0 0 0', whiteSpace: 'pre-wrap' }}>
                  {JSON.stringify(block.macroProps, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      );
    default:
      return (
        <pre
          key={i}
          className={styles.blockMacro}
          style={{ animationDelay: `${i * 0.05}s` }}
        >
          {JSON.stringify(block, null, 2)}
        </pre>
      );
  }
}

// Editable block row component
/**
 * Props for the EditableBlock component.
 * @param block - The block data to render/edit
 * @param index - Position of this block in the page (0-based, used for display)
 * @param onChange - Called when any field in the block changes; receives new block data
 * @param onDelete - Called to remove this block from the page
 * @param onMoveUp - Requests moving this block one position up in the list
 * @param onMoveDown - Requests moving this block one position down in the list
 * @param isFirst - True when this is the first block; disables the "move up" button
 * @param isLast - True when this is the last block; disables the "move down" button
 */
interface EditableBlockProps {
  block: Block;
  index: number;
  onChange: (index: number, updated: Block) => void;
  onDelete: (index: number) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  isFirst: boolean;
  isLast: boolean;
}

function EditableBlock({ block, index, onChange, onDelete, onMoveUp, onMoveDown, isFirst, isLast }: EditableBlockProps) {
  const [expanded, setExpanded] = useState(false);

  const handleTypeChange = (newType: string) => {
    const updated: Block = { type: newType as Block['type'] };
    if (newType === 'heading' || newType === 'text') {
      updated.text = block.text || '';
    } else if (newType === 'table') {
      updated.headers = block.headers || ['Column 1', 'Column 2'];
      updated.rows = block.rows || [['', '']];
    } else if (newType === 'macro') {
      updated.macroName = block.macroName || 'chart';
      updated.macroProps = block.macroProps || {};
    }
    onChange(index, updated);
  };

  const handleTextChange = (value: string) => {
    onChange(index, { ...block, text: value });
  };

  const handleTableHeaderChange = (colIndex: number, value: string) => {
    const newHeaders = [...(block.headers || [])];
    newHeaders[colIndex] = value;
    onChange(index, { ...block, headers: newHeaders });
  };

  const handleTableCellChange = (rowIndex: number, colIndex: number, value: string) => {
    const newRows = [...(block.rows || [])];
    if (!newRows[rowIndex]) newRows[rowIndex] = [];
    newRows[rowIndex] = [...newRows[rowIndex]];
    newRows[rowIndex][colIndex] = value;
    onChange(index, { ...block, rows: newRows });
  };

  const addTableRow = () => {
    const cols = (block.headers || []).length;
    const newRow = Array(cols).fill('');
    onChange(index, { ...block, rows: [...(block.rows || []), newRow] });
  };

  const addTableCol = () => {
    const newHeaders = [...(block.headers || []), `Column ${(block.headers?.length || 0) + 1}`];
    const newRows = (block.rows || []).map(row => [...row, '']);
    onChange(index, { ...block, headers: newHeaders, rows: newRows });
  };

  const deleteTableRow = (rowIndex: number) => {
    const newRows = (block.rows || []).filter((_, i) => i !== rowIndex);
    onChange(index, { ...block, rows: newRows });
  };

  const deleteTableCol = (colIndex: number) => {
    const newHeaders = (block.headers || []).filter((_, i) => i !== colIndex);
    const newRows = (block.rows || []).map(row => row.filter((_, i) => i !== colIndex));
    onChange(index, { ...block, headers: newHeaders, rows: newRows });
  };

  return (
    <div style={{
      border: '1px solid #e5e7eb',
      borderRadius: 8,
      marginBottom: 12,
      background: '#fff',
      overflow: 'hidden',
    }}>
      {/* Block toolbar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 12px',
        background: '#f9fafb',
        borderBottom: '1px solid #e5e7eb',
        flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 600 }}>#{index + 1}</span>

        {/* Block type selector */}
        <select
          value={block.type}
          onChange={e => handleTypeChange(e.target.value)}
          style={{
            padding: '4px 8px',
            border: '1px solid #e5e7eb',
            borderRadius: 4,
            fontSize: '0.82rem',
            background: '#fff',
            color: '#374151',
            cursor: 'pointer',
          }}
        >
          <option value="text">Текст</option>
          <option value="heading">Заголовок</option>
          <option value="table">Таблица</option>
          <option value="macro">Макрос</option>
        </select>

        {/* Move buttons */}
        <button
          onClick={() => onMoveUp(index)}
          disabled={isFirst}
          title="Переместить вверх"
          style={{
            padding: '4px 8px',
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: 4,
            cursor: isFirst ? 'not-allowed' : 'pointer',
            opacity: isFirst ? 0.4 : 1,
            fontSize: '0.8rem',
          }}
        >
          ↑
        </button>
        <button
          onClick={() => onMoveDown(index)}
          disabled={isLast}
          title="Переместить вниз"
          style={{
            padding: '4px 8px',
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: 4,
            cursor: isLast ? 'not-allowed' : 'pointer',
            opacity: isLast ? 0.4 : 1,
            fontSize: '0.8rem',
          }}
        >
          ↓
        </button>

        {/* Expand/collapse for tables */}
        {block.type === 'table' && (
          <button
            onClick={() => setExpanded(!expanded)}
            style={{
              padding: '4px 8px',
              background: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: '0.8rem',
            }}
          >
            {expanded ? 'Свернуть' : 'Развернуть'}
          </button>
        )}

        <div style={{ marginLeft: 'auto' }}>
          <button
            onClick={() => onDelete(index)}
            title="Удалить блок"
            style={{
              padding: '4px 8px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: 4,
              cursor: 'pointer',
              color: '#ef4444',
              fontSize: '0.8rem',
            }}
          >
            🗑 Удалить
          </button>
        </div>
      </div>

      {/* Block content editor */}
      <div style={{ padding: 12 }}>
        {block.type === 'text' && (
          <textarea
            value={block.text || ''}
            onChange={e => handleTextChange(e.target.value)}
            placeholder="Введите текст..."
            rows={3}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #e5e7eb',
              borderRadius: 6,
              fontSize: '0.95rem',
              fontFamily: 'inherit',
              resize: 'vertical',
              boxSizing: 'border-box',
              lineHeight: 1.6,
              color: '#374151',
            }}
          />
        )}

        {block.type === 'heading' && (
          <input
            type="text"
            value={block.text || ''}
            onChange={e => handleTextChange(e.target.value)}
            placeholder="Заголовок страницы..."
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #e5e7eb',
              borderRadius: 6,
              fontSize: '1.1rem',
              fontWeight: 600,
              boxSizing: 'border-box',
              color: '#1f2937',
            }}
          />
        )}

        {block.type === 'table' && (
          <div>
            {(expanded || true) && (
              <>
                {/* Headers row */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                  {(block.headers || []).map((header, ci) => (
                    <div key={ci} style={{ flex: 1, display: 'flex', gap: 4, alignItems: 'center' }}>
                      <input
                        type="text"
                        value={header}
                        onChange={e => handleTableHeaderChange(ci, e.target.value)}
                        style={{
                          flex: 1,
                          padding: '6px 8px',
                          border: '1px solid #c7d2fe',
                          borderRadius: 4,
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          background: '#eef2ff',
                          color: '#3730a3',
                          boxSizing: 'border-box',
                        }}
                      />
                      {(block.headers || []).length > 1 && (
                        <button
                          onClick={() => deleteTableCol(ci)}
                          style={{
                            padding: '4px',
                            background: 'none',
                            border: '1px solid #e5e7eb',
                            borderRadius: 4,
                            cursor: 'pointer',
                            color: '#9ca3af',
                            fontSize: '0.75rem',
                          }}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={addTableCol}
                    style={{
                      padding: '6px 10px',
                      background: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                      borderRadius: 4,
                      cursor: 'pointer',
                      color: '#16a34a',
                      fontSize: '0.8rem',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    + Колонка
                  </button>
                </div>

                {/* Data rows */}
                {(block.rows || []).map((row, ri) => (
                  <div key={ri} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                    {row.map((cell, ci) => (
                      <div key={ci} style={{ flex: 1, display: 'flex', gap: 4, alignItems: 'center' }}>
                        <input
                          type="text"
                          value={cell}
                          onChange={e => handleTableCellChange(ri, ci, e.target.value)}
                          style={{
                            flex: 1,
                            padding: '6px 8px',
                            border: '1px solid #e5e7eb',
                            borderRadius: 4,
                            fontSize: '0.85rem',
                            boxSizing: 'border-box',
                            color: '#374151',
                          }}
                        />
                      </div>
                    ))}
                    <button
                      onClick={() => deleteTableRow(ri)}
                      style={{
                        padding: '4px',
                        background: 'none',
                        border: '1px solid #e5e7eb',
                        borderRadius: 4,
                        cursor: 'pointer',
                        color: '#9ca3af',
                        fontSize: '0.75rem',
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}

                <button
                  onClick={addTableRow}
                  style={{
                    padding: '6px 12px',
                    background: '#f9fafb',
                    border: '1px dashed #d1d5db',
                    borderRadius: 4,
                    cursor: 'pointer',
                    color: '#6b7280',
                    fontSize: '0.82rem',
                  }}
                >
                  + Добавить строку
                </button>
              </>
            )}
          </div>
        )}

        {block.type === 'macro' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <label style={{ fontSize: '0.85rem', color: '#6b7280' }}>Тип макроса:</label>
              <select
                value={block.macroName || 'chart'}
                onChange={e => onChange(index, { ...block, macroName: e.target.value, macroProps: {} })}
                style={{
                  padding: '6px 10px',
                  border: '1px solid #e5e7eb',
                  borderRadius: 4,
                  fontSize: '0.85rem',
                  background: '#fff',
                  color: '#374151',
                  cursor: 'pointer',
                }}
              >
                <option value="chart">📊 Chart</option>
                <option value="progress">📈 Progress</option>
                <option value="calendar">📅 Calendar</option>
                <option value="info">ℹ️ Info Panel</option>
                <option value="tip">💡 Tip Panel</option>
                <option value="warning">⚠️ Warning Panel</option>
              </select>
            </div>
            <div style={{
              padding: '8px 12px',
              background: '#fefce8',
              border: '1px solid #fef08a',
              borderRadius: 6,
              fontSize: '0.82rem',
              color: '#854d0e',
            }}>
              Макрос «{block.macroName}» отображается в режиме просмотра. Редактируйте параметры через AI-редактор.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Add block type picker
/**
 * Props for the AddBlockMenu dropdown component.
 * @param onAdd - Callback invoked with the selected block type when the user picks one
 */
interface AddBlockButtonProps {
  onAdd: (type: Block['type']) => void;
}

function AddBlockMenu({ onAdd }: AddBlockButtonProps) {
  const [show, setShow] = useState(false);

  const types: { type: Block['type']; label: string; icon: string }[] = [
    { type: 'text', label: 'Текстовый блок', icon: '📝' },
    { type: 'heading', label: 'Заголовок', icon: '🔤' },
    { type: 'table', label: 'Таблица', icon: '📋' },
    { type: 'macro', label: 'Макрос', icon: '📦' },
  ];

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setShow(!show)}
        style={{
          padding: '8px 16px',
          background: '#f0fdf4',
          border: '1px solid #bbf7d0',
          borderRadius: 6,
          cursor: 'pointer',
          color: '#16a34a',
          fontSize: '0.9rem',
          fontWeight: 500,
        }}
      >
        + Добавить блок
      </button>
      {show && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          marginTop: 4,
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          zIndex: 100,
          minWidth: 180,
          overflow: 'hidden',
        }}>
          {types.map(({ type, label, icon }) => (
            <button
              key={type}
              onClick={() => { onAdd(type); setShow(false); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                padding: '10px 14px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.9rem',
                color: '#374151',
                textAlign: 'left',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              <span>{icon}</span> {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Convert legacy Block[] JSON to TipTap HTML for edit mode
function blocksToHtml(blocks: Block[]): string {
  if (!blocks || blocks.length === 0) return '';
  return blocks.map(block => {
    switch (block.type) {
      case 'heading':
        return `<h2>${escapeHtml(block.text || '')}</h2>`;
      case 'text':
        return `<p>${escapeHtml(block.text || '')}</p>`;
      case 'table':
        if (!block.headers?.length || !block.rows?.length) return '';
        const ths = block.headers.map(h => `<th>${escapeHtml(h)}</th>`).join('');
        const rows = block.rows.map(row =>
          `<tr>${row.map(c => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`
        ).join('');
        return `<table><thead><tr>${ths}</tr></thead><tbody>${rows}</tbody></table>`;
      case 'macro': {
        const propsStr = block.macroProps
          ? Object.entries(block.macroProps).map(([k, v]) => `${k}: ${v}`).join(', ')
          : '';
        return `<p><em>[Macro: ${block.macroName || 'unknown'}]${propsStr ? ` — ${propsStr}` : ''}</em></p>`;
      }
      default:
        return '';
    }
  }).join('\n');
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Loading skeleton
function PageSkeleton() {
  return (
    <div className={styles.pageContent}>
      <div className={`${styles.skeleton} ${styles.skeletonTitle}`} style={{ width: '60%' }} />
      <div className={styles.breadcrumb}>
        <div className={`${styles.skeleton} ${styles.skeletonText}`} style={{ width: '120px', height: '16px' }} />
      </div>
      <div className={`${styles.skeleton} ${styles.skeletonText}`} />
      <div className={`${styles.skeleton} ${styles.skeletonText}`} style={{ width: '80%' }} />
      <div className={`${styles.skeleton} ${styles.skeletonText}`} style={{ width: '90%' }} />
      <div className={`${styles.skeleton} ${styles.skeletonText}`} style={{ width: '70%' }} />
    </div>
  );
}

export const dynamic = 'force-dynamic';

export default function PageView() {
  const router = typeof window !== 'undefined' ? useRouter() : null;
  const [pageId, setPageId] = useState<string | null>(null);
  const [pageData, setPageData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editBlocks, setEditBlocks] = useState<Block[]>([]);
  const [editTitle, setEditTitle] = useState('');
  const [editHtml, setEditHtml] = useState('');
  const [saving, setSaving] = useState(false);
  const [versionsPanelOpen, setVersionsPanelOpen] = useState(false);
  const [versions, setVersions] = useState<Version[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [rollingBack, setRollingBack] = useState<number | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<Version | null>(null);
  const [selectedVersionContent, setSelectedVersionContent] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [attachmentsUploading, setAttachmentsUploading] = useState(false);
  const [attachmentsExpanded, setAttachmentsExpanded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { addToast, ToastContainer } = useToast();

  // Hydrate pageId from router.query after mount (router is null during SSR/prerender)
  useEffect(() => {
    if (!router) return;
    const id = (router.query as { id?: string }).id;
    if (id) setPageId(id);
  }, [router]);

  interface Version {
    id: number;
    page_id: number;
    title: string;
    content: string;
    created_by: number | null;
    created_by_username: string | null;
    created_at: string;
  }

  interface Attachment {
    id: number;
    page_id: number;
    filename: string;
    file_path: string;
    file_size: number | null;
    mime_type: string | null;
    uploaded_by: number | null;
    uploaded_at: string;
  }

  const fetchPage = async () => {
    if (!pageId) return;
    const token = getToken();
    if (!token) {
      addToast('Требуется авторизация', 'error');
      window.location.href = '/login';
      return;
    }

    setLoading(true);
    try {
      const res = await axios.get<PageData>(`${API}/api/pages/${pageId ?? ''}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPageData(res.data);
      setEditTitle(res.data.title);
      setEditBlocks((Array.isArray(res.data.content) ? res.data.content : []) as Block[]);
    } catch (e) {
      const err = e as { response?: { data?: { error?: string }; status?: number } };
      const errorMsg = err.response?.data?.error || 'Не удалось загрузить страницу';
      setError(errorMsg);
      addToast(errorMsg, 'error');
      if (err.response?.status === 401) {
        window.location.href = '/login';
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchVersions = async () => {
    if (!pageId) return;
    const token = getToken();
    if (!token) return;
    setLoadingVersions(true);
    try {
      const res = await axios.get<Version[]>(`${API}/api/pages/${pageId ?? ''}/versions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setVersions(res.data);
    } catch {
      addToast('Не удалось загрузить историю версий', 'error');
    } finally {
      setLoadingVersions(false);
    }
  };

  const fetchAttachments = async () => {
    if (!pageId) return;
    const token = getToken();
    if (!token) return;
    setAttachmentsLoading(true);
    try {
      const res = await axios.get<Attachment[]>(`${API}/api/pages/${pageId ?? ''}/attachments`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAttachments(res.data);
    } catch {
      // Silently fail — attachments are non-critical
    } finally {
      setAttachmentsLoading(false);
    }
  };

  const handleUploadAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!pageId || !e.target.files?.length) return;
    const token = getToken();
    if (!token) return;

    const file = e.target.files[0];
    setAttachmentsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await axios.post<Attachment>(`${API}/api/pages/${pageId ?? ''}/attachments`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          // Note: do NOT set Content-Type with FormData — axios auto-sets it with boundary
        },
      });
      setAttachments(prev => [res.data, ...prev]);
      addToast('Файл прикреплён', 'success');
    } catch {
      addToast('Ошибка при загрузке файла', 'error');
    } finally {
      setAttachmentsUploading(false);
      // Reset file input so same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteAttachment = async (attachmentId: number) => {
    const token = getToken();
    if (!token) return;
    try {
      await axios.delete(`${API}/api/pages/${pageId ?? ''}/attachments/${attachmentId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAttachments(prev => prev.filter(a => a.id !== attachmentId));
      addToast('Вложение удалено', 'success');
    } catch {
      addToast('Ошибка удаления вложения', 'error');
    }
  };

  const formatFileSize = (bytes: number | null): string => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  useEffect(() => {
    if (!pageId) return;
    fetchPage();
    fetchAttachments();
  }, [pageId]);

  const handleEdit = () => {
    if (!pageData) return;
    // If already HTML (TipTap content), use it directly; otherwise convert legacy blocks
    const html =
      typeof pageData.content === 'string' && pageData.content.startsWith('<')
        ? pageData.content
        : blocksToHtml((pageData.content as Block[]) || []);
    setEditTitle(pageData.title);
    setEditBlocks((pageData.content as Block[]) || []);
    setEditHtml(html);
    setEditMode(true);
  };

  const handleCancel = () => {
    setEditMode(false);
    if (pageData) {
      setEditTitle(pageData.title);
      setEditBlocks((pageData.content as Block[]) || []);
      setEditHtml(typeof pageData.content === 'string' ? pageData.content : '');
    }
  };

  const handleSave = async () => {
    if (!pageId) return;
    const token = getToken();
    if (!token) return;

    setSaving(true);
    try {
      await axios.patch(`${API}/api/pages/${pageId ?? ''}`, {
        title: editTitle,
        content: editHtml,
      }, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      });
      addToast('Страница сохранена!', 'success');
      // Convert HTML back to blocks for internal state (view mode uses blocks)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setPageData({ ...pageData!, title: editTitle, content: editHtml as any });
      setEditMode(false);
    } catch (e) {
      const err = e as { response?: { data?: { error?: string } } };
      addToast('Ошибка сохранения: ' + (err.response?.data?.error || 'Неизвестная ошибка'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleBlockChange = (index: number, updated: Block) => {
    const newBlocks = [...editBlocks];
    newBlocks[index] = updated;
    setEditBlocks(newBlocks);
  };

  const handleBlockDelete = (index: number) => {
    setEditBlocks(editBlocks.filter((_, i) => i !== index));
  };

  const handleBlockMoveUp = (index: number) => {
    if (index === 0) return;
    const newBlocks = [...editBlocks];
    [newBlocks[index - 1], newBlocks[index]] = [newBlocks[index], newBlocks[index - 1]];
    setEditBlocks(newBlocks);
  };

  const handleBlockMoveDown = (index: number) => {
    if (index === editBlocks.length - 1) return;
    const newBlocks = [...editBlocks];
    [newBlocks[index], newBlocks[index + 1]] = [newBlocks[index + 1], newBlocks[index]];
    setEditBlocks(newBlocks);
  };

  const handleAddBlock = (type: Block['type']) => {
    const newBlock: Block = { type };
    if (type === 'text') {
      newBlock.text = '';
    } else if (type === 'heading') {
      newBlock.text = '';
    } else if (type === 'table') {
      newBlock.headers = ['Column 1', 'Column 2'];
      newBlock.rows = [['', '']];
    } else if (type === 'macro') {
      newBlock.macroName = 'chart';
      newBlock.macroProps = {};
    }
    setEditBlocks([...editBlocks, newBlock]);
  };

  const fetchVersionContent = async (versionId: number) => {
    const token = getToken();
    if (!token) return null;
    try {
      const res = await axios.get(`${API}/api/pages/${pageId ?? ''}/versions/${versionId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return res.data?.content ?? null;
    } catch {
      addToast('Не удалось загрузить содержимое версии', 'error');
      return null;
    }
  };

  const handleOpenVersions = async () => {
    setVersionsPanelOpen(true);
    setSelectedVersion(null);
    setSelectedVersionContent(null);
    await fetchVersions();
  };

  const handleSelectVersion = async (version: Version) => {
    if (selectedVersion?.id === version.id) {
      setSelectedVersion(null);
      setSelectedVersionContent(null);
      return;
    }
    setSelectedVersion(version);
    const content = await fetchVersionContent(version.id);
    setSelectedVersionContent(content);
  };

  const handleRollback = async (version: Version) => {
    if (!pageId) return;
    const token = getToken();
    if (!token) return;

    if (!confirm(`Откатить страницу к версии от ${new Date(version.created_at).toLocaleString('ru-RU')}? Текущий контент будет сохранён как новая версия.`)) {
      return;
    }

    setRollingBack(version.id);
    try {
      await axios.post(`${API}/api/pages/${pageId ?? ''}/rollback`, {
        versionId: version.id
      }, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      });
      addToast('Страница успешно откачена!', 'success');
      setVersionsPanelOpen(false);
      setSelectedVersion(null);
      setSelectedVersionContent(null);
      await fetchPage();
    } catch (e) {
      const err = e as { response?: { data?: { error?: string } } };
      addToast('Ошибка отката: ' + (err.response?.data?.error || 'Неизвестная ошибка'), 'error');
    } finally {
      setRollingBack(null);
    }
  };

  const handleBack = () => {
    if (router) router.back();
    else window.history.back();
  };

  const handleDelete = async () => {
    if (!confirm('Удалить эту страницу? Её можно будет восстановить из истории версий.')) return;
    const token = getToken();
    if (!token) { window.location.href = '/login'; return; }
    try {
      await axios.delete(`${API}/api/pages/${pageId ?? ''}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      addToast('Страница удалена', 'success');
      window.location.href = '/spaces';
    } catch (e) {
      const err = e as { response?: { data?: { error?: string } } };
      addToast(err.response?.data?.error || 'Не удалось удалить страницу', 'error');
    }
  };

  if (error || !pageData) {
    return (
      <div className={styles.container}>
        <ToastContainer />
        <div className={styles.pageContent}>
          <div className={styles.breadcrumb}>
            <Link href="/spaces" className={styles.breadcrumbItem}>
              Пространства
            </Link>
            <span className={styles.breadcrumbSeparator}>/</span>
            <span className={styles.breadcrumbCurrent}>Ошибка</span>
          </div>
          <div className={styles.emptyState}>
            <div className={styles.emptyStateIcon}>❌</div>
            <div className={styles.emptyStateTitle}>Не удалось загрузить страницу</div>
            <div className={styles.emptyStateText}>{error || 'Страница не найдена'}</div>
            <div style={{ marginTop: '24px' }}>
              <button
                className={styles.btnPrimary}
                onClick={handleBack}
              >
                ← Назад
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ========== EDIT MODE ==========
  if (editMode) {
    return (
      <div className={styles.container}>
        <ToastContainer />
        {versionsPanelOpen && (
          <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.4)',
            zIndex: 200,
            display: 'flex',
            justifyContent: 'flex-end',
          }}
            onClick={(e) => { if (e.target === e.currentTarget) { setVersionsPanelOpen(false); setSelectedVersion(null); setSelectedVersionContent(null); } }}
          >
            <div style={{
              width: Math.min(720, window.innerWidth),
              height: '100vh',
              background: '#fff',
              boxShadow: '-4px 0 24px rgba(0,0,0,0.15)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}>
              {/* Panel header */}
              <div style={{
                padding: '20px 24px',
                borderBottom: '1px solid #e5e7eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#f9fafb',
              }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#1f2937' }}>📜 История версий</h2>
                  <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#6b7280' }}>
                    Выберите версию для просмотра или отката
                  </p>
                </div>
                <button
                  onClick={() => { setVersionsPanelOpen(false); setSelectedVersion(null); setSelectedVersionContent(null); }}
                  style={{
                    padding: '8px 12px',
                    background: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    color: '#374151',
                  }}
                >
                  ✕ Закрыть
                </button>
              </div>

              {/* Panel body */}
              <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                {/* Version list */}
                <div style={{
                  width: 280,
                  borderRight: '1px solid #e5e7eb',
                  overflowY: 'auto',
                  background: '#fafafa',
                }}>
                  {loadingVersions ? (
                    <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>
                      ⏳ Загрузка...
                    </div>
                  ) : versions.length === 0 ? (
                    <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: '0.9rem' }}>
                      Версий пока нет.<br/>Они появятся после первого сохранения.
                    </div>
                  ) : (
                    versions.map((version) => {
                      const date = new Date(version.created_at);
                      const isSelected = selectedVersion?.id === version.id;
                      const isRollingBack = rollingBack === version.id;
                      return (
                        <div
                          key={version.id}
                          onClick={() => handleSelectVersion(version)}
                          style={{
                            padding: '14px 16px',
                            borderBottom: '1px solid #e5e7eb',
                            cursor: 'pointer',
                            background: isSelected ? '#eef2ff' : '#fff',
                            borderLeft: isSelected ? '3px solid #667eea' : '3px solid transparent',
                          }}
                        >
                          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                            {date.toLocaleDateString('ru-RU')}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: '#6b7280', marginBottom: 4 }}>
                            {date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                          {version.created_by_username && (
                            <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                              👤 {version.created_by_username}
                            </div>
                          )}
                          {isSelected && (
                            <div style={{ marginTop: 8 }}>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleRollback(version); }}
                                disabled={isRollingBack}
                                style={{
                                  width: '100%',
                                  padding: '7px 10px',
                                  background: isRollingBack ? '#fecaca' : '#fef2f2',
                                  border: '1px solid #fca5a5',
                                  borderRadius: 6,
                                  cursor: isRollingBack ? 'not-allowed' : 'pointer',
                                  color: '#dc2626',
                                  fontSize: '0.82rem',
                                  fontWeight: 600,
                                  opacity: isRollingBack ? 0.7 : 1,
                                }}
                              >
                                {isRollingBack ? '⏳ Откат...' : '↩ Откатить'}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Version preview */}
                <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
                  {!selectedVersion ? (
                    <div style={{ textAlign: 'center', color: '#9ca3af', marginTop: 80 }}>
                      <div style={{ fontSize: '3rem', marginBottom: 16 }}>👈</div>
                      <p style={{ fontSize: '0.95rem' }}>Выберите версию слева,<br/>чтобы увидеть её содержимое</p>
                    </div>
                  ) : !selectedVersionContent ? (
                    <div style={{ textAlign: 'center', color: '#9ca3af', marginTop: 80 }}>
                      <div style={{ fontSize: '2rem', marginBottom: 12 }}>⏳</div>
                      <p>Загрузка содержимого...</p>
                    </div>
                  ) : (
                    <div>
                      <div style={{ marginBottom: 16 }}>
                        <h3 style={{ margin: '0 0 4px', fontSize: '1rem', color: '#1f2937' }}>
                          Версия от {new Date(selectedVersion.created_at).toLocaleString('ru-RU')}
                        </h3>
                        {selectedVersion.created_by_username && (
                          <p style={{ margin: 0, fontSize: '0.82rem', color: '#6b7280' }}>
                            Автор: {selectedVersion.created_by_username}
                          </p>
                        )}
                      </div>
                      <div
                        style={{
                          border: '1px solid #e5e7eb',
                          borderRadius: 8,
                          padding: 20,
                          background: '#fff',
                          maxHeight: 400,
                          overflowY: 'auto',
                          lineHeight: 1.6,
                          fontSize: '0.92rem',
                          color: '#374151',
                        }}
                        dangerouslySetInnerHTML={{ __html: selectedVersionContent }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        <div className={styles.pageContent}>
          {/* Breadcrumbs */}
          <div className={styles.breadcrumb}>
            <Link href="/spaces" className={styles.breadcrumbItem}>
              Пространства
            </Link>
            <span className={styles.breadcrumbSeparator}>/</span>
            <span className={styles.breadcrumbCurrent}>Редактирование</span>
          </div>

          {/* Title editor */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: '0.85rem', color: '#6b7280', marginBottom: 6, fontWeight: 500 }}>
              Название страницы
            </label>
            <input
              type="text"
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                border: '2px solid #667eea',
                borderRadius: 8,
                fontSize: '1.25rem',
                fontWeight: 600,
                boxSizing: 'border-box',
                color: '#1f2937',
                background: '#fff',
              }}
            />
          </div>

          {/* Rich text editor */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: 8, fontWeight: 500 }}>
              Содержимое страницы
            </div>
            <RichTextEditor
              content={editHtml}
              onChange={setEditHtml}
              placeholder="Начните писать содержимое страницы..."
            />
          </div>

          {/* Action buttons */}
          <div className={styles.actions}>
            <button
              className={styles.btnSave}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? '⏳ Сохранение...' : '💾 Сохранить'}
            </button>
            <button
              className={styles.btnSecondary}
              onClick={handleOpenVersions}
              title="История версий"
            >
              📜 История
            </button>
            <button
              className={styles.btnSecondary}
              onClick={handleCancel}
              disabled={saving}
            >
              ✕ Отмена
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ========== VIEW MODE ==========
  return (
    <div className={styles.container}>
      <ToastContainer />
      <div className={styles.pageContent}>
        {/* Breadcrumbs */}
        <div className={styles.breadcrumb}>
          <Link href="/spaces" className={styles.breadcrumbItem}>
            Пространства
          </Link>
          <span className={styles.breadcrumbSeparator}>/</span>
          <span className={styles.breadcrumbCurrent}>{pageData.title}</span>
        </div>

        {/* Page Title */}
        <h1 className={styles.previewTitle} style={{ marginBottom: '24px' }}>
          {pageData.title}
        </h1>

        {/* Page Content */}
        {typeof pageData.content === 'string' && pageData.content.startsWith('<') ? (
          <div
            className={styles.pageContent}
            style={{ lineHeight: 1.7 }}
            dangerouslySetInnerHTML={{ __html: pageData.content as string }}
          />
        ) : pageData.content && (pageData.content as Block[]).length > 0 ? (
          (pageData.content as Block[]).map((block, index) => renderBlock(block, index))
        ) : (
          <div style={{
            padding: '32px',
            textAlign: 'center',
            color: '#9ca3af',
            fontSize: '0.95rem',
          }}>
            Страница пуста
          </div>
        )}

        {/* Attachments Section */}
        <div style={{
          marginTop: 32,
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          overflow: 'hidden',
        }}>
          {/* Attachments header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            background: '#f9fafb',
            borderBottom: '1px solid #e5e7eb',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '1.1rem' }}>📎</span>
              <span style={{ fontWeight: 600, fontSize: '0.95rem', color: '#374151' }}>
                Вложения
              </span>
              {attachments.length > 0 && (
                <span style={{
                  background: '#e0e7ff',
                  color: '#3730a3',
                  borderRadius: 12,
                  padding: '1px 8px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                }}>
                  {attachments.length}
                </span>
              )}
            </div>
            <button
              onClick={() => setAttachmentsExpanded(!attachmentsExpanded)}
              style={{
                padding: '4px 10px',
                background: '#fff',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: '0.82rem',
                color: '#374151',
              }}
            >
              {attachmentsExpanded ? '▲ Скрыть' : '▼ Показать'}
            </button>
          </div>

          {attachmentsExpanded && (
            <div style={{ padding: 16 }}>
              {/* Upload button */}
              <div style={{ marginBottom: 16 }}>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleUploadAttachment}
                  style={{ display: 'none' }}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={attachmentsUploading}
                  style={{
                    padding: '8px 16px',
                    background: attachmentsUploading ? '#9ca3af' : '#4f46e5',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    cursor: attachmentsUploading ? 'not-allowed' : 'pointer',
                    fontSize: '0.9rem',
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  {attachmentsUploading ? '⏳ Загрузка...' : '⬆️ Прикрепить файл'}
                </button>
              </div>

              {/* Attachment list */}
              {attachmentsLoading ? (
                <div style={{ color: '#9ca3af', fontSize: '0.9rem', textAlign: 'center', padding: '16px 0' }}>
                  ⏳ Загрузка вложений...
                </div>
              ) : attachments.length === 0 ? (
                <div style={{ color: '#9ca3af', fontSize: '0.9rem', textAlign: 'center', padding: '16px 0' }}>
                  Файлов пока нет. Нажмите «Прикрепить файл» выше.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {attachments.map((att) => {
                    const isImage = att.mime_type?.startsWith('image/');
                    const icon = isImage ? '🖼️' : att.mime_type?.includes('pdf') ? '📄' : '📎';
                    return (
                      <div
                        key={att.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '10px 12px',
                          background: '#f9fafb',
                          border: '1px solid #e5e7eb',
                          borderRadius: 6,
                        }}
                      >
                        <span style={{ fontSize: '1.2rem' }}>{icon}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: '0.9rem',
                            fontWeight: 500,
                            color: '#1f2937',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}>
                            {att.filename}
                          </div>
                          {att.file_size && (
                            <div style={{ fontSize: '0.78rem', color: '#9ca3af' }}>
                              {formatFileSize(att.file_size)}
                            </div>
                          )}
                        </div>
                        <a
                          href={`${API}${att.file_path}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            padding: '4px 10px',
                            background: '#fff',
                            border: '1px solid #d1d5db',
                            borderRadius: 4,
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            color: '#374151',
                            textDecoration: 'none',
                          }}
                        >
                          Скачать
                        </a>
                        <button
                          onClick={() => handleDeleteAttachment(att.id)}
                          style={{
                            padding: '4px 8px',
                            background: '#fef2f2',
                            border: '1px solid #fecaca',
                            borderRadius: 4,
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            color: '#ef4444',
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className={styles.actions} style={{ marginTop: '32px' }}>
          <button
            className={styles.btnPrimary}
            onClick={handleEdit}
          >
            ✏️ Редактировать
          </button>
          <button
            className={styles.btnDanger}
            onClick={handleDelete}
          >
            🗑 Удалить
          </button>
          <button
            className={styles.btnSecondary}
            onClick={handleBack}
          >
            ← Назад
          </button>
        </div>
      </div>
    </div>
  );
};
