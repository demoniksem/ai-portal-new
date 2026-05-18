import React, { useState, useEffect } from 'react';
import styles from './TemplatesDialog.module.css';
import { Modal, Button, Badge } from '../ui';
import {
  getBoardTemplates,
  createBoardTemplate,
  deleteTemplate,
} from '../../lib/api';
import type { CardTemplateResponse } from '../../lib/api';

export interface TemplatesDialogProps {
  boardId: string;
  open: boolean;
  onClose: () => void;
  /** Called when the user picks a template — returns the template data to pre-fill CardModal */
  onApplyTemplate: (template: CardTemplateResponse) => void;
  /** Optional card to create a template from (pre-fills the create form) */
  sourceCard?: {
    title: string;
    description?: string;
    type?: string;
  };
}

export function TemplatesDialog({
  boardId,
  open,
  onClose,
  onApplyTemplate,
  sourceCard,
}: TemplatesDialogProps) {
  const [templates, setTemplates] = useState<CardTemplateResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);

  // Create-form state
  const [createName, setCreateName] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createType, setCreateType] = useState<string>('task');

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setShowCreate(false);
    setCreateName(sourceCard?.title ? `${sourceCard.title} (шаблон)` : '');
    setCreateDescription(sourceCard?.description || '');
    setCreateType(sourceCard?.type || 'task');

    setLoading(true);
    getBoardTemplates(boardId)
      .then(setTemplates)
      .catch(() => setError('Не удалось загрузить шаблоны'))
      .finally(() => setLoading(false));
  }, [open, boardId, sourceCard]);

  const handleCreate = async () => {
    if (!createName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const created = await createBoardTemplate(boardId, {
        name: createName.trim(),
        description: createDescription.trim() || undefined,
        type: createType,
        titleTemplate: sourceCard?.title,
        descriptionTemplate: sourceCard?.description,
      });
      setTemplates((prev) => [...prev, created]);
      setShowCreate(false);
      setCreateName('');
      setCreateDescription('');
    } catch {
      setError('Не удалось создать шаблон');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (templateId: string) => {
    setDeletingId(templateId);
    try {
      await deleteTemplate(templateId);
      setTemplates((prev) => prev.filter((t) => t.id !== templateId));
    } catch {
      setError('Не удалось удалить шаблон');
    } finally {
      setDeletingId(null);
    }
  };

  const handleApply = (template: CardTemplateResponse) => {
    onApplyTemplate(template);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Шаблоны карточек"
      size="md"
    >
      <div className={styles.content}>
        {error && (
          <div className={styles.error}>
            <span>{error}</span>
            <button className={styles.errorClose} onClick={() => setError(null)} aria-label="Закрыть">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12">
                <path d="M12 4L4 12M4 4l8 8" />
              </svg>
            </button>
          </div>
        )}

        {loading && (
          <div className={styles.loading}>
            <span className={styles.spinner} aria-hidden="true" />
            <span>Загрузка шаблонов...</span>
          </div>
        )}

        {!loading && !showCreate && (
          <>
            <div className={styles.actions}>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowCreate(true)}
                icon={
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                    <path d="M8 2v12M2 8h12" />
                  </svg>
                }
              >
                Создать шаблон
              </Button>
            </div>

            {templates.length === 0 ? (
              <div className={styles.empty}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="40" height="40" className={styles.emptyIcon}>
                  <rect x="3" y="3" width="18" height="18" rx="3" />
                  <path d="M8 12h8M12 8v8" />
                </svg>
                <p>Нет сохранённых шаблонов</p>
                <span>Создайте шаблон из текущей карточки или с нуля</span>
              </div>
            ) : (
              <ul className={styles.list}>
                {templates.map((tmpl) => (
                  <li key={tmpl.id} className={styles.item}>
                    <div className={styles.itemMain}>
                      <div className={styles.itemHeader}>
                        <span className={styles.itemName}>{tmpl.name}</span>
                        {tmpl.type && (
                          <Badge variant="secondary" size="sm">
                            {typeLabel(tmpl.type)}
                          </Badge>
                        )}
                      </div>
                      {tmpl.description && (
                        <p className={styles.itemDesc}>{tmpl.description}</p>
                      )}
                      {tmpl.title_template && (
                        <p className={styles.itemPreview}>
                          <span className={styles.itemPreviewLabel}>Карточка:</span>
                          {tmpl.title_template}
                        </p>
                      )}
                    </div>
                    <div className={styles.itemActions}>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleApply(tmpl)}
                      >
                        Использовать
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        loading={deletingId === tmpl.id}
                        onClick={() => handleDelete(tmpl.id)}
                        aria-label="Удалить шаблон"
                        icon={
                          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="14" height="14">
                            <path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 9h8l1-9" />
                          </svg>
                        }
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {!loading && showCreate && (
          <div className={styles.createForm}>
            <h3 className={styles.createTitle}>Новый шаблон</h3>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>Название шаблона *</span>
              <input
                className={styles.input}
                type="text"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="Например: Шаблон бага"
                maxLength={200}
                autoFocus
              />
            </label>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>Описание</span>
              <textarea
                className={styles.textarea}
                value={createDescription}
                onChange={(e) => setCreateDescription(e.target.value)}
                placeholder="Опишите, для чего используется этот шаблон"
                rows={3}
                maxLength={1000}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.fieldLabel}>Тип карточки</span>
              <select
                className={styles.select}
                value={createType}
                onChange={(e) => setCreateType(e.target.value)}
              >
                <option value="task">Задача</option>
                <option value="bug">Баг</option>
                <option value="story">История</option>
                <option value="epic">Эпик</option>
              </select>
            </label>

            {sourceCard && (
              <div className={styles.sourcePreview}>
                <span className={styles.sourcePreviewLabel}>На основе карточки:</span>
                <strong>{sourceCard.title}</strong>
              </div>
            )}

            <div className={styles.formActions}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCreate(false)}
                disabled={creating}
              >
                Отмена
              </Button>
              <Button
                variant="primary"
                size="sm"
                loading={creating}
                disabled={!createName.trim()}
                onClick={handleCreate}
              >
                Сохранить шаблон
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function typeLabel(type: string): string {
  const map: Record<string, string> = {
    task: 'Задача',
    bug: 'Баг',
    story: 'История',
    epic: 'Эпик',
  };
  return map[type] ?? type;
}
