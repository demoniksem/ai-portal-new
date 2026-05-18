'use client';
export const dynamic = 'force-dynamic';
import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { Space, Page } from '../../types/api';
import { getSpaces, createSpace, deleteSpace, getPages } from '../../lib/api';
import styles from '../../styles/Spaces.module.css';

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const addToast = useCallback((message: string, type: Toast['type'] = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);
  const ToastContainer = () => toasts.length === 0 ? null : (
    <div className={styles.toastContainer}>
      {toasts.map(t => (
        <div key={t.id} className={`${styles.toast} ${styles[`toast${t.type.charAt(0).toUpperCase() + t.type.slice(1)}`]}`}>
          {t.type === 'success' ? '✓ ' : t.type === 'error' ? '✗ ' : 'ℹ '}{t.message}
        </div>
      ))}
    </div>
  );
  return { addToast, ToastContainer };
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export default function SpacesPage() {
  const router = typeof window !== 'undefined' ? useRouter() : null;
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const { addToast, ToastContainer } = useToast();

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  useEffect(() => {
    if (!token) { if (router) router.push('/login'); else window.location.href = '/login'; return; }
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [s, p] = await Promise.all([getSpaces(), getPages()]);
      setSpaces(s);
      setPages(p);
    } catch {
      addToast('Не удалось загрузить данные', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const space = await createSpace({ name: newName.trim(), slug: slugify(newName.trim()) });
      setSpaces(prev => [...prev, space]);
      setNewName('');
      setShowCreate(false);
      addToast(`Пространство "${space.name}" создано`, 'success');
      if (router) router.push(`/spaces/${space.id}`);
      else window.location.href = `/spaces/${space.id}`;
    } catch {
      addToast('Ошибка при создании пространства', 'error');
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(e: React.MouseEvent, space: Space) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Удалить пространство "${space.name}"?`)) return;
    setDeletingId(space.id);
    try {
      await deleteSpace(space.id);
      setSpaces(prev => prev.filter(s => s.id !== space.id));
      addToast(`Пространство "${space.name}" удалено`, 'success');
    } catch {
      addToast('Ошибка при удалении пространства', 'error');
    } finally {
      setDeletingId(null);
    }
  }

  function getPageCount(spaceId: number) {
    return pages.filter(p => p.space_id === spaceId).length;
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <ToastContainer />
        <header className={styles.header}>
          <h1>📁 Пространства</h1>
        </header>
        <div className={styles.grid}>
          {[1, 2, 3].map(i => <div key={i} className={styles.skeleton} />)}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <ToastContainer />
      <header className={styles.header}>
        <div className={styles.headerRow}>
          <h1>📁 Пространства</h1>
          <div className={styles.headerActions}>
            <button className={styles.btnPrimary} onClick={() => setShowCreate(true)}>+ Новое пространство</button>
            <Link href="/" className={styles.btnSecondary}>← Канбан</Link>
          </div>
        </div>
      </header>

      {showCreate && (
        <div className={styles.modalOverlay} onClick={() => setShowCreate(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h2>Новое пространство</h2>
            <form onSubmit={handleCreate}>
              <input
                className={styles.input}
                placeholder="Название пространства"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                autoFocus
                required
              />
              <div className={styles.modalActions}>
                <button type="button" className={styles.btnSecondary} onClick={() => setShowCreate(false)}>Отмена</button>
                <button type="submit" className={styles.btnPrimary} disabled={creating}>
                  {creating ? 'Создание...' : 'Создать'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {spaces.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>📁</div>
          <div className={styles.emptyTitle}>Нет пространств</div>
          <div className={styles.emptyText}>Создайте первое пространство для организации страниц</div>
          <button className={styles.btnPrimary} onClick={() => setShowCreate(true)} style={{ marginTop: '16px' }}>+ Создать пространство</button>
        </div>
      ) : (
        <div className={styles.grid}>
          {spaces.map(space => (
            <Link href={`/spaces/${space.id}`} key={space.id} className={styles.card}>
              <div className={styles.cardHeader}>
                <h2 className={styles.cardTitle}>{space.name}</h2>
                <button
                  className={styles.deleteBtn}
                  onClick={e => handleDelete(e, space)}
                  disabled={deletingId === space.id}
                  title="Удалить пространство"
                >
                  {deletingId === space.id ? '...' : '×'}
                </button>
              </div>
              <div className={styles.cardMeta}>
                <span>slug: {space.slug}</span>
                <span>{getPageCount(space.id)} страниц</span>
              </div>
              <div className={styles.cardArrow}>→</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
