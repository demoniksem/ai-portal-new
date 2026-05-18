'use client';
export const dynamic = 'force-dynamic';
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
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
import type { CardTemplateResponse } from '../../../lib/api';
import styles from './BoardDetail.module.css';

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const add = useCallback((msg: string, t: Toast['type'] = 'success') => {
    const id = Date.now();
    setToasts((p) => [...p, { id, message: msg, type: t }]);
    setTimeout(() => setToasts((p) => p.filter((x) => x.id !== id)), 4000);
  }, []);
  const ToastContainer = () =>
    toasts.length === 0 ? null : (
      <div className={styles.toastContainer}>
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`${styles.toast} ${
              t.type === 'success'
                ? styles.toastSuccess
                : t.type === 'error'
                ? styles.toastError
                : styles.toastInfo
            }`}
          >
            {t.type === 'success' ? '✓ ' : t.type === 'error' ? '✗ ' : 'ℹ '}
            {t.message}
          </div>
        ))}
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
          className={styles.columnMenu}
          ref={(el) => {
            columnMenuRef.current[colId] = el;
          }}
        >
          <button
            className={styles.columnMenuBtn}
            onClick={(e) => {
              e.stopPropagation();
              setOpenColumnMenu(openColumnMenu === colId ? null : colId);
            }}
            title="Действия колонки"
          >
            ⋮
          </button>
          {openColumnMenu === colId && (
            <div className={styles.columnMenuDropdown}>
              <button
                className={styles.columnMenuItem}
                onClick={() => handleRenameColumn(colId)}
              >
                ✏️ Переименовать
              </button>
              <button
                className={`${styles.columnMenuItem} ${styles.columnMenuItemDanger}`}
                onClick={() => handleDeleteColumn(colId)}
              >
                🗑 Удалить
              </button>
            </div>
          )}
        </div>
      );
    },
    [columns, openColumnMenu, handleRenameColumn, handleDeleteColumn]
  );

  // ── Render ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className={styles.loadingState}>
        <div className={styles.spinner} />
        Загрузка доски...
      </div>
    );
  }

  if (error || !board) {
    return (
      <div className={styles.errorState}>
        <span>⚠️ {error || 'Доска не найдена'}</span>
        <Link href="/spaces">
          <button className={styles.actionBtn}>← Вернуться в пространства</button>
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Link href="/spaces" className={styles.backBtn} title="Вернуться">
            ←
          </Link>
          <h1 className={styles.boardTitle}>{board.name}</h1>
        </div>
        <div className={styles.headerActions}>
          <button
            className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
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
            + Карточка
          </button>
          <button
            className={styles.actionBtn}
            onClick={() => setTemplatesOpen(true)}
          >
            📋 Шаблоны
          </button>
        </div>
      </div>

      {/* Board */}
      <div className={styles.boardWrapper}>
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
          <div className={styles.newColumnForm}>
            <input
              className={styles.newColumnInput}
              placeholder="Название колонки..."
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
            <div className={styles.newColumnActions}>
              <button onClick={handleAddColumn}>Добавить</button>
              <button
                onClick={() => {
                  setAddingColumn(false);
                  setNewColumnName('');
                }}
              >
                Отмена
              </button>
            </div>
          </div>
        ) : (
          <button
            className={styles.addColumnBtn}
            onClick={() => setAddingColumn(true)}
          >
            + Добавить колонку
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
