export const dynamic = 'force-dynamic';
import { useState, useEffect, useLayoutEffect, createContext, useContext, useCallback, type ReactNode, type CSSProperties } from 'react';
import { useRouter } from 'next/router';
import type { Space, Page, PageBlock } from '../types/api';
import ThemeToggle from '../components/ThemeToggle';
import AIAssistant from '../components/AIAssistant';
import NotificationPanel from '../components/NotificationPanel';
import {
  SquaresFour, Bell, MagnifyingGlass, FileText, Sparkle, Gear, Robot,
  CaretDown, CaretRight, Trash, MagicWand, Rocket, PaperPlaneTilt, CircleNotch,
  Info, Lightbulb, NotePencil, Warning, CheckCircle, XCircle,
  User, CalendarBlank, ChartBar, ListBullets, Table, Tag, FolderOpen,
  Cards, ChartLineUp, Package, Copy, PencilSimple,
  Target, PushPin, VideoCamera, FileArrowDown, Lightning,
} from '@phosphor-icons/react';

const AppContext = createContext<AppContextValue | null>(null);

const API = typeof window !== 'undefined' ? 'http://' + window.location.hostname + ':8081' : '';

function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppContext.Provider');
  return ctx;
}

interface ApiResult {
  [key: string]: unknown;
}

async function api(method: string, path: string, body?: unknown, token?: string | null): Promise<ApiResult> {
  const opts: RequestInit = { method, headers: { 'Content-Type': 'application/json' } };
  if (token) opts.headers = { ...opts.headers, Authorization: 'Bearer ' + token };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(API + path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || res.statusText);
  return data;
}

function asNode(val: unknown): React.ReactNode {
  return val as React.ReactNode;
}

function getToken(): string | null {
  return typeof window !== 'undefined' ? localStorage.getItem('token') : null;
}

// ============ FOCUS TRAP & KEYBOARD HOOK ============
function useFocusTrap(containerRef: React.RefObject<HTMLElement>, active: boolean) {
  useEffect(() => {
    if (!active || !containerRef.current) return;
    const el = containerRef.current;
    const focusable = el.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    first?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    };
    el.addEventListener('keydown', handler);
    return () => el.removeEventListener('keydown', handler);
  }, [active, containerRef]);
}

function useKeyboardSelect<T extends { id: number | string }>(
  items: T[],
  selectedId: number | string | null,
  onSelect: (item: T) => void,
) {
  const handleKey = useCallback((e: React.KeyboardEvent, item: T) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(item); }
  }, [onSelect]);
  return handleKey;
}

// ============ MOBILE HOOK ============
function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useLayoutEffect(() => {
    const sync = () => setIsMobile(window.innerWidth < 768);
    sync();
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  }, []);

  return isMobile;
}

// ============ SIDEBAR ============

interface SidebarProps {
  isMobile: boolean;
  open: boolean;
  setOpen: (open: boolean) => void;
}

