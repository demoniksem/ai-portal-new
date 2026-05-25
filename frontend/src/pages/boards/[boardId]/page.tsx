'use client';
export const dynamic = 'force-dynamic';
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  getBoard,
  updateCard,
  createCard,
  createColumn,
  updateColumn,
  deleteColumn,
} from '../../../lib/api';
import type {
  BoardResponse,
  BoardColumnResponse,
  BoardCardResponse,
  BoardSwimlaneResponse,
} from '../../../lib/api';
import { KanbanBoard, KanbanColumnDef, KanbanSwimlaneDef, KanbanCardData } from '../../../components/kanban/KanbanBoard';
import { CardModal } from '../../../components/kanban/CardModal';
import { TemplatesDialog } from '../../../components/kanban/TemplatesDialog';
import {
  PencilSimple, Trash, Warning, Kanban, ArrowLeft, Plus, DotsThreeVertical,
  CheckCircle, XCircle, Info, CircleNotch,
} from '@phosphor-icons/react';
import type { CardTemplateResponse } from '../../../lib/api';
import { MotionButton } from '../../../components/ui/MotionButton';

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
  const add = useCallback((msg: string, t: Toast['type'] = 'success') => {
    const id = Date.now();
    setToasts((p) => [...p, { id, message: msg, type: t }]);
    setTimeout(() => setToasts((p) => p.filter((x) => x.id !== id)), 4000);
  }, []);
  const ToastContainer = () => (
    <div className="pointer-events-none fixed bottom-6 right-6 z-50 flex flex-col gap-2.5">
      <AnimatePresence>
        {toasts.map((t) => {
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

type KanbanCardStatus = 'backlog' | 'todo' | 'in_progress' | 'review' | 'done' | 'blocked';

export default function BoardDetailPage() {
  const router = typeof window !== 'undefined' ? useRouter() : null;
  const [boardId, setBoardId] = useState<string | null>(null);

  const [board, setBoard] = useState<BoardResponse | null>(null);
  const [columns, setColumns] = useState<BoardColumnResponse[]>([]);
  const [swimlanes, setSwimlanes] = useState<BoardSwimlaneResponse[]>([]);
  const [cards, setCards] = useState<BoardCardResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selected card for the modal
  const [selectedCard, setSelectedCard] = useState<BoardCardResponse | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Templates dialog state
  const [templatesOpen, setTemplatesOpen] = useState(false);

  // New column inline form
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');

  // Column menu state (columnId -> open)
  const [openColumnMenu, setOpenColumnMenu] = useState<string | null>(null);
  const columnMenuRef = useRef<Record<string, HTMLDivElement | null>>({});

  const { addToast, ToastContainer } = useToast();

  // Hydrate boardId from router after mount (avoids useRouter during prerender)
  useEffect(() => {
    if (!router) return;
    const id = (router.query as { boardId?: string }).boardId;
    if (id) setBoardId(id);
  }, [router]);

  // Load board data
  const loadBoard = useCallback(async () => {
    if (!boardId) return;
    try {
      const data = await getBoard(boardId);
      setBoard(data);
      setColumns(data.columns ?? []);
      setSwimlanes(data.swimlanes ?? []);
      setCards(data.cards ?? []);
      setError(null);
    } catch (err) {
      setError('Не удалось загрузить доску');
      addToast('Ошибка загрузки доски', 'error');
    } finally {
      setLoading(false);
    }
  }, [boardId, addToast]);

  useEffect(() => {
    loadBoard();
  }, [loadBoard]);

  // Close column menu on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (openColumnMenu) {
        const ref = columnMenuRef.current[openColumnMenu];
        if (ref && !ref.contains(e.target as Node)) {
          setOpenColumnMenu(null);
        }
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [openColumnMenu]);

  // ── Card operations ──────────────────────────────────────────────

  // Maps column UUID -> KanbanCardStatus string for use in onCardMove callbacks.
  // Built from columns order: first column='backlog', second='todo', etc.
  const columnIdToStatus = useMemo(() => {
    const statusCycle: KanbanCardStatus[] = ['backlog', 'todo', 'in_progress', 'review', 'done', 'blocked'];
    const map: Record<string, KanbanCardStatus> = {};
    columns.forEach((col, i) => {
      map[col.id] = statusCycle[i % statusCycle.length];
    });
    return map;
  }, [columns]);

  const handleCardClick = useCallback((card: BoardCardResponse) => {
    setSelectedCard(card);
    setSelectedCardId(card.id);
    setModalOpen(true);
  }, []);

  const handleCardAdd = useCallback(
    async (status: KanbanCardStatus) => {
      if (!boardId) return;
      // Find the column that maps to this status (first match)
      const targetCol = Object.entries(columnIdToStatus).find(([, s]) => s === status);
      if (!targetCol) return;
      const [, columnId] = targetCol;
      const title = window.prompt('Название карточки:');
      if (!title?.trim()) return;
      try {
        const newCard = await createCard({
          boardId,
          title: title.trim(),
          type: 'task',
          priority: 'medium',
          columnId,
        });
        setCards((prev) => [...prev, newCard]);
        addToast('Карточка создана', 'success');
      } catch {
        addToast('Ошибка создания карточки', 'error');
      }
    },
    [boardId, addToast, columnIdToStatus]
  );

  const handleCardMove = useCallback(
    async (cardId: string, newStatus: KanbanCardStatus) => {
      // Find the column UUID for this status
      const targetColId = Object.entries(columnIdToStatus).find(([, s]) => s === newStatus)?.[0];
      if (!targetColId) return;
      // Optimistic update
      setCards((prev) =>
        prev.map((c) => (c.id === cardId ? { ...c, column_id: targetColId } : c))
      );
      try {
        const updated = await updateCard(cardId, { column_id: targetColId });
        setCards((prev) => prev.map((c) => (c.id === cardId ? updated : c)));
      } catch {
        // Revert optimistic update
        setCards((prev) =>
          prev.map((c) => {
            const orig = cards.find((x) => x.id === cardId);
            return c.id === cardId && orig ? orig : c;
          })
        );
        addToast('Ошибка перемещения карточки', 'error');
      }
    },
    [cards, addToast, columnIdToStatus]
  );

  const handleCardUpdated = useCallback((updated: BoardCardResponse) => {
    setCards((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    setSelectedCard(updated);
  }, []);

  const handleCardDeleted = useCallback(
    (cardId: string) => {
      setCards((prev) => prev.filter((c) => c.id !== cardId));
      setModalOpen(false);
      setSelectedCard(null);
    },
    []
  );

  const handleApplyTemplate = useCallback(
    (template: CardTemplateResponse) => {
      // Open the card modal pre-filled with template data
      const title = template.title_template || template.name;
      const description = template.description_template || template.description || '';
      const type = (template.type as BoardCardResponse['type']) || 'task';
      // Prompt the user for a final title (template is pre-fill, not auto-create)
      const finalTitle = window.prompt('Название карточки (на основе шаблона):', title);
      if (!finalTitle?.trim() || !boardId || columns.length === 0) return;
      const firstColId = columns[0].id;
      createCard({
        boardId,
        title: finalTitle.trim(),
        description: description || undefined,
        type,
        columnId: firstColId,
      })
        .then((card) => {
          setCards((prev) => [...prev, card]);
          addToast('Карточка создана из шаблона', 'success');
        })
        .catch(() => addToast('Ошибка создания карточки', 'error'));
    },
    [boardId, columns, addToast]
  );

  // ── Column operations ──────────────────────────────────────────────

  const handleAddColumn = async () => {
    if (!boardId || !newColumnName.trim()) return;
    try {
      const col = await createColumn(boardId, { name: newColumnName.trim() });
      setColumns((prev) => [...prev, col]);
      setNewColumnName('');
      setAddingColumn(false);
      addToast('Колонка добавлена', 'success');
    } catch {
      addToast('Ошибка добавления колонки', 'error');
    }
  };

  const handleRenameColumn = async (columnId: string) => {
    const newName = window.prompt('Новое название колонки:');
    if (!newName?.trim()) return;
    try {
      const updated = await updateColumn(columnId, { name: newName.trim() });
      setColumns((prev) => prev.map((c) => (c.id === columnId ? updated : c)));
      addToast('Колонка переименована', 'success');
    } catch {
      addToast('Ошибка переименования колонки', 'error');
    }
    setOpenColumnMenu(null);
  };

  const handleDeleteColumn = async (columnId: string) => {
    if (!boardId) return;
    const count = cards.filter((c) => c.column_id === columnId).length;
    if (!confirm(`Удалить колонку "${columns.find((c) => c.id === columnId)?.name}" и все ${count} карточек в ней?`)) return;
    try {
      await deleteColumn(boardId, columnId);
      setColumns((prev) => prev.filter((c) => c.id !== columnId));
      setCards((prev) => prev.filter((c) => c.column_id !== columnId));
      addToast('Колонка удалена', 'success');
    } catch {
      addToast('Ошибка удаления колонки', 'error');
    }
    setOpenColumnMenu(null);
  };

  // ── KanbanBoard adapter ────────────────────────────────────────────

  // Map API cards to KanbanBoard expected shape
  const kanbanCards = cards.map((card) => ({
    id: card.id,
    title: card.title,
    description: card.description,
    status: (columnIdToStatus[card.column_id] ?? 'backlog') as KanbanCardStatus,
    priority: (card.priority === 'urgent' ? 'critical' : card.priority) as KanbanCardData['priority'],
    assignee: card.assignees?.[0]
      ? { name: card.assignees[0].full_name || card.assignees[0].user_id }
      : undefined,
    labels: card.labels?.map((l) => ({ text: l.name, color: l.color })),
    dueDate: card.deadline,
    commentCount: 0,
    attachmentCount: 0,
    checklistProgress: undefined,
    cardNumber: card.id.slice(0, 8),
  }));

  const kanbanColumns: KanbanColumnDef[] = columns.map((col) => ({
    id: col.id as KanbanCardStatus,
    title: col.name,
    wipLimit: col.wip_limit,
  }));

  const kanbanSwimlanes: KanbanSwimlaneDef[] | undefined =
    swimlanes.length > 0
      ? swimlanes.map((sl) => ({ id: sl.id, title: sl.name }))
      : undefined;

  // Per-column header renderer — injects rename/delete menu via headerExtra
  const renderColumnHeader = useCallback(
    (col: KanbanColumnDef) => {
      const apiCol = columns.find((c) => c.id === col.id);
      if (!apiCol) return null;
      const colId = apiCol.id;
      return (
        <div
          className="relative"
          ref={(el) => {
            columnMenuRef.current[colId] = el;
          }}
        >
          <button
            className="flex h-7 w-7 items-center justify-center rounded-lg text-fg-muted transition hover:bg-surface-hover hover:text-fg"
            onClick={(e) => {
              e.stopPropagation();
              setOpenColumnMenu(openColumnMenu === colId ? null : colId);
            }}
            title="Действия колонки"
          >
            <DotsThreeVertical size={18} weight="bold" />
          </button>
          <AnimatePresence>
            {openColumnMenu === colId && (
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.97 }}
                transition={{ duration: 0.12 }}
                className="absolute right-0 top-9 z-30 min-w-[170px] overflow-hidden rounded-xl border border-line bg-surface p-1 shadow-diffusion-lg"
              >
                <button
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-fg-secondary transition hover:bg-surface-hover hover:text-fg"
                  onClick={() => handleRenameColumn(colId)}
                >
                  <PencilSimple size={15} weight="bold" />Переименовать
                </button>
                <button
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-danger transition hover:bg-danger/10"
                  onClick={() => handleDeleteColumn(colId)}
                >
                  <Trash size={15} weight="bold" />Удалить
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      );
    },
    [columns, openColumnMenu, handleRenameColumn, handleDeleteColumn]
  );

  // ── Render ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-bg">
        <div className="flex items-center gap-2 text-sm text-fg-secondary">
          <CircleNotch size={18} weight="bold" className="animate-spin text-accent" />Загрузка доски…
        </div>
      </div>
    );
  }

  if (error || !board) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-bg text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-danger/10 text-danger">
          <Warning size={28} weight="fill" />
        </div>
        <p className="text-fg-secondary">{error || 'Доска не найдена'}</p>
        <Link href="/spaces">
          <MotionButton variant="subtle"><ArrowLeft size={15} weight="bold" />Вернуться в пространства</MotionButton>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] flex-col bg-bg">
      {/* Header */}
      <header className="flex items-center justify-between gap-4 border-b border-line bg-surface px-5 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/spaces"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-fg-muted transition hover:bg-surface-hover hover:text-fg"
            title="Вернуться"
            aria-label="Вернуться"
          >
            <ArrowLeft size={18} weight="bold" />
          </Link>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
            <Kanban size={18} weight="fill" />
          </span>
          <h1 className="truncate text-lg font-semibold tracking-tight text-fg" title={board.name}>{board.name}</h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3.5 py-2 text-sm font-medium text-fg-secondary transition hover:bg-surface-hover hover:text-fg active:scale-[0.98]"
            onClick={() => setTemplatesOpen(true)}
          >
            <Kanban size={16} weight="bold" />Шаблоны
          </button>
          <MotionButton
            onClick={() => {
              const title = window.prompt('Название карточки:');
              if (!title?.trim() || !boardId) return;
              createCard({
                boardId,
                title: title.trim(),
                type: 'task',
                priority: 'medium',
                columnId: columns[0]?.id,
              }).then((card) => {
                setCards((prev) => [...prev, card]);
                addToast('Карточка создана', 'success');
              }).catch(() => addToast('Ошибка создания', 'error'));
            }}
          >
            <Plus size={16} weight="bold" />Карточка
          </MotionButton>
        </div>
      </header>

      {/* Board */}
      <div className="flex min-h-0 flex-1 items-start gap-4 overflow-x-auto p-5">
        <KanbanBoard
          columns={kanbanColumns}
          swimlanes={kanbanSwimlanes}
          cards={kanbanCards}
          onCardMove={(cardId, newStatus) => handleCardMove(cardId, newStatus as KanbanCardStatus)}
          onCardClick={(kanbanCard) => {
            const apiCard = cards.find((c) => c.id === kanbanCard.id);
            if (apiCard) handleCardClick(apiCard);
          }}
          onCardAdd={(status) => handleCardAdd(status as KanbanCardStatus)}
          renderColumnHeader={renderColumnHeader}
        />

        {/* Add column */}
        {addingColumn ? (
          <div className="flex w-72 shrink-0 flex-col gap-2 rounded-2xl border border-line bg-surface p-3">
            <input
              className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-fg outline-none transition placeholder:text-fg-muted focus:border-accent focus:ring-4 focus:ring-accent/15"
              placeholder="Название колонки…"
              value={newColumnName}
              onChange={(e) => setNewColumnName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddColumn();
                if (e.key === 'Escape') {
                  setAddingColumn(false);
                  setNewColumnName('');
                }
              }}
              autoFocus
            />
            <div className="flex gap-2">
              <MotionButton onClick={handleAddColumn} className="!py-1.5 text-xs">Добавить</MotionButton>
              <MotionButton
                variant="ghost"
                className="!py-1.5 text-xs"
                onClick={() => {
                  setAddingColumn(false);
                  setNewColumnName('');
                }}
              >
                Отмена
              </MotionButton>
            </div>
          </div>
        ) : (
          <button
            className="flex w-72 shrink-0 items-center justify-center gap-2 rounded-2xl border border-dashed border-line bg-surface/50 px-4 py-3 text-sm font-medium text-fg-secondary transition hover:border-accent/40 hover:bg-surface-hover hover:text-fg"
            onClick={() => setAddingColumn(true)}
          >
            <Plus size={16} weight="bold" />Добавить колонку
          </button>
        )}
      </div>

      {/* Card Modal */}
      {boardId && (
        <CardModal
          card={selectedCard ?? undefined}
          cardId={selectedCardId ?? undefined}
          boardId={boardId}
          columns={columns}
          open={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setSelectedCard(null);
          }}
          onCardUpdated={handleCardUpdated}
          onCardDeleted={handleCardDeleted}
        />
      )}

      {/* Templates Dialog */}
      {boardId && (
        <TemplatesDialog
          boardId={boardId}
          open={templatesOpen}
          onClose={() => setTemplatesOpen(false)}
          onApplyTemplate={handleApplyTemplate}
        />
      )}

      <ToastContainer />
    </div>
  );
}
