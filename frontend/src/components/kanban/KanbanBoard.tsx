import React, { useCallback, useState, useRef } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from '@dnd-kit/core';
import styles from './KanbanBoard.module.css';
import { KanbanColumn } from './KanbanColumn';
import { KanbanSwimlane } from './KanbanSwimlane';
import { KanbanCard } from './KanbanCard';

// ── Types ───────────────────────────────────────────────────

export type KanbanCardStatus =
  | 'backlog'
  | 'todo'
  | 'in_progress'
  | 'review'
  | 'done'
  | 'blocked';

export interface KanbanCardData {
  id: string;
  title: string;
  description?: string;
  status: KanbanCardStatus;
  priority?: 'critical' | 'high' | 'medium' | 'low';
  assignee?: { name: string; avatar?: string };
  labels?: { text: string; color?: string }[];
  dueDate?: string;
  commentCount?: number;
  attachmentCount?: number;
  blockedBy?: string[];
  checklistProgress?: { done: number; total: number };
  cardNumber?: string;
}

export interface KanbanColumnDef {
  id: KanbanCardStatus;
  title: string;
  wipLimit?: number;
}

export interface KanbanSwimlaneDef {
  id: string;
  title: string;
}

export interface KanbanBoardProps {
  columns: KanbanColumnDef[];
  swimlanes?: KanbanSwimlaneDef[];
  cards: KanbanCardData[];
  onCardMove: (cardId: string, newStatus: KanbanCardStatus, newSwimlaneId?: string) => void;
  onCardClick?: (card: KanbanCardData) => void;
  onColumnAdd?: () => void;
  onCardAdd?: (status: KanbanCardStatus, swimlaneId?: string) => void;
  className?: string;
  /** Optional per-column header renderer. Receives the column def; return value is
   *  rendered inside the column header right area, after the WIP badge and add-btn.
   *  Use this to inject column-level action menus (rename/delete). */
  renderColumnHeader?: (column: KanbanColumnDef) => React.ReactNode;
}

// ── Board ───────────────────────────────────────────────────

export function KanbanBoard({
  columns,
  swimlanes,
  cards,
  onCardMove,
  onCardClick,
  onCardAdd,
  className = '',
  renderColumnHeader,
}: KanbanBoardProps) {
  const [activeCard, setActiveCard] = useState<KanbanCardData | null>(null);
  // Captures the target column during the drag so handleDragEnd can decide
  // whether to call onCardMove even after activeCard is cleared.
  const dragTargetStatus = useRef<KanbanCardStatus | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6, // 6px movement before drag starts — prevents accidental drags on click
      },
    })
  );

  const findColumnByCardId = useCallback(
    (cardId: string): KanbanCardStatus | null => {
      return cards.find((c) => c.id === cardId)?.status ?? null;
    },
    [cards]
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const card = cards.find((c) => c.id === event.active.id);
      if (card) setActiveCard(card);
    },
    [cards]
  );

  // handleDragOver — only update the drag-overlay visual state (activeCard position),
  // do NOT call onCardMove here; that is exclusively handled in handleDragEnd
  // to avoid duplicate API calls when the user drags across multiple columns.
  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;
      if (!over || !activeCard) return;

      const activeId = String(active.id);
      const overId = String(over.id);
      if (activeId === overId) return;

      // Track which card is being dragged over for the DragOverlay — the actual
      // column-swap is deferred to handleDragEnd.
      const overCard = cards.find((c) => c.id === overId);
      if (overCard) {
        dragTargetStatus.current = overCard.status;
        if (overCard.status !== activeCard.status) {
          setActiveCard({ ...activeCard, status: overCard.status });
        }
      } else {
        dragTargetStatus.current = overId as KanbanCardStatus;
      }
    },
    [activeCard, cards]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveCard(null);
      const { active, over } = event;
      if (!over) return;

      const activeId = String(active.id);
      const overId = String(over.id);

      const overCard = cards.find((c) => c.id === overId);
      const targetStatus: KanbanCardStatus = overCard?.status ?? (overId as KanbanCardStatus);
      const sourceStatus = findColumnByCardId(activeId);

      // Only call onCardMove when the card actually moved to a different column.
      if (sourceStatus && sourceStatus !== targetStatus) {
        onCardMove(activeId, targetStatus);
      }
      // Reset for next drag.
      dragTargetStatus.current = null;
    },
    [cards, findColumnByCardId, onCardMove]
  );

  const boardClass = [
    styles.board,
    swimlanes && swimlanes.length > 0 ? styles['board--swimlanes'] : styles['board--flat'],
    'kanban-board-scroll',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      {/* ── Flat column layout (no swimlanes) ─────────────── */}
      {(!swimlanes || swimlanes.length === 0) && (
        <div className={boardClass}>
          <div className={styles.columns}>
            {columns.map((col) => {
              const colCards = cards.filter((c) => c.status === col.id);
              return (
                <KanbanColumn
                  key={col.id}
                  column={col}
                  cards={colCards}
                  onCardClick={onCardClick}
                  onCardAdd={onCardAdd ? () => onCardAdd(col.id) : undefined}
                  headerExtra={renderColumnHeader ? renderColumnHeader(col) : undefined}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* ── Swimlane layout ───────────────────────────────── */}
      {swimlanes && swimlanes.length > 0 && (
        <div className={boardClass}>
          {/* Column headers row */}
          <div className={styles.swimlaneHeader}>
            <div className={styles.swimlaneLabelCell} />
            {columns.map((col) => (
              <div key={col.id} className={styles.swimlaneColHeader}>
                <span className={styles.swimlaneColTitle}>{col.title}</span>
                {col.wipLimit && (
                  <span className={styles.wipBadge}>
                    {cards.filter((c) => c.status === col.id).length}/{col.wipLimit}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Swimlane rows */}
          {swimlanes.map((lane) => (
            <KanbanSwimlane
              key={lane.id}
              swimlane={lane}
              columns={columns}
              allCards={cards}
              onCardClick={onCardClick}
              onCardAdd={onCardAdd}
            />
          ))}
        </div>
      )}

      {/* Drag overlay — smooth floating card while dragging */}
      <DragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
        {activeCard ? <KanbanCard card={activeCard} isDragging /> : null}
      </DragOverlay>
    </DndContext>
  );
}
