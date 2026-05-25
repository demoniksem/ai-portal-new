'use client';
export const dynamic = 'force-dynamic';
import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FolderSimple, Plus, Trash, ArrowUpRight, House,
  CheckCircle, XCircle, Info, CircleNotch,
} from '@phosphor-icons/react';
import { Space, Page } from '../../types/api';
import { getSpaces, createSpace, deleteSpace, getPages } from '../../lib/api';
import { MotionButton } from '../../components/ui/MotionButton';

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

const TOAST_ICON = { success: CheckCircle, error: XCircle, info: Info } as const;
const TOAST_TONE = {
  success: 'border-success/30 text-success',
  error: 'border-danger/30 text-danger',
  info: 'border-accent/30 text-accent',
} as const;

function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const addToast = useCallback((message: string, type: Toast['type'] = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
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
  return { addToast, ToastContainer };
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const GRID = { show: { transition: { staggerChildren: 0.05 } } };
const CARD = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 140, damping: 20 } },
};

const inputClass =
  'w-full rounded-xl border border-line bg-bg py-2.5 px-3.5 text-[0.95rem] text-fg ' +
  'placeholder:text-fg-muted outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/15';

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

  return (
    <div className="min-h-[100dvh] bg-bg">
      <ToastContainer />

      <div className="mx-auto max-w-[1100px] px-6 py-10 sm:px-8">
        {/* Header — left-aligned, eyebrow over title */}
        <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-accent">
              <FolderSimple size={18} weight="fill" />
              Рабочая область
            </div>
            <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-fg sm:text-[1.7rem]">
              Пространства
            </h1>
          </div>
          <div className="flex items-center gap-2.5">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm font-medium text-fg-secondary transition hover:bg-surface-hover hover:text-fg"
            >
              <House size={16} weight="bold" />
              К доскам
            </Link>
            <MotionButton onClick={() => setShowCreate(true)}>
              <Plus size={16} weight="bold" />
              Новое пространство
            </MotionButton>
          </div>
        </header>

        {/* Body */}
        <div className="mt-8">
          {loading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2, 3, 4, 5].map(i => (
                <div
                  key={i}
                  className="h-[132px] animate-pulse rounded-2xl border border-line bg-surface"
                  style={{ animationDelay: `${i * 80}ms` }}
                />
              ))}
            </div>
          ) : spaces.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 120, damping: 20 }}
              className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-line bg-surface/60 px-6 py-20 text-center"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                <FolderSimple size={32} weight="duotone" />
              </div>
              <h2 className="mt-5 text-lg font-semibold text-fg">Пока нет пространств</h2>
              <p className="mt-1.5 max-w-[40ch] text-[0.95rem] leading-relaxed text-fg-secondary">
                Создайте первое пространство, чтобы сгруппировать страницы и документацию команды.
              </p>
              <MotionButton onClick={() => setShowCreate(true)} className="mt-6">
                <Plus size={16} weight="bold" />
                Создать пространство
              </MotionButton>
            </motion.div>
          ) : (
            <motion.div
              variants={GRID}
              initial="hidden"
              animate="show"
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
            >
              {spaces.map(space => (
                <motion.div key={space.id} variants={CARD} layout>
                  <Link
                    href={`/spaces/${space.id}`}
                    className="group relative flex h-full flex-col gap-3 overflow-hidden rounded-2xl border border-line bg-surface p-5 transition-colors hover:border-accent/40 hover:bg-surface-hover"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="text-base font-semibold leading-tight tracking-tight text-fg">
                        {space.name}
                      </h2>
                      <button
                        type="button"
                        onClick={e => handleDelete(e, space)}
                        disabled={deletingId === space.id}
                        title="Удалить пространство"
                        aria-label={`Удалить пространство ${space.name}`}
                        className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-fg-muted opacity-0 transition hover:bg-danger/10 hover:text-danger focus-visible:opacity-100 group-hover:opacity-100 disabled:opacity-100"
                      >
                        {deletingId === space.id
                          ? <CircleNotch size={16} weight="bold" className="animate-spin" />
                          : <Trash size={16} weight="bold" />}
                      </button>
                    </div>

                    <div className="mt-auto flex items-center gap-3 text-[0.82rem] text-fg-muted">
                      <span className="rounded-md bg-bg-alt px-2 py-0.5 font-mono text-fg-secondary">
                        {space.slug}
                      </span>
                      <span>{getPageCount(space.id)} стр.</span>
                    </div>

                    <ArrowUpRight
                      size={18}
                      weight="bold"
                      className="absolute right-4 top-1/2 -translate-y-1/2 translate-x-1 text-accent opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100"
                    />
                  </Link>
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      </div>

      {/* Create dialog */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              className="absolute inset-0 bg-fg/20 backdrop-blur-sm"
              onClick={() => setShowCreate(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 240, damping: 24 }}
              className="relative w-full max-w-[400px] rounded-2xl border border-line bg-surface p-6 shadow-diffusion-lg"
            >
              <h2 className="text-lg font-semibold tracking-tight text-fg">Новое пространство</h2>
              <p className="mt-1 text-sm text-fg-secondary">
                Slug сформируется автоматически из названия.
              </p>
              <form onSubmit={handleCreate} className="mt-5 flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <label htmlFor="space-name" className="text-sm font-medium text-fg">
                    Название
                  </label>
                  <input
                    id="space-name"
                    className={inputClass}
                    placeholder="Например, Документация продукта"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    autoFocus
                    required
                  />
                  {newName.trim() && (
                    <span className="text-xs text-fg-muted">
                      slug: <span className="font-mono text-fg-secondary">{slugify(newName.trim())}</span>
                    </span>
                  )}
                </div>
                <div className="flex justify-end gap-2.5">
                  <MotionButton type="button" variant="ghost" onClick={() => setShowCreate(false)}>
                    Отмена
                  </MotionButton>
                  <MotionButton type="submit" loading={creating} disabled={!newName.trim()}>
                    {creating ? 'Создание…' : 'Создать'}
                  </MotionButton>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
