'use client';
export const dynamic = 'force-dynamic';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { SpaceDetail, Page, PageBlock, PageAttachment } from '../../types/api';
import { getSpaceById, getPages, createPage, updatePage, deletePage, restorePage, getAttachments, addAttachment, deleteAttachment } from '../../lib/api';
import styles from '../../styles/SpaceDetail.module.css';

interface Toast { id: number; message: string; type: 'success' | 'error' | 'info'; }
function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const add = useCallback((msg: string, t: Toast['type'] = 'success') => {
    const id = Date.now();
    setToasts(p => [...p, { id, message: msg, type: t }]);
    setTimeout(() => setToasts(p => p.filter(x => x.id !== id)), 4000);
  }, []);
  const ToastContainer = () => toasts.length === 0 ? null : (
    <div className={styles.toastContainer}>
      {toasts.map(t => <div key={t.id} className={`${styles.toast} ${styles[`toast${t.type.charAt(0).toUpperCase() + t.type.slice(1)}`]}`}>
        {t.type === 'success' ? '✓ ' : t.type === 'error' ? '✗ ' : 'ℹ '}{t.message}
      </div>)}
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
      <div key={page.id} className={styles.treeItem}>
        <div className={`${styles.treeRow} ${isSelected ? styles.treeRowSelected : ''}`} style={{ paddingLeft: `${12 + d * 18}px` }}>
          <button className={styles.treeBtn} onClick={() => onSelect(page)} title={page.title}>
            <span className={styles.treeIcon}>{children.length > 0 ? (isSelected ? '📂' : '📁') : '📄'}</span>
            <span className={styles.treeLabel}>{page.title}</span>
          </button>
          <div className={styles.treeActions}>
            <button className={styles.treeActionBtn} onClick={() => onAddChild(page)} title="Добавить дочернюю">+</button>
            <button className={styles.treeActionBtn} onClick={() => onDelete(page)} title="Удалить">×</button>
          </div>
        </div>
        {children.map(child => renderPage(child, d + 1))}
      </div>
    );
  }

  return <div>{rootPages.map(p => renderPage(p, depth))}</div>;
}

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
      <div className={styles.deletedPanel}>
        <h3>Удалённые страницы</h3>
        {deleted.length === 0 ? <p className={styles.emptyText}>Нет удалённых страниц</p> : (
          <ul className={styles.deletedList}>
            {deleted.map((p: Page) => (
              <li key={p.id} className={styles.deletedItem}>
                <span>{p.title}</span>
                <button className={styles.restoreBtn} onClick={() => handleRestore(p)}>Восстановить</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  if (loading) return <div className={styles.loading}>Загрузка...</div>;
  if (!space) return <div className={styles.error}>Пространство не найдено</div>;

  return (
    <div className={styles.layout}>
      <ToastContainer />
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <Link href="/spaces" className={styles.backLink}>← Пространства</Link>
          <h2 className={styles.spaceName}>{space.name}</h2>
          <button className={styles.addRootBtn} onClick={handleCreateRoot}>+ Новая страница</button>
        </div>
        <div className={styles.tree}>
          <PageTree
            pages={pages}
            selectedId={selectedPage?.id ?? null}
            onSelect={handleSelectPage}
            onDelete={handleDelete}
            onAddChild={handleCreateChild}
          />
          {pages.length === 0 && (
            <div className={styles.emptyTree}>Нет страниц — создайте первую</div>
          )}
        </div>
        <div className={styles.sidebarFooter}>
          <button className={styles.deletedToggle} onClick={() => setShowDeleted(d => !d)}>
            {showDeleted ? 'Скрыть удалённые' : 'Показать удалённые'}
          </button>
        </div>
        {showDeleted && renderDeleted()}
      </aside>

      {/* Main content */}
      <main className={styles.main}>
        {!selectedPage ? (
          <div className={styles.noSelection}>
            <div className={styles.noSelectionIcon}>📄</div>
            <p>Выберите страницу слева или создайте новую</p>
            <button className={styles.btnPrimary} onClick={handleCreateRoot}>+ Создать страницу</button>
          </div>
        ) : (
          <div className={styles.editor}>
            <div className={styles.editorHeader}>
              <input
                className={styles.titleInput}
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                placeholder="Заголовок страницы"
              />
              <div className={styles.editorActions}>
                <button className={styles.btnSecondary} onClick={() => { setShowAttachments(a => !a); if (!showAttachments && selectedPage) loadAttachments(selectedPage.id); }}>Вложения {attachments.length > 0 && `(${attachments.length})`}</button>
                <button className={styles.btnSecondary} onClick={handleShowVersions}>История</button>
                <button className={styles.btnPrimary} onClick={handleSave} disabled={saving}>
                  {saving ? 'Сохранение...' : '💾 Сохранить'}
                </button>
              </div>
            </div>
            <textarea
              className={styles.contentEditor}
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
              placeholder="Введите содержимое страницы (JSON или текст)"
              spellCheck={false}
            />
            {showAttachments && (
              <div className={styles.versionsPanel}>
                <div className={styles.versionsHeader}>
                  <h3>Вложения</h3>
                  <button onClick={() => setShowAttachments(false)}>×</button>
                </div>
                <div className={styles.attachmentsList}>
                  <label className={styles.uploadBtn}>
                    {uploading ? 'Загрузка...' : '+ Загрузить файл'}
                    <input type="file" style={{ display: 'none' }} onChange={handleFileUpload} disabled={uploading} />
                  </label>
                  {attachments.length === 0 ? (
                    <p className={styles.emptyText}>Нет вложений</p>
                  ) : (
                    <ul className={styles.attachmentItems}>
                      {attachments.map(a => (
                        <li key={a.id} className={styles.attachmentItem}>
                          <span className={styles.attachmentName}>{a.filename}</span>
                          {a.size && <span className={styles.attachmentSize}>{Math.round((a.size || 0) / 1024)} КБ</span>}
                          <button className={styles.deleteBtn} onClick={() => handleDeleteAttachment(selectedPage!.id, a.id)} title="Удалить">×</button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
            {showVersions && (
              <div className={styles.versionsPanel}>
                <div className={styles.versionsHeader}>
                  <h3>История версий</h3>
                  <button onClick={() => setShowVersions(false)}>×</button>
                </div>
                <div className={styles.versionsList}>
                  {versions.length === 0 ? <p className={styles.emptyText}>Нет версий</p> : versions.map((v: any) => (
                    <div key={v.id} className={styles.versionItem}>
                      <div className={styles.versionMeta}>
                        <span className={styles.versionTitle}>{v.title}</span>
                        <span className={styles.versionDate}>{new Date(v.created_at).toLocaleString('ru')}</span>
                        {v.created_by_username && <span className={styles.versionAuthor}>{v.created_by_username}</span>}
                      </div>
                      <button className={styles.restoreBtn} onClick={async () => {
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
                      }}>Восстановить</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Create modal */}
      {showCreate && (
        <div className={styles.modalOverlay} onClick={() => setShowCreate(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h2>{parentForNew ? 'Дочерняя страница' : 'Новая страница'}</h2>
            <form onSubmit={handleCreateSubmit}>
              <input
                className={styles.input}
                placeholder="Заголовок страницы"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                autoFocus
                required
              />
              <div className={styles.modalActions}>
                <button type="button" className={styles.btnSecondary} onClick={() => setShowCreate(false)}>Отмена</button>
                <button type="submit" className={styles.btnPrimary}>Создать</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
