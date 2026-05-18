import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import styles from './KanbanCard.module.css';
import type { KanbanCardData } from './KanbanBoard';
import { Avatar } from '../ui';
import { priorityColorMap } from '../../styles/tokens';

export interface KanbanCardProps {
  card: KanbanCardData;
  isDragging?: boolean;
  onClick?: () => void;
  className?: string;
}

export function KanbanCard({
  card,
  isDragging = false,
  onClick,
  className = '',
}: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isBlocked = Boolean(card.blockedBy && card.blockedBy.length > 0);
  const checklistDone = card.checklistProgress?.done ?? 0;
  const checklistTotal = card.checklistProgress?.total ?? 0;
  const checklistPct =
    checklistTotal > 0 ? Math.round((checklistDone / checklistTotal) * 100) : 0;

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={[
        styles.card,
        isDragging || isSortableDragging ? styles['card--dragging'] : '',
        isBlocked ? styles['card--blocked'] : '',
        onClick ? styles['card--clickable'] : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...attributes}
      {...listeners}
      onClick={onClick}
      tabIndex={onClick ? 0 : undefined}
      role={onClick ? 'button' : undefined}
      aria-label={`Карточка: ${card.title}`}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      {/* Drag handle indicator */}
      <div className={styles.dragHandle} aria-hidden="true">
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          width="12"
          height="12"
        >
          <circle cx="9" cy="6" r="1.5" />
          <circle cx="15" cy="6" r="1.5" />
          <circle cx="9" cy="12" r="1.5" />
          <circle cx="15" cy="12" r="1.5" />
          <circle cx="9" cy="18" r="1.5" />
          <circle cx="15" cy="18" r="1.5" />
        </svg>
      </div>

      {/* Card top row: card number + priority */}
      <div className={styles.topRow}>
        {card.cardNumber && (
          <span className={styles.cardNumber}>{card.cardNumber}</span>
        )}
        {card.priority && (
          <span
            className={styles.priority}
            style={{ color: priorityColorMap[card.priority]?.color }}
            title={`Приоритет: ${priorityColorMap[card.priority]?.label}`}
            aria-label={`Приоритет: ${priorityColorMap[card.priority]?.label}`}
          >
            {card.priority === 'critical'
              ? '🔴'
              : card.priority === 'high'
              ? '🟠'
              : card.priority === 'medium'
              ? '🟡'
              : '🟢'}
          </span>
        )}
        {isBlocked && (
          <span className={styles.blockedBadge} title="Заблокирована другой карточкой">
            🔒
          </span>
        )}
      </div>

      {/* Title */}
      <h4 className={styles.title}>{card.title}</h4>

      {/* Description excerpt */}
      {card.description && (
        <p className={styles.description}>{card.description}</p>
      )}

      {/* Labels */}
      {card.labels && card.labels.length > 0 && (
        <div className={styles.labels}>
          {card.labels.slice(0, 3).map((label, i) => (
            <span
              key={i}
              className={styles.label}
              style={
                label.color
                  ? { backgroundColor: label.color + '30', color: label.color }
                  : undefined
              }
            >
              {label.text}
            </span>
          ))}
          {card.labels.length > 3 && (
            <span className={styles.labelMore}>+{card.labels.length - 3}</span>
          )}
        </div>
      )}

      {/* Checklist progress */}
      {checklistTotal > 0 && (
        <div className={styles.checklist}>
          <div className={styles.checklistBar}>
            <div
              className={styles.checklistFill}
              style={{ width: `${checklistPct}%` }}
              data-complete={checklistPct === 100}
            />
          </div>
          <span className={styles.checklistText}>
            {checklistDone}/{checklistTotal}
          </span>
        </div>
      )}

      {/* Card footer: assignee + meta */}
      <div className={styles.footer}>
        <div className={styles.footerLeft}>
          {card.assignee ? (
            <Avatar
              name={card.assignee.name}
              src={card.assignee.avatar}
              size="xs"
            />
          ) : (
            <span className={styles.unassigned} title="Не назначена">
              👤
            </span>
          )}
        </div>
        <div className={styles.footerRight}>
          {card.dueDate && (
            <span
              className={styles.dueDate}
              data-overdue={isOverdue(card.dueDate)}
              title={`Дедлайн: ${card.dueDate}`}
            >
              📅 {card.dueDate}
            </span>
          )}
          {card.commentCount != null && card.commentCount > 0 && (
            <span className={styles.meta} title="Комментарии">
              💬 {card.commentCount}
            </span>
          )}
          {card.attachmentCount != null && card.attachmentCount > 0 && (
            <span className={styles.meta} title="Вложения">
              📎 {card.attachmentCount}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

function isOverdue(dueDate: string): boolean {
  try {
    return new Date(dueDate) < new Date();
  } catch {
    return false;
  }
}
