'use client';
export const dynamic = 'force-dynamic';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { SpaceDetail, Page, PageAttachment } from '../../types/api';
import {
  FolderOpen, FolderSimple, FileText, ArrowLeft, Plus, Trash, X,
  Paperclip, ClockCounterClockwise, ArrowCounterClockwise, UploadSimple,
  CheckCircle, XCircle, Info, CircleNotch,
} from '@phosphor-icons/react';
import { getSpaceById, getPages, createPage, updatePage, deletePage, restorePage, getAttachments, addAttachment, deleteAttachment } from '../../lib/api';
import { MotionButton } from '../../components/ui/MotionButton';

interface Toast { id: number; message: string; type: 'success' | 'error' | 'info'; }
const TOAST_ICON = { success: CheckCircle, error: XCircle, info: Info } as const;
const TOAST_TONE = {
  success: 'border-success/30 text-success',
  error: 'border-danger/30 text-danger',
  info: 'border-accent/30 text-accent',
} as const;

function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const add = useCallback((msg: string, t: Toast['type'] = 'success') => {
    const id = Date.now();
    setToasts(p => [...p, { id, message: msg, type: t }]);
    setTimeout(() => setToasts(p => p.filter(x => x.id !== id)), 4000);
  }, []);
  const ToastContainer = () => (
    <div className="pointer-events-none fixed bottom-6 right-6 z-50 flex flex-col gap-2.5">
      <AnimatePresence>
        {toasts.map(t => {
          const Icon = TOAST_ICON[t.type];
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, x: 24, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 24, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 320, damping: 26 }}
              className={`pointer-events-auto flex items-center gap-2.5 rounded-xl border bg-surface px-3.5 py-2.5 text-sm shadow-diffusion ${TOAST_TONE[t.type]}`}
            >
              <Icon size={18} weight="fill" className="shrink-0" />
              <span className="text-fg">{t.message}</span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
  return { addToast: add, ToastContainer };
}

function buildTree(pages: Page[]): Map<number | null, Page[]> {
  const map = new Map<number | null, Page[]>();
  pages.forEach(p => {
    const key = p.parent_id ?? null;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(p);
  });
  return map;
}

function PageTree({ pages, selectedId, onSelect, onDelete, onAddChild, depth = 0 }: {
  pages: Page[]; selectedId: number | null; onSelect: (p: Page) => void;
  onDelete: (p: Page) => void; onAddChild: (p: Page) => void; depth?: number;
}) {
  const tree = buildTree(pages);
  const rootPages = tree.get(null) || [];

  function renderPage(page: Page, d: number): React.ReactElement {
    const children = tree.get(page.id) || [];
    const isSelected = page.id === selectedId;
    return (
      <div key={page.id}>
        <div
          className={`group flex items-center rounded-lg pr-1.5 transition-colors ${
            isSelected ? 'bg-accent/10 text-accent' : 'text-fg-secondary hover:bg-surface-hover hover:text-fg'
          }`}
          style={{ paddingLeft: `${8 + d * 16}px` }}
        >
          <button className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left" onClick={() => onSelect(page)} title={page.title}>
            <span className={`shrink-0 ${isSelected ? 'text-accent' : 'text-fg-muted'}`}>
              {children.length > 0
                ? (isSelected ? <FolderOpen size={15} weight="fill" /> : <FolderSimple size={15} weight="fill" />)
                : <FileText size={15} weight="regular" />}
            </span>
            <span className="truncate text-sm">{page.title}</span>
          </button>
          <div className="flex shrink-0 items-center opacity-0 transition group-hover:opacity-100">
            <button className="flex h-6 w-6 items-center justify-center rounded text-fg-muted hover:bg-bg hover:text-accent" onClick={() => onAddChild(page)} title="Добавить дочернюю">
              <Plus size={13} weight="bold" />
            </button>
            <button className="flex h-6 w-6 items-center justify-center rounded text-fg-muted hover:bg-danger/10 hover:text-danger" onClick={() => onDelete(page)} title="Удалить">
              <Trash size={13} weight="bold" />
            </button>
          </div>
        </div>
        {children.map(child => renderPage(child, d + 1))}
      </div>
    );
  }

  return <div className="flex flex-col gap-0.5">{rootPages.map(p => renderPage(p, depth))}</div>;
}

const inputClass =
  'w-full rounded-xl border border-line bg-bg py-2.5 px-3.5 text-[0.95rem] text-fg ' +
  'placeholder:text-fg-muted outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/15';

export default function SpaceDetailPage() {
  const params = useParams<{ id: string }>();
  const { id } = params ?? {};
  const spaceId = Number(id);

  const [space, setSpace] = useState<SpaceDetail | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [selectedPage, setSelectedPage] = useState<Page | null>(null);
  const [loading, setLoading] = useState(true);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [parentForNew, setParentForNew] = useState<number | null>(null);
  const [showVersions, setShowVersions] = useState(false);
  const [versions, setVersions] = useState<any[]>([]);
  const [showDeleted, setShowDeleted] = useState(false);
  const [attachments, setAttachments] = useState<PageAttachment[]>([]);
  const [showAttachments, setShowAttachments] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { addToast, ToastContainer } = useToast();

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  useEffect(() => {
    if (!token) { window.location.href = '/login'; return; }
    if (!spaceId || isNaN(spaceId)) return;
    loadData();
  }, [spaceId]);
  async function loadData() {
    setLoading(true);
    try {
      const [spaceData, allPages] = await Promise.all([getSpaceById(spaceId), getPages()]);
      setSpace(spaceData);
      const spacePages = allPages.filter((p: Page) => p.space_id === spaceId);
      const active = spacePages.filter((p: Page) => !p.deleted_at);
      const deleted = spacePages.filter((p: Page) => p.deleted_at);
      setPages(active);
      (window as any).__deletedPages = deleted;
      if (active.length > 0 && !selectedPage) {
        setSelectedPage(active[0]);
        setEditTitle(active[0].title);
        setEditContent(typeof active[0].content === 'string' ? active[0].content : JSON.stringify(active[0].content || {}));
      }
    } catch {
      addToast('Ошибка загрузки', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectPage(page: Page) {
    setSelectedPage(page);
    setEditTitle(page.title);
    setEditContent(typeof page.content === 'string' ? page.content : JSON.stringify(page.content || {}));
    setShowVersions(false);
    setShowAttachments(false);
    await loadAttachments(page.id);
  }

  async function loadAttachments(pageId: number) {
    try {
      const atts = await getAttachments(pageId);
      setAttachments(atts);
    } catch {
      // silently fail — attachments are non-critical
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!selectedPage || !e.target.files?.length) return;
    const file = e.target.files[0];
    setUploading(true);
    try {
      const uploaded = await addAttachment(selectedPage.id, file);
      setAttachments(prev => [uploaded, ...prev]);
      addToast('Файл загружен', 'success');
    } catch {
      addToast('Ошибка загрузки файла', 'error');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function handleDeleteAttachment(pageId: number, attachmentId: number) {
    try {
      await deleteAttachment(pageId, attachmentId);
      setAttachments(prev => prev.filter(a => a.id !== attachmentId));
      addToast('Вложение удалено', 'success');
    } catch {
      addToast('Ошибка удаления', 'error');
    }
  }

  async function handleSave() {
    if (!selectedPage) return;
    setSaving(true);
    try {
      let content: unknown;
      try { content = JSON.parse(editContent); } catch { content = editContent; }
      const updated = await updatePage(selectedPage.id, { title: editTitle, content });
      setPages(prev => prev.map(p => p.id === updated.id ? updated : p));
      setSelectedPage(updated);
      addToast('Страница сохранена', 'success');
    } catch {
      addToast('Ошибка сохранения', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(page: Page) {
    if (!confirm(`Удалить страницу "${page.title}"?`)) return;
    try {
      await deletePage(page.id);
      setPages(prev => prev.filter(p => p.id !== page.id));
      if (selectedPage?.id === page.id) setSelectedPage(null);
      addToast('Страница удалена', 'success');
    } catch {
      addToast('Ошибка удаления', 'error');
    }
  }

  async function handleRestore(page: Page) {
    try {
      const restored = await restorePage(page.id);
      setPages(prev => [...prev.filter(p => p.id !== page.id), { ...restored, deleted_at: undefined }]);
      (window as any).__deletedPages = ((window as any).__deletedPages as Page[]).filter((p: Page) => p.id !== page.id);
      addToast('Страница восстановлена', 'success');
    } catch {
      addToast('Ошибка восстановления', 'error');
    }
  }

  async function handleCreateChild(parent: Page) {
    setParentForNew(parent.id);
    setNewTitle('');
    setShowCreate(true);
  }

  async function handleCreateRoot() {
    setParentForNew(null);
    setNewTitle('');
    setShowCreate(true);
  }

  async function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    try {
      const created = await createPage({ title: newTitle.trim(), spaceId, parentId: parentForNew });
      setPages(prev => [...prev, created]);
      setShowCreate(false);
      setSelectedPage(created);
      setEditTitle(created.title);
      setEditContent(typeof created.content === 'string' ? created.content : JSON.stringify(created.content || {}));
      addToast('Страница создана', 'success');
    } catch {
      addToast('Ошибка создания', 'error');
    }
  }

  async function handleShowVersions() {
    if (!selectedPage) return;
    setShowVersions(true);
    try {
      const { getPageVersions } = await import('../../lib/api');
      const v = await getPageVersions(selectedPage.id);
      setVersions(v);
    } catch {
      addToast('Ошибка загрузки версий', 'error');
    }
  }

  function renderDeleted() {
    const deleted = (window as any).__deletedPages as Page[] || [];
    return (
      <div className="mt-2 rounded-xl border border-line bg-bg p-3">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-muted">Удалённые страницы</h3>
        {deleted.length === 0 ? <p className="text-sm text-fg-muted">Нет удалённых страниц</p> : (
          <ul className="flex flex-col gap-1">
            {deleted.map((p: Page) => (
              <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate text-fg-secondary">{p.title}</span>
                <button className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-accent hover:text-accent-hover" onClick={() => handleRestore(p)}>
                  <ArrowCounterClockwise size={13} weight="bold" />Восстановить
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-bg">
        <div className="flex items-center gap-2 text-sm text-fg-secondary">
          <CircleNotch size={18} weight="bold" className="animate-spin text-accent" />Загрузка…
        </div>
      </div>
    );
  }
  if (!space) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 bg-bg text-center">
        <XCircle size={36} weight="duotone" className="text-fg-muted" />
        <p className="text-fg-secondary">Пространство не найдено</p>
        <Link href="/spaces" className="text-sm font-medium text-accent hover:text-accent-hover">← К пространствам</Link>
      </div>
    );
  }

  const PanelHeader = ({ title, onClose }: { title: string; onClose: () => void }) => (
    <div className="flex items-center justify-between border-b border-line px-4 py-3">
      <h3 className="text-sm font-semibold text-fg">{title}</h3>
      <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg text-fg-muted hover:bg-surface-hover hover:text-fg" aria-label="Закрыть">
        <X size={15} weight="bold" />
      </button>
    </div>
  );

  return (
    <div className="flex h-[100dvh] bg-bg">
      <ToastContainer />

      {/* Sidebar */}
      <aside className="flex w-72 shrink-0 flex-col border-r border-line bg-surface">
        <div className="flex flex-col gap-3 border-b border-line p-4">
          <Link href="/spaces" className="inline-flex items-center gap-1.5 text-sm font-medium text-fg-secondary transition hover:text-fg">
            <ArrowLeft size={15} weight="bold" />Пространства
          </Link>
          <h2 className="truncate text-lg font-semibold tracking-tight text-fg" title={space.name}>{space.name}</h2>
          <MotionButton variant="subtle" fullWidth onClick={handleCreateRoot} className="!py-2">
            <Plus size={15} weight="bold" />Новая страница
          </MotionButton>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          <PageTree
            pages={pages}
            selectedId={selectedPage?.id ?? null}
            onSelect={handleSelectPage}
            onDelete={handleDelete}
            onAddChild={handleCreateChild}
          />
          {pages.length === 0 && (
            <div className="px-3 py-6 text-center text-sm text-fg-muted">Нет страниц — создайте первую</div>
          )}
        </div>
        <div className="border-t border-line p-3">
          <button className="text-xs font-medium text-fg-muted transition hover:text-fg-secondary" onClick={() => setShowDeleted(d => !d)}>
            {showDeleted ? 'Скрыть удалённые' : 'Показать удалённые'}
          </button>
          {showDeleted && renderDeleted()}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {!selectedPage ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10 text-accent">
              <FileText size={32} weight="duotone" />
            </div>
            <p className="text-fg-secondary">Выберите страницу слева или создайте новую</p>
            <MotionButton onClick={handleCreateRoot}><Plus size={15} weight="bold" />Создать страницу</MotionButton>
          </div>
        ) : (
          <div className="relative flex flex-1 flex-col overflow-hidden">
            <div className="flex items-center gap-3 border-b border-line px-6 py-3.5">
              <input
                className="min-w-0 flex-1 bg-transparent text-lg font-semibold tracking-tight text-fg outline-none placeholder:text-fg-muted"
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                placeholder="Заголовок страницы"
              />
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-fg-secondary transition hover:bg-surface-hover hover:text-fg"
                  onClick={() => { setShowAttachments(a => !a); if (!showAttachments && selectedPage) loadAttachments(selectedPage.id); }}
                >
                  <Paperclip size={15} weight="bold" />Вложения{attachments.length > 0 && ` (${attachments.length})`}
                </button>
                <button
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-fg-secondary transition hover:bg-surface-hover hover:text-fg"
                  onClick={handleShowVersions}
                >
                  <ClockCounterClockwise size={15} weight="bold" />История
                </button>
                <MotionButton onClick={handleSave} loading={saving} className="!py-2">
                  {saving ? 'Сохранение…' : 'Сохранить'}
                </MotionButton>
              </div>
            </div>
            <textarea
              className="min-h-0 flex-1 resize-none bg-bg px-6 py-5 font-mono text-[0.9rem] leading-relaxed text-fg outline-none placeholder:text-fg-muted"
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
              placeholder="Введите содержимое страницы (JSON или текст)"
              spellCheck={false}
            />
            <AnimatePresence>
              {showAttachments && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}
                  className="absolute bottom-5 right-5 z-20 w-80 overflow-hidden rounded-2xl border border-line bg-surface shadow-diffusion-lg"
                >
                  <PanelHeader title="Вложения" onClose={() => setShowAttachments(false)} />
                  <div className="p-4">
                    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-line py-3 text-sm font-medium text-fg-secondary transition hover:border-accent/40 hover:text-fg">
                      {uploading ? <><CircleNotch size={15} weight="bold" className="animate-spin" />Загрузка…</> : <><UploadSimple size={15} weight="bold" />Загрузить файл</>}
                      <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading} />
                    </label>
                    {attachments.length === 0 ? (
                      <p className="mt-3 text-center text-sm text-fg-muted">Нет вложений</p>
                    ) : (
                      <ul className="mt-3 flex flex-col gap-1.5">
                        {attachments.map(a => (
                          <li key={a.id} className="flex items-center gap-2 rounded-lg border border-line bg-bg px-2.5 py-2 text-sm">
                            <span className="min-w-0 flex-1 truncate text-fg">{a.filename}</span>
                            {a.size != null && <span className="shrink-0 font-mono text-xs text-fg-muted">{Math.round((a.size || 0) / 1024)} КБ</span>}
                            <button className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-fg-muted hover:bg-danger/10 hover:text-danger" onClick={() => handleDeleteAttachment(selectedPage!.id, a.id)} title="Удалить">
                              <Trash size={13} weight="bold" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </motion.div>
              )}
              {showVersions && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}
                  className="absolute bottom-5 right-5 z-20 max-h-[70vh] w-96 overflow-hidden rounded-2xl border border-line bg-surface shadow-diffusion-lg"
                >
                  <PanelHeader title="История версий" onClose={() => setShowVersions(false)} />
                  <div className="max-h-[60vh] overflow-y-auto p-3">
                    {versions.length === 0 ? <p className="py-4 text-center text-sm text-fg-muted">Нет версий</p> : versions.map((v: any) => (
                      <div key={v.id} className="flex items-center justify-between gap-3 rounded-lg px-2.5 py-2 transition hover:bg-surface-hover">
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate text-sm font-medium text-fg">{v.title}</span>
                          <span className="font-mono text-xs text-fg-muted">
                            {new Date(v.created_at).toLocaleString('ru')}{v.created_by_username && ` · ${v.created_by_username}`}
                          </span>
                        </div>
                        <button className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-accent hover:text-accent-hover" onClick={async () => {
                          try {
                            const { rollbackPage } = await import('../../lib/api');
                            const updated = await rollbackPage(selectedPage.id, v.id);
                            setPages(prev => prev.map(p => p.id === updated.id ? updated : p));
                            setSelectedPage(updated);
                            setEditTitle(updated.title);
                            setEditContent(typeof updated.content === 'string' ? updated.content : JSON.stringify(updated.content || {}));
                            setShowVersions(false);
                            addToast('Версия восстановлена', 'success');
                          } catch {
                            addToast('Ошибка восстановления', 'error');
                          }
                        }}>
                          <ArrowCounterClockwise size={13} weight="bold" />Восстановить
                        </button>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </main>

      {/* Create modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-fg/20 backdrop-blur-sm" onClick={() => setShowCreate(false)} />
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 240, damping: 24 }}
              className="relative w-full max-w-[400px] rounded-2xl border border-line bg-surface p-6 shadow-diffusion-lg"
            >
              <h2 className="text-lg font-semibold tracking-tight text-fg">{parentForNew ? 'Дочерняя страница' : 'Новая страница'}</h2>
              <form onSubmit={handleCreateSubmit} className="mt-5 flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <label htmlFor="page-title" className="text-sm font-medium text-fg">Заголовок</label>
                  <input
                    id="page-title"
                    className={inputClass}
                    placeholder="Заголовок страницы"
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    autoFocus
                    required
                  />
                </div>
                <div className="flex justify-end gap-2.5">
                  <MotionButton type="button" variant="ghost" onClick={() => setShowCreate(false)}>Отмена</MotionButton>
                  <MotionButton type="submit" disabled={!newTitle.trim()}>Создать</MotionButton>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
