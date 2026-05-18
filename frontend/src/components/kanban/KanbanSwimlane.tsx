import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import styles from './KanbanSwimlane.module.css';
import { KanbanColumn } from './KanbanColumn';
import type { KanbanCardData, KanbanColumnDef, KanbanSwimlaneDef, KanbanCardStatus } from './KanbanBoard';

export interface KanbanSwimlaneProps {
  swimlane: KanbanSwimlaneDef;
  columns: KanbanColumnDef[];
  allCards: KanbanCardData[];
  onCardClick?: (card: KanbanCardData) => void;
  onCardAdd?: (status: KanbanCardStatus, swimlaneId?: string) => void;
  className?: string;
}

export function KanbanSwimlane({
  swimlane,
  columns,
  allCards,
  onCardClick,
  onCardAdd,
  className = '',
}: KanbanSwimlaneProps) {
  const laneCardCount = allCards.filter(
    (c) => c.assignee?.name === swimlane.title
  ).length;

  return (
    <div className={[styles.swimlane, className].filter(Boolean).join(' ')}>
      {/* Swimlane label */}
      <div className={styles.laneLabel}>
        <span className={styles.laneTitle}>{swimlane.title}</span>
        <span className={styles.laneCount}>{laneCardCount}</span>
      </div>

      {/* Column cells */}
      <div className={styles.laneColumns}>
        {columns.map((col) => {
          const laneCards = allCards.filter(
            (c) => c.assignee?.name === swimlane.title
          );
          const colCards = laneCards.filter((c) => c.status === col.id);

          return (
            <SwimlaneCell
              key={col.id}
              swimlaneId={swimlane.id}
              columnId={col.id}
              cards={colCards}
              onCardClick={onCardClick}
              onCardAdd={onCardAdd}
            />
          );
        })}
      </div>
    </div>
  );
}

// ── Individual swimlane cell (droppable zone) ──────────────────

interface SwimlaneCellProps {
  swimlaneId: string;
  columnId: KanbanCardStatus;
  cards: KanbanCardData[];
  onCardClick?: (card: KanbanCardData) => void;
  onCardAdd?: (status: KanbanCardStatus, swimlaneId?: string) => void;
}

function SwimlaneCell({
  swimlaneId,
  columnId,
  cards,
  onCardClick,
  onCardAdd,
}: SwimlaneCellProps) {
  const cellId = `${swimlaneId}::${columnId}`;
  const { setNodeRef, isOver } = useDroppable({ id: cellId });

  return (
    <div
      ref={setNodeRef}
      className={[
        styles.laneCell,
        isOver ? styles['laneCell--drag-over'] : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {cards.slice(0, 3).map((card) => (
        <div key={card.id} className={styles.miniCard}>
          <span className={styles.miniCardTitle}>{card.title}</span>
          {card.assignee && (
            <span className={styles.miniCardAssignee}>{card.assignee.name}</span>
          )}
        </div>
      ))}
      {cards.length > 3 && (
        <span className={styles.moreCards}>+{cards.length - 3} ещё</span>
      )}
      {cards.length === 0 && <div className={styles.cellEmpty} />}

      {onCardAdd && (
        <button
          className={styles.cellAddBtn}
          onClick={() => onCardAdd(columnId, swimlaneId)}
          aria-label="Добавить карточку"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            width="12"
            height="12"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      )}
    </div>
  );
}
