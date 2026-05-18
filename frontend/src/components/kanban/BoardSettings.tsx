import React, { useState } from 'react';
import { Modal, Button, Input } from '../ui';
import styles from './BoardSettings.module.css';

export interface BoardSettingsData {
  name: string;
  description?: string;
  defaultWipLimit?: number;
}

export interface BoardSettingsProps {
  open: boolean;
  onClose: () => void;
  board: BoardSettingsData;
  onSave: (updates: Partial<BoardSettingsData>) => void;
}

export function BoardSettings({ open, onClose, board, onSave }: BoardSettingsProps) {
  const [name, setName] = useState(board.name);
  const [description, setDescription] = useState(board.description ?? '');
  const [defaultWipLimit, setDefaultWipLimit] = useState(
    board.defaultWipLimit != null ? String(board.defaultWipLimit) : ''
  );

  const handleSave = () => {
    onSave({
      name: name.trim() || board.name,
      description: description.trim() || undefined,
      defaultWipLimit: defaultWipLimit ? Number(defaultWipLimit) : undefined,
    });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} size="md">
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 className={styles.title}>Настройки доски</h2>
        </div>

        <div className={styles.body}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="board-name">
              Название
            </label>
            <Input
              id="board-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Название доски"
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="board-desc">
              Описание
            </label>
            <textarea
              id="board-desc"
              className={styles.textarea}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Описание доски (необязательно)"
              rows={3}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="board-wip">
              Лимит WIP по умолчанию
            </label>
            <Input
              id="board-wip"
              type="number"
              min="1"
              max="999"
              value={defaultWipLimit}
              onChange={(e) => setDefaultWipLimit(e.target.value)}
              placeholder="Не ограничено"
            />
            <p className={styles.hint}>
              Новые колонки будут создаваться с этим лимитом WIP, если не указано иное.
            </p>
          </div>
        </div>

        <div className={styles.footer}>
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button variant="primary" onClick={handleSave}>
            Сохранить
          </Button>
        </div>
      </div>
    </Modal>
  );
}
