import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Warning, Cards } from '@phosphor-icons/react';
import styles from './KanbanColumn.module.css';
import { KanbanCard } from './KanbanCard';
import type { KanbanCardData, KanbanColumnDef, KanbanCardStatus } from './KanbanBoard';

export interface KanbanColumnProps {
  column: KanbanColumnDef;
  cards: KanbanCardData[];
  onCardClick?: (card: KanbanCardData) => void;
  onCardAdd?: (status: KanbanCardStatus) => void;
  className?: string;
  /** Arbitrary React node injected into the column header right area. Use for
   *  column-level actions like rename/delete menus. */
  headerExtra?: React.ReactNode;
}

export function KanbanColumn({
  column,
  cards,
  onCardClick,
  onCardAdd,
  className = '',
  headerExtra,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  const wipExceeded = column.wipLimit != null && cards.length > column.wipLimit;
  const wipWarning =
    column.wipLimit != null &&
    cards.length >= Math.floor(column.wipLimit * 0.8);

  return (
    <div
      ref={setNodeRef}
      className={[
        styles.column,
        'kanban-column-snap',
        isOver ? styles['column--drag-over'] : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* Column Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span
            className={styles.statusDot}
            style={{ background: `var(--color-column-${column.id})` }}
            aria-hidden="true"
          />
          <h3 className={styles.title}>{column.title}</h3>
          <span
            className={[
              styles.count,
              wipExceeded ? styles['count--exceeded'] : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {cards.length}
          </span>
          {wipExceeded && (
            <span className={styles.wipWarning} title="WIP limit exceeded" style={{ display: 'inline-flex' }}>
              <Warning size={14} weight="fill" />
            </span>
          )}
        </div>
        <div className={styles.headerRight}>
          {column.wipLimit && (
            <span
              className={[
                styles.wipBadge,
                wipWarning ? styles['wipBadge--warning'] : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {cards.length}/{column.wipLimit}
            </span>
          )}
          {onCardAdd && (
            <button
              className={styles.addBtn}
              onClick={() => onCardAdd(column.id)}
              aria-label={`Добавить карточку в ${column.title}`}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                width="16"
                height="16"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
          )}
          {headerExtra}
        </div>
      </div>

      {/* Cards */}
      <div className={styles.cardList}>
        {cards.map((card) => (
          <KanbanCard
            key={card.id}
            card={card}
            onClick={onCardClick ? () => onCardClick(card) : undefined}
          />
        ))}

        {/* Empty column placeholder */}
        {cards.length === 0 && (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon} aria-hidden="true" style={{ display: 'inline-flex' }}>
              <Cards size={26} weight="duotone" />
            </span>
            <p>Перетащите карточку сюда</p>
          </div>
        )}
      </div>

      {/* Add card CTA */}
      {onCardAdd && cards.length > 0 && (
        <button className={styles.addCardBtn} onClick={() => onCardAdd(column.id)}>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            width="14"
            height="14"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          Добавить карточку
        </button>
      )}
    </div>
  );
}
