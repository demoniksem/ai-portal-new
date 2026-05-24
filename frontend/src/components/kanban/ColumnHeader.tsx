import React, { useState, useRef, useEffect } from 'react';
import { Warning } from '@phosphor-icons/react';
import styles from './ColumnHeader.module.css';
import type { KanbanColumnDef, KanbanCardStatus } from './KanbanBoard';

const COLUMN_COLORS = [
  '#0ea5e9', // sky
  '#3b82f6', // blue
  '#06b6d4', // cyan
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#ec4899', // pink
  '#14b8a6', // teal
  '#64748b', // slate
  '#84cc16', // lime
];

export interface ColumnHeaderProps {
  column: KanbanColumnDef;
  cardCount: number;
  onUpdate?: (id: KanbanCardStatus, updates: Partial<Pick<KanbanColumnDef, 'title' | 'wipLimit'>>) => void;
  onCardAdd?: () => void;
}

export function ColumnHeader({ column, cardCount, onUpdate, onCardAdd }: ColumnHeaderProps) {
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(column.title);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commitEdit = () => {
    const trimmed = draftTitle.trim();
    if (trimmed && trimmed !== column.title) {
      onUpdate?.(column.id, { title: trimmed });
    } else {
      setDraftTitle(column.title);
    }
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') commitEdit();
    if (e.key === 'Escape') {
      setDraftTitle(column.title);
      setEditing(false);
    }
  };

  const wipExceeded = column.wipLimit != null && cardCount > column.wipLimit;
  const wipWarning =
    column.wipLimit != null &&
    cardCount >= Math.floor(column.wipLimit * 0.8);

  return (
    <div className={styles.header}>
      <div className={styles.headerLeft}>
        {/* Color dot + editable name */}
        <button
          className={styles.colorDot}
          style={{ background: `var(--color-column-${column.id}, #6366f1)` }}
          onClick={() => setShowColorPicker((v) => !v)}
          title="Выбрать цвет колонки"
          aria-label={`Цвет колонки ${column.title}`}
        />

        {editing ? (
          <input
            ref={inputRef}
            className={styles.titleInput}
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={handleKeyDown}
            maxLength={40}
          />
        ) : (
          <button
            className={styles.titleBtn}
            onClick={() => {
              setDraftTitle(column.title);
              setEditing(true);
            }}
            title="Нажмите для переименования"
          >
            <h3 className={styles.title}>{column.title}</h3>
          </button>
        )}

        <span
          className={[
            styles.count,
            wipExceeded ? styles['count--exceeded'] : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {cardCount}
        </span>

        {wipExceeded && (
          <span className={styles.wipWarning} title="WIP limit exceeded" style={{ display: 'inline-flex' }}>
            <Warning size={14} weight="fill" />
          </span>
        )}
      </div>

      <div className={styles.headerRight}>
        {column.wipLimit != null && (
          <span
            className={[
              styles.wipBadge,
              wipWarning ? styles['wipBadge--warning'] : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {cardCount}/{column.wipLimit}
          </span>
        )}
        {onCardAdd && (
          <button
            className={styles.addBtn}
            onClick={onCardAdd}
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
      </div>

      {/* Color picker dropdown */}
      {showColorPicker && (
        <>
          <div
            className={styles.colorOverlay}
            onClick={() => setShowColorPicker(false)}
          />
          <div className={styles.colorPicker}>
            {COLUMN_COLORS.map((color) => (
              <button
                key={color}
                className={styles.colorSwatch}
                style={{ background: color }}
                onClick={() => {
                  // Color is stored via CSS variable — emit event with color
                  onUpdate?.(column.id, { title: column.title });
                  setShowColorPicker(false);
                }}
                title={color}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
