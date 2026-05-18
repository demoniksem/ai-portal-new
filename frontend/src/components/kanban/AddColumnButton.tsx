import React, { useState, useRef, useEffect } from 'react';
import styles from './AddColumnButton.module.css';
import type { KanbanCardStatus } from './KanbanBoard';

export interface AddColumnButtonProps {
  onAdd: (column: { id: KanbanCardStatus; title: string; wipLimit?: number }) => void;
}

export function AddColumnButton({ onAdd }: AddColumnButtonProps) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [wipLimit, setWipLimit] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  const commit = () => {
    const trimmed = title.trim();
    if (trimmed) {
      onAdd({
        id: trimmed.toLowerCase().replace(/\s+/g, '_') as KanbanCardStatus,
        title: trimmed,
        wipLimit: wipLimit ? Number(wipLimit) : undefined,
      });
    }
    setTitle('');
    setWipLimit('');
    setAdding(false);
  };

  const cancel = () => {
    setTitle('');
    setWipLimit('');
    setAdding(false);
  };

  if (!adding) {
    return (
      <button className={styles.addColumnBtn} onClick={() => setAdding(true)}>
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
        Добавить колонку
      </button>
    );
  }

  return (
    <div className={styles.addColumnForm}>
      <input
        ref={inputRef}
        className={styles.titleInput}
        placeholder="Название колонки"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') cancel();
        }}
        maxLength={40}
      />
      <input
        className={styles.wipInput}
        placeholder="WIP лимит"
        type="number"
        min="1"
        max="999"
        value={wipLimit}
        onChange={(e) => setWipLimit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') cancel();
        }}
      />
      <div className={styles.formActions}>
        <button className={styles.confirmBtn} onClick={commit}>
          Добавить
        </button>
        <button className={styles.cancelBtn} onClick={cancel}>
          ✕
        </button>
      </div>
    </div>
  );
}