function Sidebar({ isMobile, open, setOpen }: SidebarProps) {
  const router = typeof window !== 'undefined' ? useRouter() : null;
  const { spaces, pages, selectedSpace, selectedPage, sidebarSearch, setSidebarSearch, selectSpace, selectPage, loadSpaces, setShowSettings, setShowAIAssistant, setShowNotificationPanel } = useApp();
  const [spaceInput, setSpaceInput] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [hoveredSpace, setHoveredSpace] = useState<number | null>(null);
  const [hoveredPage, setHoveredPage] = useState<string | null>(null);
  const [hoveredNewSpace, setHoveredNewSpace] = useState(false);

  const pageResults = sidebarSearch.length > 0
    ? pages.filter(p => p.title.toLowerCase().includes(sidebarSearch.toLowerCase()))
    : null;

  const grouped: Record<number, Space & { pages: Page[] }> = {};
  spaces.forEach(s => { grouped[s.id] = { ...s, pages: [] }; });
  pages.forEach(p => { if (p.space_id && grouped[p.space_id]) grouped[p.space_id].pages.push(p); });

  const createSpace = async () => {
    const token = getToken();
    if (!token || !spaceInput.trim()) return;
    const slug = spaceInput.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    try {
      const sp = await api('POST', '/api/spaces', { name: spaceInput, slug }, token) as unknown as Space;
      await loadSpaces();
      selectSpace(sp.id);
      setSpaceInput('');
      setShowNew(false);
    } catch (e) {
      alert('Ошибка: ' + (e as Error).message);
    }
  };

  const sidebarStyle: React.CSSProperties = {
    width: 280, minWidth: 280, background: 'var(--color-surface, #fff)',
    borderRight: isMobile ? 'none' : '1px solid var(--color-border)',
    display: 'flex', flexDirection: 'column', overflow: 'hidden', height: '100%',
    ...(isMobile ? {
      position: 'fixed', left: 0, top: 0, bottom: 0, zIndex: 2000,
      transform: open ? 'translateX(0)' : 'translateX(-100%)',
      transition: 'transform 0.2s ease',
      boxShadow: open ? '4px 0 20px rgba(0,0,0,0.15)' : 'none',
    } : {})
  };

  return (
    <>
    <aside style={sidebarStyle} role="navigation" aria-label="Основная навигация">
      <div style={S.logo}>
        <span style={{ display: 'grid', placeItems: 'center', width: 28, height: 28, borderRadius: 8, background: 'var(--color-primary)', color: '#fff', flexShrink: 0 }}>
          <SquaresFour size={17} weight="fill" />
        </span>
        <span style={{ flex: 1 }}>AI Portal</span>
        <button
          onClick={() => setShowNotificationPanel(v => !v)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', padding: '4px', borderRadius: 6, color: 'var(--color-text-secondary)' }}
          title="Уведомления"
          aria-label="Уведомления"
        >
          <Bell size={18} />
        </button>
        <ThemeToggle />
      </div>

      <div style={S.searchWrap}>
        <label htmlFor="sidebar-search" style={{ marginRight: 6, display: 'flex', alignItems: 'center', color: 'var(--color-text-muted)' }}>
          <MagnifyingGlass size={16} aria-hidden="true" />
          <span style={srOnly}>Поиск страниц</span>
        </label>
        <input
          id="sidebar-search"
          style={S.searchInput}
          placeholder="Поиск страниц..."
          value={sidebarSearch}
          onChange={e => setSidebarSearch(e.target.value)}
          aria-label="Поиск страниц"
          aria-controls="sidebar-nav"
        />
        {sidebarSearch && (
          <button
            style={S.searchClear}
            onClick={() => setSidebarSearch('')}
            aria-label="Очистить поиск"
          >×</button>
        )}
      </div>

      <div style={S.nav} id="sidebar-nav" role="tree" aria-label="Пространства и страницы">
        {!sidebarSearch ? (
          Object.values(grouped).map(space => (
            <div key={space.id} role="treeitem" aria-expanded={selectedSpace === space.id} aria-label={space.name}>
              <div
                style={{
                  ...S.spaceRow,
                  ...(selectedSpace === space.id ? S.spaceRowActive : {}),
                  ...(hoveredSpace === space.id && selectedSpace !== space.id ? S.spaceRowHover : {}),
                }}
                onMouseEnter={() => setHoveredSpace(space.id)}
                onMouseLeave={() => setHoveredSpace(null)}
                onClick={() => selectSpace(selectedSpace === space.id ? null : space.id)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    selectSpace(selectedSpace === space.id ? null : space.id);
                  }
                }}
                role="button"
                tabIndex={0}
                aria-pressed={selectedSpace === space.id}
              >
                <span aria-hidden="true" style={{ display: 'inline-flex', color: 'var(--color-text-muted)' }}>{selectedSpace === space.id ? <CaretDown size={12} weight="bold" /> : <CaretRight size={12} weight="bold" />}</span>
                <a
                  href={`/spaces/${space.id}`}
                  style={S.spaceName}
                  onClick={e => { e.preventDefault(); router ? router.push(`/spaces/${space.id}`) : (window.location.href = `/spaces/${space.id}`); }}
                  title={`Открыть пространство: ${space.name}`}
                >
                  {space.name}
                </a>
              </div>
              {selectedSpace === space.id && (
                <div style={S.pageList} role="group">
                  {space.pages.length > 0 ? space.pages.map(page => (
                    <div key={page.id}
                      style={{
                        ...S.pageRow,
                        ...(selectedPage?.id === page.id ? S.pageRowActive : {}),
                        ...(hoveredPage === String(page.id) && selectedPage?.id !== page.id ? S.pageRowHover : {}),
                      }}
                      onMouseEnter={() => setHoveredPage(String(page.id))}
                      onMouseLeave={() => setHoveredPage(null)}
                      onClick={() => selectPage(page)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          selectPage(page);
                        }
                      }}
                      role="treeitem"
                      tabIndex={0}
                      aria-selected={selectedPage?.id === page.id}
                      aria-label={page.title}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><FileText size={15} weight="duotone" style={{ flexShrink: 0, color: 'var(--color-text-muted)' }} />{page.title}</span>
                    </div>
                  )) : <div style={S.emptyHint} aria-live="polite">Нет страниц</div>}
                </div>
              )}
            </div>
          ))
        ) : (
          pageResults && pageResults.length > 0 ? pageResults.map(page => (
            <div key={page.id}
              style={{
                ...S.pageRow,
                ...(selectedPage?.id === page.id ? S.pageRowActive : {}),
                ...(hoveredPage === String(page.id) && selectedPage?.id !== page.id ? S.pageRowHover : {}),
              }}
              onMouseEnter={() => setHoveredPage(String(page.id))}
              onMouseLeave={() => setHoveredPage(null)}
              onClick={() => selectPage(page)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectPage(page); }
              }}
              role="treeitem"
              tabIndex={0}
              aria-selected={selectedPage?.id === page.id}
              aria-label={page.title}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><FileText size={15} weight="duotone" style={{ flexShrink: 0, color: 'var(--color-text-muted)' }} />{page.title}</span>
            </div>
          )) : <div style={S.emptyHint} aria-live="polite">Ничего не найдено</div>
        )}
        {spaces.length === 0 && <div style={S.emptyHint}>Создай первое пространство ↓</div>}
      </div>

      {!showNew ? (
        <button
          style={{
            ...S.btnNewSpace,
            ...(hoveredNewSpace ? S.btnNewSpaceHover : {}),
          }}
          onMouseEnter={() => setHoveredNewSpace(true)}
          onMouseLeave={() => setHoveredNewSpace(false)}
          onClick={() => setShowNew(true)}
        >+ Новое пространство</button>
      ) : (
        <div style={S.newSpaceForm}>
          <input style={S.spaceInput} placeholder="Название" value={spaceInput}
            onChange={e => setSpaceInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && createSpace()} autoFocus />
          <div style={{ display: 'flex', gap: 4 }}>
            <button style={S.btnSave} onClick={createSpace}>Создать</button>
            <button style={S.btnCancel} onClick={() => { setShowNew(false); setSpaceInput(''); }}>✕</button>
          </div>
        </div>
      )}

      {/* AI Assistant + Settings buttons */}
      <div style={{ marginTop: 'auto', borderTop: '1px solid var(--color-border)', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <button
          style={{ width: '100%', padding: '8px 12px', background: 'none', border: '1px solid var(--color-border)', borderRadius: 6, cursor: 'pointer', fontSize: '0.88rem', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}
          onClick={() => setShowAIAssistant(true)}
        >
          <Sparkle size={16} weight="fill" />AI-ассистент
        </button>
        <button
          style={{ width: '100%', padding: '8px 12px', background: 'none', border: '1px solid var(--color-border)', borderRadius: 6, cursor: 'pointer', fontSize: '0.88rem', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}
          onClick={() => setShowSettings(true)}
        >
          <Gear size={16} weight="fill" />Настройки AI
        </button>
      </div>
    </aside>
    {isMobile && open && (
      <div
        onClick={() => setOpen(false)}
        style={{ position:'fixed',top:0,left:0,right:0,bottom:0,zIndex:1999,background:'rgba(0,0,0,0.4)' }}
      />
    )}
    </>
  );
}

// ============ MACRO RENDERER ============

function asArray<T>(val: T | T[] | undefined | null): T[] {
  return Array.isArray(val) ? val : [];
}

interface MacroProps {
  macroName?: string;
  macroProps?: Record<string, unknown>;
  content?: unknown;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MACRO_STYLES: Record<string, CSSProperties | Record<string, CSSProperties>> = {
  panel: {
    info:    { background: 'var(--color-panel-info-bg)', borderLeft: '4px solid var(--color-panel-info-border)', borderRadius: 4, padding: '12px 16px', margin: '12px 0', color: 'var(--color-panel-info-text)' },
    tip:     { background: 'var(--color-panel-tip-bg)', borderLeft: '4px solid var(--color-panel-tip-border)', borderRadius: 4, padding: '12px 16px', margin: '12px 0', color: 'var(--color-panel-tip-text)' },
    note:    { background: 'var(--color-panel-note-bg)', borderLeft: '4px solid var(--color-panel-note-border)', borderRadius: 4, padding: '12px 16px', margin: '12px 0', color: 'var(--color-panel-note-text)' },
    warning: { background: 'var(--color-panel-warning-bg)', borderLeft: '4px solid var(--color-panel-warning-border)', borderRadius: 4, padding: '12px 16px', margin: '12px 0', color: 'var(--color-panel-warning-text)' },
  },
  status: {
    done:    { background: 'var(--color-status-done-bg)', color: 'var(--color-status-done-text)', fontSize: '0.82rem', padding: '3px 10px', borderRadius: 9999, fontWeight: 600, display: 'inline-block', marginRight: 6, marginBottom: 4 },
    in_progress: { background: 'var(--color-status-inprogress-bg)', color: 'var(--color-status-inprogress-text)', fontSize: '0.82rem', padding: '3px 10px', borderRadius: 9999, fontWeight: 600, display: 'inline-block', marginRight: 6, marginBottom: 4 },
    blocked: { background: 'var(--color-status-blocked-bg)', color: 'var(--color-status-blocked-text)', fontSize: '0.82rem', padding: '3px 10px', borderRadius: 9999, fontWeight: 600, display: 'inline-block', marginRight: 6, marginBottom: 4 },
    default: { background: 'var(--color-background-alt)', color: 'var(--color-text-secondary)', fontSize: '0.82rem', padding: '3px 10px', borderRadius: 9999, fontWeight: 600, display: 'inline-block', marginRight: 6, marginBottom: 4 },
  },
  expand: { background: 'var(--color-background-alt)', border: '1px solid var(--color-border)', borderRadius: 6, margin: '8px 0', overflow: 'hidden' },
  decision: { background: 'var(--color-surface)', border: '1px solid var(--color-primary)', borderRadius: 8, padding: '12px 16px', margin: '12px 0' },
  mention: { background: 'var(--color-panel-info-bg)', border: '1px solid var(--color-panel-info-border)', borderRadius: 4, padding: '2px 8px', fontSize: '0.85rem', color: 'var(--color-panel-info-text)', display: 'inline-block' },
  quote:   { borderLeft: '4px solid var(--color-border)', padding: '8px 16px', margin: '12px 0', color: 'var(--color-text-secondary)', fontStyle: 'italic', background: 'var(--color-background-alt)' },
  divider: { borderBottom: '2px solid var(--color-border)', margin: '20px 0' },
  video:   { borderRadius: 8, overflow: 'hidden', margin: '12px 0', border: '1px solid var(--color-border)' },
};

const MACRO_ICONS: Record<string, ReactNode> = {
  info: <Info size={16} weight="fill" />,
  tip: <Lightbulb size={16} weight="fill" />,
  note: <NotePencil size={16} weight="fill" />,
  warning: <Warning size={16} weight="fill" />,
};

interface ExpandBlockProps {
  title: string;
  children?: React.ReactNode;
}

function ExpandBlock({ title, children }: ExpandBlockProps) {
  const [open, setOpen] = useState(false);
  return (
    <div style={MACRO_STYLES.expand}>
      <button onClick={() => setOpen(!open)} style={{ display:'flex',alignItems:'center',gap:8,width:'100%',border:'none',background:'var(--color-background-alt)',padding:'10px 14px',cursor:'pointer',fontSize:'0.9rem',fontWeight:600,color:'var(--color-text-secondary)',textAlign:'left' }}>
        <span style={{ display: 'inline-flex' }}>{open ? <CaretDown size={13} weight="bold" /> : <CaretRight size={13} weight="bold" />}</span> {title}
      </button>
      {open && <div style={{ padding:'12px 14px',borderTop:'1px solid var(--color-border)',fontSize:'0.9rem',color:'var(--color-text)' }}>{children}</div>}
    </div>
  );
}

interface MacroRendererProps {
  macro: MacroProps;
}

function MacroRenderer({ macro }: MacroRendererProps) {
  const name = (macro.macroName || '').toLowerCase();
  const p = macro.macroProps || {};

  // Panel / Info / Tip / Note / Warning
  if (['panel','info','tip','note','warning'].includes(name)) {
    const variant = name === 'panel' ? ((p.variant as string) || 'info') : name;
    const style = (MACRO_STYLES.panel as any)[variant] || (MACRO_STYLES.panel as any).info;
    return (
      <div style={style}>
        <strong style={{display:'flex',alignItems:'center',gap:'6px'}}>
          <span style={{ display: 'inline-flex' }}>{MACRO_ICONS[variant] || <Info size={16} weight="fill" />}</span> {String(p.title || variant.charAt(0).toUpperCase() + variant.slice(1))}
        </strong>
        {p.children ? <p style={{margin:'8px 0 0'}}>{String(p.children)}</p> : null}
      </div>
    );
  }

  // Status badge
  if (name === 'status') {
    const status = ((p.status || p.value || 'default') as string).toLowerCase().replace(/\s+/g, '_');
    const labels: Record<string, string> = { done: '✓ Done', in_progress: '◐ In Progress', blocked: '✗ Blocked', review: '◇ In Review', testing: '⧗ Testing' };
    return <span style={(MACRO_STYLES.status as any)[status] || (MACRO_STYLES.status as any).default}>{labels[status] || String(p.label || p.status || p.value)}</span>;
  }

  // Expand
  if (name === 'expand') {
    return <ExpandBlock title={String(p.title || 'Подробнее')} children={p.children as React.ReactNode} />;
  }

  // Decision
  if (name === 'decision') {
    return (
      <div style={MACRO_STYLES.decision}>
        <div style={{display:'flex',alignItems:'center',gap:'6px',fontWeight:600,color:'var(--color-primary)',marginBottom:6}}><Target size={16} weight="duotone" />Решение</div>
        {p.description ? <p style={{margin:0,color:'var(--color-text)'}}>{String(p.description)}</p> : null}
        {(Boolean(p.author) || Boolean(p.date) || Boolean(p.status)) && (
          <div style={{marginTop:8,fontSize:'0.82rem',color:'var(--color-text-secondary)',display:'flex',gap:12,flexWrap:'wrap'}}>
            {(p.author ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><User size={14} weight="fill" />{String(p.author)}</span> : null) as React.ReactNode}
            {(p.date ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><CalendarBlank size={14} weight="fill" />{String(p.date)}</span> : null) as React.ReactNode}
            {(p.status ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><PushPin size={13} weight="fill" />{String(p.status)}</span> : null) as React.ReactNode}
          </div>
        )}
      </div>
    );
  }

  // Mention
  if (name === 'mention') {
    return <span style={{ ...MACRO_STYLES.mention, display: 'inline-flex', alignItems: 'center', gap: 4 }}><User size={13} weight="fill" />{String(p.name || p.user || p.username)}</span>;
  }

  // Quote
  if (name === 'quote' || name === 'blockquote') {
    return <div style={MACRO_STYLES.quote}>{String(p.children || p.text || macro.content || '')}</div>;
  }

  // Divider
  if (['divider','separator','hr'].includes(name)) {
    return <hr style={MACRO_STYLES.divider} />;
  }

  // Video embed
  if (['video','multimedia','embed'].includes(name)) {
    const src = String(p.src || p.url || p.embedUrl || '');
    if (!src) return <div style={{margin:'12px 0',color:'var(--color-text-muted)'}}>Видео не указано</div>;
    return (
      <div style={{background:'var(--color-surface)',border:'1px solid var(--color-border)',borderRadius:8,padding:16,margin:'12px 0'}}>
        <strong style={{display:'flex',alignItems:'center',gap:6,marginBottom:12,color:'var(--color-text-secondary)'}}><VideoCamera size={16} weight="duotone" />{String(p.title || 'Video')}</strong>
        <div style={{position:'relative',paddingBottom:'56.25%',height:0,overflow:'hidden',borderRadius:8}}>
          <iframe src={src} style={{position:'absolute',top:0,left:0,width:'100%',height:'100%',border:'none'}} allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope" allowFullScreen title={String(p.title||'Video')} />
        </div>
        {p.description ? <p style={{margin:'8px 0 0',fontSize:'0.85rem',color:'var(--color-text-secondary)'}}>{String(p.description)}</p> : null}
      </div>
    );
  }

  // TOC
  if (name === 'toc' || name === 'table_of_contents') {
    return (
      <div style={{background:'var(--color-background-alt)',border:'1px solid var(--color-border)',borderRadius:8,padding:'16px',margin:'12px 0'}}>
        <strong style={{display:'flex',alignItems:'center',gap:'6px',color:'var(--color-text-secondary)',marginBottom:8}}><ListBullets size={16} weight="duotone" />Оглавление</strong>
        {p.children ? <ol style={{margin:0,paddingLeft:20,color:'var(--color-text-secondary)'}}>{asNode(p.children)}</ol> : <span style={{color:'var(--color-text-muted)',fontSize:'0.85rem'}}>Автоматическое оглавление</span>}
      </div>
    );
  }

  // Code block (macro version)
  if (name === 'code') {
    return <pre style={{background:'var(--color-background-alt)',border:'1px solid var(--color-border)',borderRadius:6,padding:12,fontSize:'0.85rem',overflowX:'auto',color:'var(--color-text-secondary)'}}>{String(p.code || p.content || p.children || '')}</pre>;
  }

  // Chart macro
  if (name === 'chart') {
    if (p.type === 'pie') {
      const data = p.data as { values?: number[]; labels?: string[] } | undefined;
      const values = data?.values || [];
      const labels = data?.labels || [];
      const total = values.reduce((a, b) => a + b, 0) || 1;
      let cumAngle = 0;
      const colors = ['#2563eb','#22c55e','#f59e0b','#ef4444','#3b82f6','#0ea5e9','#f43f5e','#14b8a6'];
      const slices = labels.map((label, idx) => {
        const val = values[idx] || 0;
        const pct = val / total;
        const startAngle = cumAngle * 2 * Math.PI;
        cumAngle += pct;
        const endAngle = cumAngle * 2 * Math.PI;
        const largeArc = pct > 0.5 ? 1 : 0;
        const r = 60;
        const cx = 70, cy = 70;
        const x1 = cx + r * Math.cos(startAngle - Math.PI / 2);
        const y1 = cy + r * Math.sin(startAngle - Math.PI / 2);
        const x2 = cx + r * Math.cos(endAngle - Math.PI / 2);
        const y2 = cy + r * Math.sin(endAngle - Math.PI / 2);
        const pathData = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
        return { label, value: val, pct: Math.round(pct * 100), color: colors[idx % colors.length], pathData };
      });
      return (
        <div style={{background:'var(--color-surface)',border:'1px solid var(--color-border)',borderRadius:8,padding:16,margin:'12px 0'}}>
          <strong style={{display:'flex',alignItems:'center',gap:6,marginBottom:12}}><ChartBar size={16} weight="duotone" />{String(p.title || 'Chart')}</strong>
          <div style={{display:'flex',alignItems:'center',gap:16,flexWrap:'wrap'}}>
            <svg viewBox="0 0 140 140" style={{width:140,height:140}}>
              {slices.map((s, idx) => <path key={idx} d={s.pathData} fill={s.color} stroke="#fff" strokeWidth="1"/>)}
            </svg>
            <div style={{display:'flex',flexDirection:'column',gap:4,fontSize:'0.85rem'}}>
              {slices.map((s, idx) => (
                <div key={idx} style={{display:'flex',alignItems:'center',gap:6}}>
                  <span style={{width:10,height:10,borderRadius:2,background:s.color,display:'inline-block'}}/>
                  <span style={{color:'var(--color-text-secondary)'}}>{s.label}</span>
                  <span style={{color:'var(--color-text-secondary)'}}>{s.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }
    // bar chart (default)
    const barData = p.data as { values?: number[]; labels?: string[] } | undefined;
    return (
      <div style={{background:'var(--color-surface)',border:'1px solid var(--color-border)',borderRadius:8,padding:16,margin:'12px 0'}}>
        <strong style={{display:'flex',alignItems:'center',gap:6,marginBottom:12}}><ChartBar size={16} weight="duotone" />{String(p.title || 'Chart')}</strong>
        {(barData?.labels || []).map((label, idx) => {
          const maxVal = Math.max(...(barData?.values || [1]));
          const pct = Math.min(((barData?.values?.[idx] || 0) / maxVal) * 100, 100);
          const colors = ['#2563eb','#22c55e','#f59e0b','#ef4444','#3b82f6','#0ea5e9','#f43f5e','#14b8a6'];
          return (
            <div key={idx} style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}>
              <span style={{width:120,fontSize:'0.85rem',color:'var(--color-text-secondary)',textAlign:'right'}}>{label}</span>
              <div style={{flex:1,background:'var(--color-background-alt)',borderRadius:4,height:20,overflow:'hidden'}}>
                <div style={{width:`${pct}%`,height:'100%',background:colors[idx%colors.length],borderRadius:4,transition:'width 0.5s'}}/>
              </div>
              <span style={{fontSize:'0.85rem',color:'var(--color-text-secondary)',width:40}}>{barData?.values?.[idx]}%</span>
            </div>
          );
        })}
      </div>
    );
  }

  // Progress macro
  if (name === 'progress') {
    const pct = Math.min(Math.max((p.percent as number) || 0, 0), 100);
    const color = pct >= 70 ? '#22c55e' : pct >= 40 ? '#f59e0b' : '#ef4444';
    return (
      <div style={{background:'var(--color-surface)',border:'1px solid var(--color-border)',borderRadius:8,padding:16,margin:'12px 0'}}>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
          <strong style={{fontSize:'0.95rem',color:'var(--color-text-secondary)'}}>{String(p.title || 'Прогресс')}</strong>
          <span style={{fontSize:'0.9rem',fontWeight:600,color}}>{pct}%</span>
        </div>
        <div style={{background:'var(--color-background-alt)',borderRadius:4,height:8,overflow:'hidden'}}>
          <div style={{width:`${pct}%`,height:'100%',background:color,borderRadius:4,transition:'width 0.5s'}}/>
        </div>
      </div>
    );
  }

  // Calendar macro
  if (name === 'calendar') {
    const events = asArray(p.events);
    return (
      <div style={{background:'var(--color-surface)',border:'1px solid var(--color-border)',borderRadius:8,padding:16,margin:'12px 0'}}>
        <strong style={{display:'flex',alignItems:'center',gap:6,marginBottom:12,color:'var(--color-text-secondary)'}}><CalendarBlank size={16} weight="duotone" />{String(p.title || 'Календарь')}</strong>
        {events.map((ev: unknown, idx: number) => {
          const event = ev as { date?: string; title?: string };
          return (
            <div key={idx} style={{display:'flex',alignItems:'center',gap:12,marginBottom:8,padding:8,background:'var(--color-background-alt)',borderRadius:6}}>
              <span style={{background:'#667eea',color:'#fff',borderRadius:6,padding:'4px 8px',fontSize:'0.8rem',fontWeight:600}}>{String(event.date || '')}</span>
              <span style={{fontSize:'0.9rem',color:'var(--color-text-secondary)'}}>{String(event.title || '')}</span>
            </div>
          );
        })}
      </div>
    );
  }

  // Livesearch / Search macro
  if (name === 'livesearch' || name === 'search') {
    const [q, setQ] = useState('');
    const [results, setResults] = useState<ApiResult[]>([]);
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

    const doSearch = async (query: string) => {
      if (!query.trim()) { setResults([]); return; }
      try {
        const res = await fetch('http://' + window.location.hostname + ':8081/api/pages/search?q=' + encodeURIComponent(query), { headers: token ? { Authorization: 'Bearer ' + token } : {} });
        const data = await res.json();
        setResults((data.results || data.hits || []) as ApiResult[]);
      } catch(e) { setResults([]); }
    };

    return (
      <div style={{background:'var(--color-surface)',border:'1px solid var(--color-border)',borderRadius:8,padding:16,margin:'12px 0'}}>
        <strong style={{display:'flex',alignItems:'center',gap:6,marginBottom:8,color:'var(--color-text-secondary)'}}><MagnifyingGlass size={16} weight="bold" />Поиск по порталу</strong>
        <input
          value={q}
          onChange={e => { setQ(e.target.value); doSearch(e.target.value); }}
          placeholder="Введите запрос..."
          style={{width:'100%',border:'1px solid var(--color-border)',borderRadius:6,padding:'8px 12px',fontSize:'0.9rem',outline:'none',marginBottom:8,background:'var(--color-surface)',color:'var(--color-text)'}}
        />
        {results.length > 0 && (
          <div style={{borderTop:'1px solid #e5e7eb',paddingTop:8}}>
            {results.slice(0, 5).map((r, idx) => {
              const result = r as { title?: string; page_title?: string };
              return (
                <div key={idx} style={{padding:'6px 8px',borderRadius:4,cursor:'pointer',fontSize:'0.9rem',color:'var(--color-text-secondary)'}} onMouseEnter={e => (e.target as HTMLElement).style.background='#f0f0ff'} onMouseLeave={e => (e.target as HTMLElement).style.background='transparent'}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><FileText size={15} weight="duotone" style={{ flexShrink: 0, color: 'var(--color-text-muted)' }} />{result.title || result.page_title}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Properties / page_properties / props macro
  if (name === 'properties' || name === 'page_properties' || name === 'props') {
    const props = (p.properties || p) as Record<string, unknown>;
    return (
      <div style={{background:'#f0f9ff',border:'1px solid #bae6fd',borderRadius:8,padding:16,margin:'12px 0'}}>
        <strong style={{display:'flex',alignItems:'center',gap:6,marginBottom:8,color:'#0c4a6e'}}><ListBullets size={16} weight="duotone" />Свойства страницы</strong>
        <div style={{display:'grid',gridTemplateColumns:'auto 1fr',gap:'4px 16px',fontSize:'0.85rem'}}>
          {Object.entries(props).filter(([k]) => k !== 'children').map(([k,v]) => (
            <div key={k} style={{display:'contents'}}>
              <span style={{color:'#64748b',fontWeight:500}}>{k}:</span>
              <span style={{color:'#334155'}}>{String(v)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Fallback
  const icons: Record<string, ReactNode> = {
    chart: <ChartBar size={18} weight="duotone" />, table: <Table size={18} weight="duotone" />,
    list: <ListBullets size={18} weight="duotone" />, card: <Cards size={18} weight="duotone" />,
    profile: <User size={18} weight="duotone" />, calendar: <CalendarBlank size={18} weight="duotone" />,
    progress: <ChartLineUp size={18} weight="duotone" />, children: <FolderOpen size={18} weight="duotone" />,
    labels: <Tag size={18} weight="duotone" />, default: <Package size={18} weight="duotone" />,
  };
  const icon = icons[name] || icons.default;

  return (
    <div style={{background:'#fffbeb',border:'1px solid #fbbf24',borderRadius:8,padding:16,margin:'12px 0',color:'#92400e'}}>
      <strong style={{display:'flex',alignItems:'center',gap:'6px',marginBottom:6}}><span style={{display:'inline-flex'}}>{icon}</span> {macro.macroName || 'Macro'}</strong>
      {p.children ? <p style={{margin:0,color:'var(--color-text-secondary)'}}>{String(p.children)}</p> : null}
      {Object.keys(p).filter(k => !['children','title','label','value'].includes(k)).length > 0 && (
        <pre style={{background:'#fff',borderRadius:4,padding:8,marginTop:8,fontSize:'0.8rem',color:'var(--color-text-secondary)'}}>{JSON.stringify(p, null, 2)}</pre>
      )}
    </div>
  );
}

// ============ RENDERER ============

interface RenderBlockProps {
  block: PageBlock;
  index: number;
}

function renderBlock({ block, index }: RenderBlockProps): React.ReactElement {
  switch (block.type) {
    case 'heading':
      return <h2 key={index} style={R.heading}>{String(block.text || '')}</h2>;
    case 'text':
      return <p key={index} style={R.text}>{String(block.text || '')}</p>;
    case 'table':
      return (
        <div key={index} style={R.tableWrap}>
          <table style={R.table}>
            {block.headers && <thead><tr>{block.headers.map((h, j) => <th key={j}>{h}</th>)}</tr></thead>}
            <tbody>{block.rows?.map((row, r) => (
              <tr key={r}>{row.map((cell, c) => <td key={c}>{cell}</td>)}</tr>
            ))}</tbody>
          </table>
        </div>
      );
    case 'list':
      return <ul key={index} style={R.list}>{(block.items || []).map((it, li) => <li key={li}>{it}</li>)}</ul>;
    case 'code':
      return <pre key={index} style={R.code}>{String(block.code || block.text || '')}</pre>;
    case 'macro':
      return <MacroRenderer key={index} macro={block as MacroProps} />;
    default:
      return <pre key={index} style={R.code}>{JSON.stringify(block, null, 2)}</pre>;
  }
}

// ============ PAGE VIEWER ============

interface PageViewerProps {
  page: Page;
}

function PageViewer({ page }: PageViewerProps) {
  const { setEditMode, setDirectEditMode } = useApp();
  const content = Array.isArray(page.content) ? page.content : [];

  return (
    <div style={R.viewer}>
      <div style={R.viewerHeader}>
        <div>
          <h1 style={R.pageTitle}>{page.title}</h1>
          <div style={R.meta}>
            Создана: {new Date(page.created_at || '').toLocaleString('ru-RU')}
            {page.updated_at && page.updated_at !== page.created_at &&
              ` · Обновлено: ${new Date(page.updated_at).toLocaleString('ru-RU')}`}
          </div>
        </div>
        <button style={R.btnEdit} onClick={() => setDirectEditMode(true)} aria-label="Редактировать контент">Редактировать</button>
        <button style={R.btnAiEdit} onClick={() => setEditMode(true)} aria-label="Изменить страницу через ИИ">Изменить через ИИ</button>
      </div>
      {content.length > 0 ? content.map((b, i) => renderBlock({ block: b, index: i })) : <div style={R.noContent}>Страница пуста</div>}
    </div>
  );
}

// ============ AI EDITOR ============

interface AIEditorProps {
  page: Page;
}

function AIEditor({ page }: AIEditorProps) {
  const { setEditMode, addToast } = useApp();
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState<{ type: 'prompt' | 'response' | 'error' | 'info'; text: string }[]>([]);

  const handleSend = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setLog(prev => [...prev, { type: 'prompt', text: prompt }]);
    try {
      const token = getToken();
      const result = await api('POST', '/api/ai/build', {
        prompt: `Страница: "${page.title}". Запрос: ${prompt}`
      }, token);
      setLog(prev => [...prev, { type: 'response', text: JSON.stringify(result, null, 2) }]);
      addToast('ИИ обработал запрос', 'success');
    } catch (e) {
      setLog(prev => [...prev, { type: 'error', text: (e as Error).message }]);
      addToast('Ошибка: ' + (e as Error).message, 'error');
    } finally { setLoading(false); }
  };

  return (
    <div style={R.editor}>
      <div style={R.editorHeader}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><MagicWand size={18} weight="duotone" style={{ color: 'var(--color-primary)' }} />Редактирование через ИИ</h3>
        <button style={R.btnClose} onClick={() => setEditMode(false)}>✕</button>
      </div>
      <div style={R.editorInfo}>Страница: <strong>{page.title}</strong></div>
      <textarea style={R.editorPrompt} placeholder={"Опиши, что изменить...\n\nНапример:\n- Добавь раздел 'Участники' с таблицей\n- Переформулируй текст более формально"}
        value={prompt} onChange={e => setPrompt(e.target.value)}
        onKeyDown={e => { if (e.ctrlKey && e.key === 'Enter') handleSend(); }} disabled={loading} />
      <button style={{ ...R.btnSend, ...(loading || !prompt.trim() ? R.btnDisabled : {}) }}
        onClick={handleSend} disabled={loading || !prompt.trim()}>
        {loading ? 'Думаю…' : 'Применить (Ctrl+Enter)'}
      </button>
      {log.length > 0 && (
        <div style={R.log}>
          {log.map((entry, i) => (
            <div key={i} style={{
              ...R.logEntry,
              borderLeft: `3px solid ${entry.type === 'error' ? '#ef4444' : entry.type === 'prompt' ? '#2563eb' : entry.type === 'response' ? '#22c55e' : '#f59e0b'}`
            }}>
              <div style={R.logType}>
                {entry.type === 'prompt' ? 'Промт' : entry.type === 'response' ? 'Ответ' : entry.type === 'error' ? 'Ошибка' : 'Инфо'}
              </div>
              <pre style={R.logText}>{entry.text}</pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============ PAGE EDITOR ============

type BlockType = 'heading' | 'text' | 'table' | 'list' | 'code';

interface EditableBlock {
  _tempId: number;
  type: BlockType;
  text: string;
  headers?: string[];
  rows?: string[][];
  items?: string[];
}

interface PageEditorProps {
  page: Page;
}

function PageEditor({ page }: PageEditorProps) {
  const { setDirectEditMode, addToast, loadPages } = useApp();

  const [title, setTitle] = useState(page.title);
  const [blocks, setBlocks] = useState<EditableBlock[]>(() => {
    const existing = Array.isArray(page.content) ? page.content : [];
    return existing.length > 0
      ? existing.map((b, i) => ({
          _tempId: i + 1,
          type: (b.type === 'macro' ? 'text' : b.type) as BlockType,
          text: String(b.text || ''),
          headers: b.headers,
          rows: b.rows,
          items: b.items,
        }))
      : [{ _tempId: Date.now(), type: 'text', text: '' }];
  });
  const [saving, setSaving] = useState(false);

  const addBlock = (afterIndex: number, type: BlockType = 'text') => {
    const newBlock: EditableBlock = { _tempId: Date.now(), type, text: '' };
    setBlocks(prev => {
      const updated = [...prev];
      updated.splice(afterIndex + 1, 0, newBlock);
      return updated;
    });
  };

  const removeBlock = (index: number) => {
    if (blocks.length === 1) {
      setBlocks([{ _tempId: Date.now(), type: 'text', text: '' }]);
    } else {
      setBlocks(prev => prev.filter((_, i) => i !== index));
    }
  };

  const updateBlock = (index: number, updates: Partial<EditableBlock>) => {
    setBlocks(prev => prev.map((b, i) => i === index ? { ...b, ...updates } : b));
  };

  const handleSave = async () => {
    if (!title.trim()) {
      addToast('Введите название страницы', 'error');
      return;
    }
    setSaving(true);
    try {
      const content = blocks
        .filter(b => b.text.trim() || b.type === 'heading')
        .map(({ _tempId, ...rest }) => rest);

      const token = getToken();
      const result = await api('PATCH', `/api/pages/${page.id}`, {
        title: title.trim(),
        content,
      }, token);

      addToast('Страница сохранена', 'success');
      await loadPages();
      setDirectEditMode(false);
    } catch (e) {
      addToast('Ошибка сохранения: ' + (e as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={R.editor}>
      <div style={R.editorHeader}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><PencilSimple size={18} weight="duotone" style={{ color: 'var(--color-primary)' }} />Редактирование страницы</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            style={{ ...R.btnSave, opacity: saving ? 0.6 : 1 }}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Сохранение…' : 'Сохранить'}
          </button>
          <button style={R.btnClose} onClick={() => setDirectEditMode(false)}>✕ Отмена</button>
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <input
          style={{
            width: '100%', padding: '10px 14px', border: '1px solid var(--color-border)',
            borderRadius: 8, fontSize: '1.25rem', fontWeight: 700,
            boxSizing: 'border-box', outline: 'none', color: 'var(--color-text)', background: 'var(--color-surface)'
          }}
          placeholder="Название страницы"
          value={title}
          onChange={e => setTitle(e.target.value)}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {blocks.map((block, index) => (
          <div key={block._tempId} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <select
              value={block.type}
              onChange={e => updateBlock(index, { type: e.target.value as BlockType })}
              style={{ padding: '6px 8px', border: '1px solid var(--color-border)', borderRadius: 6, fontSize: '0.85rem', cursor: 'pointer', minWidth: 110, background: 'var(--color-surface)', color: 'var(--color-text)' }}
            >
              <option value="heading">Заголовок</option>
              <option value="text">Текст</option>
              <option value="code">Код</option>
              <option value="list">Список</option>
              <option value="table">Таблица</option>
            </select>

            <div style={{ flex: 1 }}>
              {block.type === 'text' || block.type === 'heading' || block.type === 'code' ? (
                <textarea
                  value={block.text}
                  onChange={e => updateBlock(index, { text: e.target.value })}
                  placeholder={block.type === 'heading' ? 'Заголовок...' : block.type === 'code' ? 'Код...' : 'Текст...'}
                  style={{
                    width: '100%', padding: '8px 12px', border: '1px solid var(--color-border)',
                    borderRadius: 6, fontSize: '0.9rem', resize: 'vertical',
                    minHeight: block.type === 'heading' ? 40 : 80,
                    boxSizing: 'border-box', fontFamily: block.type === 'code' ? 'monospace' : 'inherit',
                    background: 'var(--color-background-alt)', color: 'var(--color-text)',
                    outline: 'none'
                  }}
                />
              ) : block.type === 'list' ? (
                <textarea
                  value={(block.items || []).join('\n')}
                  onChange={e => updateBlock(index, { items: e.target.value.split('\n').filter(l => l.trim()) })}
                  placeholder="Элементы списка (по одному на строку)"
                  style={{
                    width: '100%', padding: '8px 12px', border: '1px solid var(--color-border)',
                    borderRadius: 6, fontSize: '0.9rem', resize: 'vertical',
                    minHeight: 80, boxSizing: 'border-box', outline: 'none',
                    background: 'var(--color-background-alt)', color: 'var(--color-text)'
                  }}
                />
              ) : null}
            </div>
            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
              <button
                onClick={() => addBlock(index)}
                title="Добавить блок"
                style={{ padding: '6px 10px', background: 'var(--color-success-light)', border: '1px solid var(--color-success)', borderRadius: 6, cursor: 'pointer', fontSize: '0.85rem', color: 'var(--color-success)' }}
              >+</button>
              <button
                onClick={() => removeBlock(index)}
                title="Удалить блок"
                style={{ padding: '6px 10px', background: 'var(--color-error-light)', border: '1px solid var(--color-error)', borderRadius: 6, cursor: 'pointer', fontSize: '0.85rem', color: 'var(--color-error)' }}
              >×</button>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
        <button
          style={{ padding: '8px 16px', background: 'var(--color-background-alt)', border: '1px solid var(--color-border)', borderRadius: 6, cursor: 'pointer', fontSize: '0.88rem', color: 'var(--color-text-secondary)' }}
          onClick={() => addBlock(blocks.length - 1)}
        >
          + Добавить блок
        </button>
      </div>
    </div>
  );
}

// ============ BUILD PANEL ============

function BuildPanel() {
  const { loadPages, addToast, selectPage, selectedSpace, spaces } = useApp();
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);

  const handleBuild = async () => {
    const token = getToken();
    if (!token) { window.location.href = '/login'; return; }
    if (!prompt.trim()) return;
    const spaceId = selectedSpace ?? spaces[0]?.id;
    if (!spaceId) { addToast('Сначала создайте пространство', 'warning'); return; }
    setLoading(true);
    try {
      const spec = await api('POST', '/api/ai/build', { prompt }, token) as unknown as Page;
      const created = await api('POST', '/api/pages', {
        title: spec.title || 'Без названия',
        content: spec.content || [],
        spaceId,
        acl: { readers: ['all'] },
      }, token) as unknown as Page;
      addToast('Страница создана', 'success');
      setPrompt('');
      await loadPages();
      selectPage(created);
    } catch (e) {
      const msg = (e as Error).message || '';
      const denied = msg.includes('Forbidden') || msg.includes('permission');
      addToast(denied ? 'Недостаточно прав для создания страниц' : 'Ошибка: ' + msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={R.centered}>
      <div className="w-full max-w-[560px] rounded-3xl border border-line bg-surface p-8 shadow-diffusion">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-accent/10 text-accent">
            <MagicWand size={22} weight="duotone" />
          </span>
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-fg">Генерация страницы</h2>
            <p className="text-sm text-fg-muted">Опишите, какую страницу создать на естественном языке</p>
          </div>
        </div>
        <textarea
          className="mt-5 min-h-[140px] w-full resize-y rounded-2xl border border-line bg-bg-alt p-3.5 text-[0.95rem] text-fg outline-none transition placeholder:text-fg-muted focus:border-accent focus:ring-4 focus:ring-accent/15"
          placeholder="Например: создайте страницу команды с разделами — цели, участники, KPI"
          value={prompt} onChange={e => setPrompt(e.target.value)} rows={5}
        />
        <button
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold tracking-tight text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          onClick={handleBuild} disabled={!prompt.trim() || loading}>
          {loading ? <CircleNotch size={16} weight="bold" className="animate-spin" /> : <MagicWand size={16} weight="fill" />}
          {loading ? 'Генерация…' : 'Сгенерировать'}
        </button>
      </div>
    </div>
  );
}

// ============ WELCOME ============

function Welcome() {
  return (
    <div style={R.welcome}>
      <span style={{ display: 'inline-grid', placeItems: 'center', width: 64, height: 64, borderRadius: 18, background: 'var(--color-primary-light)', color: 'var(--color-primary)', marginBottom: 16 }}>
        <Rocket size={30} weight="duotone" />
      </span>
      <h2 style={{ marginBottom: 8, color: 'var(--color-text)' }}>Добро пожаловать в AI Portal</h2>
      <p style={{ color: 'var(--color-text-muted)', maxWidth: 400, textAlign: 'center' }}>
        Создай пространство слева, затем сгенерируй страницу через ИИ
      </p>
      <div style={R.steps}>
        {['1. Создай пространство', '2. Сгенерируй страницу ИИ', '3. Сохрани', '4. Редактируй через ИИ'].map(step => (
          <div key={step} style={R.step}>{step}</div>
        ))}
      </div>
    </div>
  );
}

// ============ MAIN CONTENT ============

function MainContent() {
  const { selectedPage, editMode, directEditMode, showSettings } = useApp();
  if (showSettings) return <div />; // Settings handled elsewhere
  if (editMode && selectedPage) return <AIEditor page={selectedPage} />;
  if (directEditMode && selectedPage) return <PageEditor page={selectedPage} />;
  if (selectedPage) return <PageViewer page={selectedPage} />;
  return <BuildPanel />;
}

// ============ RIGHT SIDEBAR ============

interface RightSidebarProps {
  page?: Page | null;
  previewPage?: Page | null;
  spaces?: Space[];
}

function RightSidebar({ page, previewPage, spaces }: RightSidebarProps) {
  const displayPage = page || previewPage;
  if (!displayPage) return null;

  const [showSidebar, setShowSidebar] = useState(true);
  const { loadPages, addToast, setSelectedPage } = useApp();

  const handleDelete = async () => {
    if (!page) return; // only real (saved) pages, never a preview
    if (!confirm(`Удалить страницу «${page.title}»?`)) return;
    const token = getToken();
    if (!token) return;
    try {
      await api('DELETE', `/api/pages/${page.id}`, null, token);
      addToast('Страница удалена', 'success');
      setSelectedPage(null);
      await loadPages();
    } catch (e) {
      const msg = (e as Error).message || '';
      const denied = msg.includes('Forbidden') || msg.includes('permission');
      addToast(denied ? 'Недостаточно прав для удаления' : 'Ошибка: ' + msg, 'error');
    }
  };

  const content = asArray<PageBlock>(displayPage?.content);
  const headings = content.filter(b => b.type === 'heading');

  const allSpaces = spaces || [];
  const space = allSpaces.find(s => s.id === displayPage?.space_id);
  const blockCount = content.length || 0;
  const createdAt = displayPage?.created_at || new Date().toISOString();

  return (
    <>
      <button
        onClick={() => setShowSidebar(!showSidebar)}
        style={{
          position: 'fixed', right: showSidebar ? '280px' : '0', top: '70px',
          zIndex: 10000, padding: '8px 6px', background: 'var(--color-surface)',
          border: '1px solid var(--color-border)', borderRadius: '6px 0 0 6px',
          cursor: 'pointer', color: 'var(--color-text-secondary)', fontSize: '0.85rem',
          boxShadow: '-2px 0 8px rgba(0,0,0,0.05)',
          transition: 'right 0.2s'
        }}
        title={showSidebar ? 'Скрыть панель' : 'Показать панель'}
      >
        {showSidebar ? '◀' : '▶'}
      </button>

      {showSidebar && (
        <aside style={{
          width: 280, minWidth: 280, background: 'var(--color-surface)', borderLeft: '1px solid var(--color-border)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden', height: '100%'
        }}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--color-border)' }}>
            <strong style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <ListBullets size={15} weight="duotone" />Оглавление
            </strong>
            {headings.length > 0 ? (
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {headings.map((h, idx) => {
                  const heading = h as PageBlock & { text?: string };
                  return (
                    <a key={idx} href={'#heading-' + idx} style={{
                      fontSize: '0.85rem', color: 'var(--color-text-secondary)', textDecoration: 'none', padding: '4px 8px',
                      borderRadius: 4, cursor: 'pointer'
                    }}
                    onMouseEnter={e => (e.target as HTMLElement).style.background = '#f0f0ff'}
                    onMouseLeave={e => (e.target as HTMLElement).style.background = 'transparent'}
                    >
                      {heading.text}
                    </a>
                  );
                })}
              </div>
            ) : (
              <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', padding: '8px 0' }}>Нет заголовков</div>
            )}
          </div>

          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)' }}>
            <strong style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Info size={15} weight="duotone" />Информация
            </strong>
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.82rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Пространство:</span>
                <span style={{ color: 'var(--color-text-secondary)' }}>{space?.name || '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Создано:</span>
                <span style={{ color: 'var(--color-text-secondary)' }}>
                  {createdAt ? new Date(createdAt).toLocaleDateString('ru-RU') : '—'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Блоков:</span>
                <span style={{ color: 'var(--color-text-secondary)' }}>{blockCount}</span>
              </div>
            </div>
          </div>

          <div style={{ padding: '12px 16px', flex: 1, overflowY: 'auto' }}>
            <strong style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Lightning size={15} weight="duotone" />Действия
            </strong>
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button style={{ ...sidebarBtnStyle, display: 'flex', alignItems: 'center', gap: 8 }} onClick={() => alert('Копирование страницы — в разработке')}><Copy size={16} weight="duotone" />Копировать страницу</button>
              <button style={{ ...sidebarBtnStyle, display: 'flex', alignItems: 'center', gap: 8 }} onClick={() => alert('Экспорт — в разработке')}><FileArrowDown size={16} weight="duotone" />Экспорт в PDF</button>
              <button style={{ ...sidebarBtnStyle, color: '#ef4444', borderColor: '#fecaca', display: 'flex', alignItems: 'center', gap: 8 }} onClick={handleDelete}><Trash size={16} weight="duotone" />Удалить</button>
            </div>
          </div>
        </aside>
      )}
    </>
  );
}

const sidebarBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
  background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 6,
  cursor: 'pointer', fontSize: '0.82rem', color: 'var(--color-text-secondary)', textAlign: 'left'
};

// ============ TOASTS ============

interface ToastItem {
  id: number;
  message: string;
  type: 'success' | 'error' | 'warning';
}

interface ToastsProps {
  toasts: ToastItem[];
  removeToast: (id: number) => void;
}

function Toasts({ toasts, removeToast }: ToastsProps) {
  if (!toasts.length) return null;
  return (
    <div style={S.toastContainer}>
      {toasts.map(t => (
        <div key={t.id} style={{
          ...S.toast, borderLeft: `4px solid ${t.type === 'success' ? '#22c55e' : t.type === 'error' ? '#ef4444' : '#f59e0b'}`
        }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            {t.type === 'success'
              ? <CheckCircle size={17} weight="fill" style={{ color: '#16a34a', flexShrink: 0 }} />
              : t.type === 'error'
                ? <XCircle size={17} weight="fill" style={{ color: '#dc2626', flexShrink: 0 }} />
                : <Warning size={17} weight="fill" style={{ color: '#d97706', flexShrink: 0 }} />}
            {t.message}
          </span>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: '1.2rem' }}
            onClick={() => removeToast(t.id)}>✕</button>
        </div>
      ))}
    </div>
  );
}

// ============ APP ============

interface AppContextValue {
  spaces: Space[];
  setSpaces: React.Dispatch<React.SetStateAction<Space[]>>;
  pages: Page[];
  setPages: React.Dispatch<React.SetStateAction<Page[]>>;
  selectedSpace: number | null;
  selectedPage: Page | null;
  setSelectedPage: React.Dispatch<React.SetStateAction<Page | null>>;
  sidebarSearch: string;
  setSidebarSearch: React.Dispatch<React.SetStateAction<string>>;
  editMode: boolean;
  setEditMode: React.Dispatch<React.SetStateAction<boolean>>;
  directEditMode: boolean;
  setDirectEditMode: React.Dispatch<React.SetStateAction<boolean>>;
  previewPage: Page | null;
  setPreviewPage: React.Dispatch<React.SetStateAction<Page | null>>;
  selectSpace: (id: number | null) => void;
  selectPage: (page: Page) => void;
  loadSpaces: () => Promise<void>;
  loadPages: () => Promise<void>;
  addToast: (message: string, type: 'success' | 'error' | 'warning') => void;
  showSettings: boolean;
  setShowSettings: React.Dispatch<React.SetStateAction<boolean>>;
  showAIAssistant: boolean;
  setShowAIAssistant: React.Dispatch<React.SetStateAction<boolean>>;
  showNotificationPanel: boolean;
  setShowNotificationPanel: React.Dispatch<React.SetStateAction<boolean>>;
}

export default function Home() {
  const isMobile = useIsMobile();
  const [showSidebar, setShowSidebar] = useState(true);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [pages, setPages] = useState<Page[]>([]);
  const [selectedSpace, setSelectedSpace] = useState<number | null>(null);
  const [selectedPage, setSelectedPage] = useState<Page | null>(null);
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [directEditMode, setDirectEditMode] = useState(false);
  const [previewPage, setPreviewPage] = useState<Page | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [showNotificationPanel, setShowNotificationPanel] = useState(false);

  const addToast = useCallback((message: string, type: 'success' | 'error' | 'warning') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const loadSpaces = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const data = await api('GET', '/api/spaces', null, token);
      const list = Array.isArray(data) ? data as Space[] : [];
      setSpaces(list);
      if (list.length > 0 && !selectedSpace) setSelectedSpace(list[0].id);
    } catch (e) { /* silent */ }
  }, [selectedSpace]);

  const loadPages = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const q = selectedSpace ? '?spaceId=' + selectedSpace : '';
      const data = await api('GET', '/api/pages' + q, null, token);
      setPages(Array.isArray(data) ? data as Page[] : []);
    } catch (e) { /* silent */ }
  }, [selectedSpace]);

  const selectSpace = useCallback((id: number | null) => { setSelectedSpace(id); setSelectedPage(null); setEditMode(false); }, []);
  const selectPage = useCallback((page: Page) => { setSelectedPage(page); setEditMode(false); setDirectEditMode(false); }, []);

  useEffect(() => {
    if (!getToken()) { window.location.href = '/login'; return; }
    loadSpaces();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (selectedSpace) loadPages(); else setPages([]); }, [selectedSpace, loadPages]);

  const contextValue: AppContextValue = {
    spaces, setSpaces, pages, setPages, selectedSpace, selectedPage, setSelectedPage, sidebarSearch, setSidebarSearch,
    editMode, setEditMode, directEditMode, setDirectEditMode,
    previewPage, setPreviewPage, selectSpace, selectPage,
    loadSpaces, loadPages, addToast, showSettings, setShowSettings, showAIAssistant, setShowAIAssistant,
    showNotificationPanel, setShowNotificationPanel
  };

  return (
    <AppContext.Provider value={contextValue}>
      <div style={{ ...styles.app, display:'flex', width:'100%', minHeight:'100dvh', height: isMobile ? 'auto' : '100vh', overflow: isMobile ? 'visible' : 'hidden' }}>
        {isMobile && (
          <button onClick={() => { setShowSidebar(!showSidebar); }}
            style={{ position:'fixed',top:12,left:showSidebar?290:12,zIndex:2001,padding:'8px 12px',
              background:'#fff',border:'1px solid #e5e7eb',borderRadius:8,cursor:'pointer',fontSize:'1.3rem',
              boxShadow:'0 2px 8px rgba(0,0,0,0.1)',transition:'left 0.2s' }}>
            {showSidebar ? '✕' : '☰'}
          </button>
        )}
        <Sidebar isMobile={isMobile} open={showSidebar} setOpen={setShowSidebar} />

        <main style={{ ...styles.main, flex:1, padding:0, overflow: isMobile?'visible':'hidden', display:'flex', minWidth:0, minHeight: isMobile?'100dvh':'auto' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <MainContent />
          </div>
          <RightSidebar page={selectedPage} previewPage={previewPage} spaces={spaces} />
        </main>

        <Toasts toasts={toasts} removeToast={id => setToasts(p => p.filter(t => t.id !== id))} />
        {showAIAssistant && (
          <AIAssistant
            spaces={spaces}
            currentSpaceId={selectedSpace}
            onClose={() => setShowAIAssistant(false)}
            onPageCreated={(page) => {
              setPages(prev => [...prev, page]);
              selectPage(page);
              setShowAIAssistant(false);
            }}
            onToast={(msg, type) => addToast(msg, type === 'info' ? 'success' : type)}
          />
        )}
        {showNotificationPanel && (
          <NotificationPanel onClose={() => setShowNotificationPanel(false)} />
        )}
      </div>
    </AppContext.Provider>
  );
}

// ============ INLINE STYLES ============

const srOnly: React.CSSProperties = {
  position: 'absolute', width: 1, height: 1, padding: 0,
  margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)',
  whiteSpace: 'nowrap', border: 0,
};

const styles: Record<string, React.CSSProperties> = {
  app: { display: 'flex', width: '100%', position: 'relative' },
  main: { overflowY: 'auto' as const, background: 'var(--color-background)', minHeight: 0 },
};

const S: Record<string, React.CSSProperties> = {
  logo: {
    padding: '16px 16px 12px', fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text)',
    borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: 8,
  },
  searchWrap: {
    display: 'flex', alignItems: 'center', padding: '10px 12px',
    background: 'var(--color-background-alt)', borderBottom: '1px solid var(--color-border)'
  },
  searchInput: {
    flex: 1, border: '1px solid var(--color-border)', borderRadius: 6, padding: '6px 10px',
    fontSize: '0.9rem', outline: 'none', background: 'var(--color-surface)', color: 'var(--color-text)'
  },
  searchClear: {
    background: 'none', border: 'none', color: 'var(--color-text-muted)', fontSize: '1.2rem',
    cursor: 'pointer', marginLeft: 4
  },
  nav: { flex: 1, overflowY: 'auto' as const, padding: '8px 0' },
  spaceRow: {
    display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px',
    cursor: 'pointer', fontSize: '0.95rem', color: 'var(--color-text-secondary)', fontWeight: 600
  },
  spaceRowHover: { background: 'var(--color-background-alt)' },
  spaceRowActive: { background: 'var(--color-primary-light)', color: 'var(--color-active-nav)' },
  spaceName: { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  pageList: { paddingLeft: 24 },
  pageRow: {
    padding: '6px 16px', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--color-text-secondary)',
    borderRadius: 2, margin: '0 4px'
  },
  pageRowHover: { background: 'var(--color-background-alt)' },
  pageRowActive: { background: 'var(--color-primary-light)', color: 'var(--color-active-nav)', fontWeight: 500 },
  emptyHint: { padding: '8px 16px', color: 'var(--color-text-muted)', fontSize: '0.85rem', fontStyle: 'italic' },
  btnNewSpace: {
    margin: '8px 12px', padding: '8px 12px', background: 'var(--color-background-alt)',
    border: '1px dashed var(--color-border)', borderRadius: 6, cursor: 'pointer',
    fontSize: '0.85rem', color: 'var(--color-text-secondary)', transition: 'all 0.15s ease',
  },
  btnNewSpaceHover: {
    background: 'var(--color-primary-light)', borderColor: 'var(--color-active-nav)', color: 'var(--color-active-nav)',
  },
  newSpaceForm: { padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 6 },
  spaceInput: {
    border: '1px solid var(--color-border)', borderRadius: 6, padding: '6px 10px',
    fontSize: '0.9rem', outline: 'none', color: 'var(--color-text)'
  },
  btnSave: {
    padding: '5px 12px', background: 'var(--color-active-nav)', color: '#fff',
    border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: '0.85rem'
  },
  btnCancel: {
    padding: '5px 8px', background: 'var(--color-background-alt)', border: '1px solid var(--color-border)',
    borderRadius: 5, cursor: 'pointer', fontSize: '0.85rem', color: 'var(--color-text-secondary)'
  },
  toastContainer: {
    position: 'fixed', top: 16, right: 16, zIndex: 9999,
    display: 'flex', flexDirection: 'column', gap: 8
  },
  toast: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
    padding: '10px 16px', background: 'var(--color-surface)', borderRadius: 12,
    border: '1px solid var(--color-border)',
    boxShadow: '0 20px 40px -18px rgba(15, 23, 42, 0.16)', fontSize: '0.9rem', minWidth: 280, maxWidth: 400,
    color: 'var(--color-text)'
  },
};

const R: Record<string, React.CSSProperties> = {
  viewer: { maxWidth: '960px', padding: '20px 16px', margin: '0 auto' },
  viewerHeader: {
    marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--color-border)',
    display: 'flex', justifyContent: 'space-between', alignItems: 'start',
    flexWrap: 'wrap', gap: 12
  },
  pageTitle: { fontSize: '1.75rem', fontWeight: 700, color: 'var(--color-text)', margin: 0 },
  meta: { color: 'var(--color-text-muted)', fontSize: '0.85rem', marginTop: 4 },
  btnEdit: {
    padding: '8px 16px', background: 'var(--color-primary-light)', border: '1px solid var(--color-primary)',
    borderRadius: 6, cursor: 'pointer', fontSize: '0.9rem', color: 'var(--color-primary)', fontWeight: 500
  },
  btnAiEdit: {
    padding: '8px 16px', background: 'var(--color-warning-light)', border: '1px solid var(--color-warning)',
    borderRadius: 6, cursor: 'pointer', fontSize: '0.9rem', color: 'var(--color-warning)', fontWeight: 500
  },
  heading: {
    fontSize: '1.25rem', fontWeight: 600, color: 'var(--color-text)',
    margin: '24px 0 12px', paddingLeft: 12, borderLeft: '4px solid var(--color-active-nav)'
  },
  text: { fontSize: '0.95rem', color: 'var(--color-text-secondary)', lineHeight: 1.7, margin: '8px 0' },
  tableWrap: { overflowX: 'auto', margin: '12px 0' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', color: 'var(--color-text)' },
  list: { paddingLeft: 24, margin: '8px 0', color: 'var(--color-text-secondary)' },
  code: { background: 'var(--color-background-alt)', border: '1px solid var(--color-border)', borderRadius: 6, padding: 12, fontSize: '0.85rem', overflowX: 'auto', color: 'var(--color-text)' },
  noContent: { color: 'var(--color-text-muted)', fontSize: '0.95rem', padding: '32px 0', textAlign: 'center' as const },
  editor: { maxWidth: '960px', padding: 20, margin: '0 auto' },
  editorHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  editorInfo: { color: 'var(--color-text-muted)', fontSize: '0.88rem', marginBottom: 12 },
  editorPrompt: { width: '100%', padding: '10px 12px', border: '1px solid var(--color-border)', borderRadius: 6, fontSize: '0.9rem', resize: 'vertical', minHeight: 100, marginBottom: 12, boxSizing: 'border-box' as const, background: 'var(--color-surface)', color: 'var(--color-text)' },
  btnSend: { padding: '10px 20px', background: 'var(--color-active-nav)', color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600 },
  btnDisabled: { opacity: 0.5, cursor: 'not-allowed' },
  btnClose: { padding: '4px 10px', background: 'var(--color-background-alt)', border: '1px solid var(--color-border)', borderRadius: 4, cursor: 'pointer', fontSize: '0.85rem', color: 'var(--color-text-secondary)' },
  log: { marginTop: 16, maxHeight: 400, overflowY: 'auto' as const, display: 'flex', flexDirection: 'column' as const, gap: 8 },
  logEntry: { background: 'var(--color-background-alt)', borderRadius: 6, padding: '8px 12px', fontSize: '0.85rem' },
  logType: { fontSize: '0.78rem', color: 'var(--color-text-muted)', marginBottom: 4 },
  logText: { margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' as const },
  centered: { display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' },
  buildCard: { background: 'var(--color-surface)', borderRadius: 16, border: '1px solid var(--color-border)', padding: 32, maxWidth: 560, width: '100%', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' },
  buildPrompt: { width: '100%', padding: '10px 12px', border: '1px solid var(--color-border)', borderRadius: 6, fontSize: '0.9rem', resize: 'vertical', minHeight: 120, marginBottom: 12, boxSizing: 'border-box' as const, fontFamily: 'inherit', background: 'var(--color-surface)', color: 'var(--color-text)' },
  welcome: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', padding: 32 },
  steps: { marginTop: 24, display: 'flex', flexDirection: 'column', gap: 8 },
  step: { padding: '10px 20px', background: 'var(--color-primary-light)', borderRadius: 8, fontSize: '0.9rem', color: 'var(--color-primary)', fontWeight: 500 },
  btnSave: { padding: '10px 20px', background: 'var(--color-success)', color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600 },
  btnOutline: { padding: '10px 20px', background: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 7, cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600 },
};
