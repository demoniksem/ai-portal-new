import React, { useState, useEffect, useCallback } from 'react';
import styles from './CardModal.module.css';
import { Modal } from '../ui';
import {
  getCard,
  updateCard,
  archiveCard,
  restoreCard,
  getCardComments,
  addCardComment,
  deleteCard,
  getCardChecklists,
  createChecklist,
} from '../../lib/api';
import type {
  BoardCardResponse,
  BoardColumnResponse,
  ChecklistResponse,
} from '../../lib/api';
import { priorityColorMap } from '../../styles/tokens';

// ── Types ───────────────────────────────────────────────────────────────────

export type CardTab = 'overview' | 'checklist' | 'custom-fields' | 'comments' | 'relations' | 'activity';

export interface CardModalProps {
  /** Pre-loaded card data — when passed, CardModal uses it directly without fetching */
  card?: BoardCardResponse;
  /** Card ID to fetch — use when card data is not pre-loaded */
  cardId?: string;
  boardId: string;
  columns: BoardColumnResponse[];
  open: boolean;
  onClose: () => void;
  onCardUpdated: (card: BoardCardResponse) => void;
  onCardDeleted?: (cardId: string) => void;
}

// ── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({
  card,
  onSave,
}: {
  card: BoardCardResponse;
  onSave: (updates: Partial<BoardCardResponse>) => void;
}) {
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description || '');
  const [priority, setPriority] = useState(card.priority);
  const [deadline, setDeadline] = useState(card.deadline?.split('T')[0] || '');
  const [startDate, setStartDate] = useState(card.start_date?.split('T')[0] || '');
  const [estimate, setEstimate] = useState(card.estimate?.toString() || '');

  useEffect(() => {
    setTitle(card.title);
    setDescription(card.description || '');
    setPriority(card.priority);
    setDeadline(card.deadline?.split('T')[0] || '');
    setStartDate(card.start_date?.split('T')[0] || '');
    setEstimate(card.estimate?.toString() || '');
  }, [card]);

  const handleSave = async () => {
    try {
      await onSave({
        title,
        description,
        priority,
        deadline: deadline || undefined,
        start_date: startDate || undefined,
        estimate: estimate ? Number(estimate) : undefined,
      });
    } catch { /* silent */ }
  };

  const typeLabels: Record<string, string> = {
    task: 'Задача',
    bug: 'Баг',
    story: 'История',
    epic: 'Эпик',
  };

  return (
    <div className={styles.overviewGrid}>
      <div className={styles.overviewMain}>
        {/* Title */}
        <div className={styles.sectionBlock}>
          <span className={styles.sectionLabel}>Название</span>
          <input
            className={styles.titleInput}
            style={{ fontSize: 'var(--text-lg)', padding: 'var(--space-2) var(--space-3)', width: '100%', boxSizing: 'border-box' }}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleSave}
          />
        </div>

        {/* Description */}
        <div className={styles.sectionBlock}>
          <span className={styles.sectionLabel}>Описание</span>
          <textarea
            className={styles.descriptionArea}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={handleSave}
            placeholder="Добавьте описание..."
            rows={4}
          />
        </div>

        {/* Dates */}
        <div className={styles.datesRow}>
          <div className={styles.sectionBlock}>
            <span className={styles.sectionLabel}>Дата начала</span>
            <input
              type="date"
              className={styles.dateInput}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              onBlur={handleSave}
            />
          </div>
          <div className={styles.sectionBlock}>
            <span className={styles.sectionLabel}>Дедлайн</span>
            <input
              type="date"
              className={styles.dateInput}
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              onBlur={handleSave}
            />
          </div>
          <div className={styles.sectionBlock}>
            <span className={styles.sectionLabel}>Оценка (ч)</span>
            <input
              type="number"
              className={styles.estimateInput}
              value={estimate}
              onChange={(e) => setEstimate(e.target.value)}
              onBlur={handleSave}
              min="0"
              placeholder="0"
            />
          </div>
        </div>
      </div>

      <div className={styles.overviewSide}>
        {/* Type */}
        <div className={styles.sectionBlock}>
          <span className={styles.sectionLabel}>Тип</span>
          <span
            className={styles.typeBadge}
            style={{ background: 'var(--color-surface-raised)', border: '1px solid var(--color-border)' }}
          >
            {typeLabels[card.type] || card.type}
          </span>
        </div>

        {/* Priority */}
        <div className={styles.sectionBlock}>
          <span className={styles.sectionLabel}>Приоритет</span>
          <select
            className={styles.prioritySelect}
            value={priority}
            onChange={async (e) => {
              const val = e.target.value as BoardCardResponse['priority'];
              setPriority(val);
              await onSave({ priority: val });
            }}
          >
            <option value="low">Низкий</option>
            <option value="medium">Средний</option>
            <option value="high">Высокий</option>
            <option value="urgent">Срочный</option>
          </select>
        </div>

        {/* Assignees */}
        <div className={styles.sectionBlock}>
          <span className={styles.sectionLabel}>Исполнители</span>
          <div className={styles.assigneesList}>
            {card.assignees && card.assignees.length > 0 ? (
              card.assignees.map((a) => (
                <span key={a.user_id} className={styles.assigneeChip}>
                  👤 {a.full_name || a.user_id}
                </span>
              ))
            ) : (
              <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
                Не назначена
              </span>
            )}
          </div>
        </div>

        {/* Labels */}
        {card.labels && card.labels.length > 0 && (
          <div className={styles.sectionBlock}>
            <span className={styles.sectionLabel}>Метки</span>
            <div className={styles.labelsList}>
              {card.labels.map((label) => (
                <span
                  key={label.id}
                  className={styles.labelChip}
                  style={{ backgroundColor: label.color }}
                >
                  {label.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Checklist Tab ────────────────────────────────────────────────────────────

function ChecklistTab({ cardId }: { cardId: string }) {
  const [checklists, setChecklists] = useState<ChecklistResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [newChecklistTitle, setNewChecklistTitle] = useState('');
  const [addingChecklist, setAddingChecklist] = useState(false);

  const loadChecklists = useCallback(async () => {
    try {
      const data = await getCardChecklists(cardId);
      setChecklists(data);
    } catch {
      setChecklists([]);
    } finally {
      setLoading(false);
    }
  }, [cardId]);

  useEffect(() => { loadChecklists(); }, [loadChecklists]);

  const handleAddChecklist = async () => {
    if (!newChecklistTitle.trim()) return;
    try {
      const cl = await createChecklist(cardId, newChecklistTitle.trim());
      setChecklists(prev => [...prev, cl]);
      setNewChecklistTitle('');
      setAddingChecklist(false);
    } catch { /* silent */ }
  };

  if (loading) return <div className={styles.loading}>Загрузка...</div>;

  const totalItems = checklists.reduce((acc, cl) => acc + (cl.items?.length || 0), 0);
  const doneItems = checklists.reduce((acc, cl) => acc + (cl.items?.filter((i: { checked: boolean }) => i.checked).length || 0), 0);

  return (
    <div className={styles.checklistTab}>
      {totalItems > 0 && (
        <div className={styles.checklistProgressBar}>
          <div
            className={styles.checklistProgressFill}
            style={{ width: `${(doneItems / totalItems) * 100}%` }}
          />
          <span className={styles.checklistProgressText}>{doneItems} / {totalItems}</span>
        </div>
      )}

      {checklists.map((cl) => (
        <div key={cl.id} className={styles.checklist}>
          <div className={styles.checklistHeader}>
            <span className={styles.checklistTitle}>{cl.title}</span>
            <button
              className={styles.checklistDeleteBtn}
              onClick={() => setChecklists(prev => prev.filter(c => c.id !== cl.id))}
              title="Удалить чек-лист"
            >
              ✕
            </button>
          </div>
          {cl.items?.map((item: { id: string; text: string; checked: boolean }) => (
            <div key={item.id} className={styles.checklistItem}>
              <input
                type="checkbox"
                className={styles.checklistCheckbox}
                checked={item.checked}
                onChange={() => {}}
              />
              <span className={`${styles.checklistItemText} ${item.checked ? styles.checked : ''}`}>
                {item.text}
              </span>
            </div>
          ))}
        </div>
      ))}

      {addingChecklist ? (
        <div className={styles.checklist}>
          <input
            className={styles.checklistTitle}
            placeholder="Название чек-листа..."
            value={newChecklistTitle}
            onChange={(e) => setNewChecklistTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddChecklist()}
            autoFocus
          />
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button
              onClick={handleAddChecklist}
              style={{
                padding: 'var(--space-1) var(--space-3)',
                background: 'var(--color-primary)',
                color: 'white',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                fontSize: 'var(--text-sm)',
              }}
            >
              Добавить
            </button>
            <button
              onClick={() => { setAddingChecklist(false); setNewChecklistTitle(''); }}
              style={{
                padding: 'var(--space-1) var(--space-3)',
                background: 'transparent',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                fontSize: 'var(--text-sm)',
              }}
            >
              Отмена
            </button>
          </div>
        </div>
      ) : (
        <button className={styles.addChecklistBtn} onClick={() => setAddingChecklist(true)}>
          + Добавить чек-лист
        </button>
      )}
    </div>
  );
}

// ── Custom Fields Tab ────────────────────────────────────────────────────────

function CustomFieldsTab({ cardId }: { cardId: string }) {
  const [fields, setFields] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`http://localhost:3100/api/cards/${cardId}/custom-fields`)
      .then((r) => r.json())
      .then((data: Record<string, unknown>) => setFields(data))
      .catch(() => setFields({}))
      .finally(() => setLoading(false));
  }, [cardId]);

  if (loading) return <div className={styles.loading}>Загрузка...</div>;

  const fieldEntries = Object.entries(fields);

  return (
    <div className={styles.customFieldsContainer}>
      {fieldEntries.length === 0 && (
        <div className={styles.emptyState}>
          <span className={styles.emptyStateIcon} style={{ fontSize: '1.5rem' }}>📝</span>
          <p className={styles.emptyStateText}>Нет дополнительных полей</p>
        </div>
      )}
      {fieldEntries.map(([key, value]) => (
        <div key={key} className={styles.customFieldRow}>
          <span className={styles.customFieldLabel}>{key}</span>
          <span className={styles.customFieldInput} style={{ border: 'none', padding: 0 }}>
            {typeof value === 'boolean' ? (value ? 'Да' : 'Нет') : String(value)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Comments Tab ─────────────────────────────────────────────────────────────

interface Comment {
  id: string;
  author_id: string;
  author_name?: string;
  content: string;
  created_at: string;
  reactions?: Array<{ emoji: string; count: number }>;
}

function CommentsTab({ cardId }: { cardId: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getCardComments(cardId)
      .then((data: unknown[]) => setComments(data as Comment[]))
      .catch(() => setComments([]))
      .finally(() => setLoading(false));
  }, [cardId]);

  const handleSubmit = async () => {
    if (!newComment.trim()) return;
    setSubmitting(true);
    try {
      const result = await addCardComment(cardId, newComment) as Comment;
      setComments(prev => [...prev, result]);
      setNewComment('');
    } catch { /* silent */ } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('ru-RU', {
        day: '2-digit', month: '2-digit', year: '2-digit',
        hour: '2-digit', minute: '2-digit',
      });
    } catch { return iso; }
  };

  if (loading) return <div className={styles.loading}>Загрузка...</div>;

  return (
    <div className={styles.commentsContainer}>
      <div className={styles.commentInput}>
        <textarea
          className={styles.commentTextarea}
          placeholder="Напишите комментарий..."
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit();
          }}
        />
        <button
          onClick={handleSubmit}
          disabled={submitting || !newComment.trim()}
          style={{
            padding: 'var(--space-2) var(--space-3)',
            background: newComment.trim() ? 'var(--color-primary)' : 'var(--color-surface-raised)',
            color: newComment.trim() ? 'white' : 'var(--color-text-muted)',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            cursor: newComment.trim() ? 'pointer' : 'not-allowed',
            fontSize: 'var(--text-sm)',
            alignSelf: 'flex-end',
          }}
        >
          {submitting ? '...' : 'Отправить'}
        </button>
      </div>

      {comments.length === 0 && (
        <div className={styles.emptyState}>
          <span className={styles.emptyStateIcon} style={{ fontSize: '1.5rem' }}>💬</span>
          <p className={styles.emptyStateText}>Пока нет комментариев</p>
        </div>
      )}

      <div className={styles.commentList}>
        {comments.map((comment) => (
          <div key={comment.id} className={styles.comment}>
            <span style={{ fontSize: '1.5rem', flexShrink: 0 }}>👤</span>
            <div className={styles.commentBubble}>
              <div className={styles.commentMeta}>
                <span className={styles.commentAuthor}>
                  {comment.author_name || comment.author_id}
                </span>
                <span className={styles.commentTime}>{formatTime(comment.created_at)}</span>
              </div>
              <div className={styles.commentContent}>{comment.content}</div>
              {comment.reactions && comment.reactions.length > 0 && (
                <div className={styles.commentReactions}>
                  {comment.reactions.map((r, i) => (
                    <span key={i} className={styles.reactionChip}>
                      {r.emoji} {r.count}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Relations Tab ────────────────────────────────────────────────────────────

interface Relation {
  id: string;
  target_card_id: string;
  target_card_title?: string;
  relation_type: 'blocks' | 'blocked_by' | 'duplicates' | 'relates_to' | 'parent' | 'child';
}

function RelationsTab({ cardId }: { cardId: string }) {
  const [relations, setRelations] = useState<Record<string, Relation[]>>({});
  const [loading, setLoading] = useState(true);

  const relationLabels: Record<string, string> = {
    blocks: 'Блокирует',
    blocked_by: 'Заблокирована',
    duplicates: 'Дубликат',
    relates_to: 'Связана',
    parent: 'Родитель',
    child: 'Потомок',
  };

  useEffect(() => {
    fetch(`http://localhost:3100/api/cards/${cardId}/relations`)
      .then((r) => r.json())
      .then((data: Relation[]) => {
        const grouped: Record<string, Relation[]> = {};
        data.forEach((rel) => {
          if (!grouped[rel.relation_type]) grouped[rel.relation_type] = [];
          grouped[rel.relation_type].push(rel);
        });
        setRelations(grouped);
      })
      .catch(() => setRelations({}))
      .finally(() => setLoading(false));
  }, [cardId]);

  if (loading) return <div className={styles.loading}>Загрузка...</div>;

  const groups = Object.entries(relations);

  return (
    <div className={styles.relationsContainer}>
      {groups.length === 0 && (
        <div className={styles.emptyState}>
          <span className={styles.emptyStateIcon} style={{ fontSize: '1.5rem' }}>🔗</span>
          <p className={styles.emptyStateText}>Нет связей</p>
        </div>
      )}
      {groups.map(([type, rels]) => (
        <div key={type} className={styles.relationGroup}>
          <span className={styles.relationGroupLabel}>{relationLabels[type] || type}</span>
          {rels.map((rel) => (
            <div key={rel.id} className={styles.relationItem}>
              <span className={styles.relationIcon}>
                {type === 'blocks' ? '🔽' : type === 'blocked_by' ? '🔼' : '🔗'}
              </span>
              <span className={styles.relationTitle}>
                {rel.target_card_title || rel.target_card_id}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── Activity Tab ─────────────────────────────────────────────────────────────

interface ActivityItem {
  id: string;
  action: string;
  field?: string;
  old_value?: string;
  new_value?: string;
  user_name?: string;
  created_at: string;
}

function ActivityTab({ cardId }: { cardId: string }) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`http://localhost:3100/api/cards/${cardId}/activity`)
      .then((r) => r.json())
      .then((data: ActivityItem[]) => setActivities(data))
      .catch(() => setActivities([]))
      .finally(() => setLoading(false));
  }, [cardId]);

  if (loading) return <div className={styles.loading}>Загрузка...</div>;

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('ru-RU', {
        day: '2-digit', month: '2-digit', year: '2-digit',
        hour: '2-digit', minute: '2-digit',
      });
    } catch { return iso; }
  };

  return (
    <div className={styles.activityContainer}>
      {activities.length === 0 && (
        <div className={styles.emptyState}>
          <span className={styles.emptyStateIcon} style={{ fontSize: '1.5rem' }}>📋</span>
          <p className={styles.emptyStateText}>Нет активностей</p>
        </div>
      )}
      <div className={styles.activityList}>
        {activities.map((item) => (
          <div key={item.id} className={styles.activityItem}>
            <span className={styles.activityDot} />
            <div className={styles.activityContent}>
              <span className={styles.activityText}>
                <strong>{item.user_name || 'Система'}</strong>{' '}
                {item.action}
                {item.field && (
                  <>
                    {' '}<em>{item.field}</em>
                    {item.old_value && ` с «${item.old_value}»`}
                    {item.new_value && ` на «${item.new_value}»`}
                  </>
                )}
              </span>
              <span className={styles.activityTime}>{formatTime(item.created_at)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main CardModal ───────────────────────────────────────────────────────────

const TABS: { key: CardTab; label: string; icon: string }[] = [
  { key: 'overview', label: 'Обзор', icon: '📋' },
  { key: 'checklist', label: 'Чек-лист', icon: '✅' },
  { key: 'custom-fields', label: 'Поля', icon: '📝' },
  { key: 'comments', label: 'Комментарии', icon: '💬' },
  { key: 'relations', label: 'Связи', icon: '🔗' },
  { key: 'activity', label: 'Активность', icon: '📋' },
];

export function CardModal({
  card: initialCard,
  cardId,
  boardId: _boardId,
  columns,
  open,
  onClose,
  onCardUpdated,
  onCardDeleted,
}: CardModalProps) {
  const [card, setCard] = useState<BoardCardResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<CardTab>('overview');
  const [archiving, setArchiving] = useState(false);

  // Resolve effective cardId from loaded card or prop
  const effectiveCardId = card?.id || cardId || '';

  useEffect(() => {
    if (!open) return;
    if (initialCard) {
      setCard(initialCard);
      return;
    }
    if (!cardId) return;
    setLoading(true);
    getCard(cardId)
      .then(setCard)
      .catch(() => setCard(null))
      .finally(() => setLoading(false));
  }, [open, cardId, initialCard]);

  const handleSave = async (updates: Partial<BoardCardResponse>) => {
    const id = card?.id || cardId;
    if (!id) return;
    try {
      const updated = await updateCard(id, updates);
      setCard(updated);
      onCardUpdated(updated);
    } catch { /* silent */ }
  };

  const handleArchive = async () => {
    const id = card?.id || cardId;
    if (!id) return;
    setArchiving(true);
    try {
      const archived = await archiveCard(id);
      onCardUpdated(archived);
      onClose();
    } catch { /* silent */ } finally {
      setArchiving(false);
    }
  };

  const handleRestore = async () => {
    const id = card?.id || cardId;
    if (!id) return;
    setArchiving(true);
    try {
      const restored = await restoreCard(id);
      onCardUpdated(restored);
    } catch { /* silent */ } finally {
      setArchiving(false);
    }
  };

  const handleDelete = async () => {
    const id = card?.id || cardId;
    if (!id) return;
    if (!confirm('Удалить эту карточку?')) return;
    try {
      await deleteCard(id);
      onCardDeleted?.(id);
      onClose();
    } catch { /* silent */ }
  };

  const columnName = columns.find((c) => c.id === card?.column_id)?.name || '';

  // Map urgent → critical for priorityColorMap (tokens use 'critical', API uses 'urgent')
  const priorityKey: 'critical' | 'high' | 'medium' | 'low' | undefined =
    card?.priority === 'urgent' ? 'critical' : card?.priority;
  const priorityCfg = priorityKey ? priorityColorMap[priorityKey] : null;

  return (
    <Modal open={open} onClose={onClose} size="xl" title={card?.title || 'Карточка'}>
      <div className={styles.cardModal}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={styles.headerMeta}>
            {columnName && (
              <span className={styles.columnBadge}>{columnName}</span>
            )}
            {priorityCfg && (
              <span
                style={{ color: priorityCfg.color, fontSize: 'var(--text-sm)' }}
                title={priorityCfg.label}
              >
                {priorityKey === 'critical' ? '🔴' :
                 priorityKey === 'high' ? '🟠' :
                 priorityKey === 'medium' ? '🟡' : '🟢'}
              </span>
            )}
            {card?.type && (
              <span
                style={{
                  background: 'var(--color-surface-raised)',
                  border: '1px solid var(--color-border)',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                {card.type}
              </span>
            )}
          </div>
          <div className={styles.headerActions}>
            {card?.archived_at ? (
              <button onClick={handleRestore} disabled={archiving} className={styles.headerActionBtn}>
                {archiving ? '...' : '↩ Восстановить'}
              </button>
            ) : (
              <button onClick={handleArchive} disabled={archiving} className={styles.headerActionBtn}>
                {archiving ? '...' : 'Архивировать'}
              </button>
            )}
            <button
              onClick={handleDelete}
              className={styles.headerActionBtn}
              style={{ color: 'var(--color-error)' }}
            >
              🗑 Удалить
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          {TABS.map((tab) => (
            <button
              key={tab.key}
              className={`${styles.tab} ${activeTab === tab.key ? styles.tabActive : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className={styles.content}>
          {loading ? (
            <div className={styles.loading}>Загрузка карточки...</div>
          ) : !card ? (
            <div className={styles.errorState}>Не удалось загрузить карточку</div>
          ) : (
            <>
              {activeTab === 'overview' && (
                <OverviewTab card={card} onSave={handleSave} />
              )}
              {activeTab === 'checklist' && effectiveCardId && (
                <ChecklistTab cardId={effectiveCardId} />
              )}
              {activeTab === 'custom-fields' && effectiveCardId && (
                <CustomFieldsTab cardId={effectiveCardId} />
              )}
              {activeTab === 'comments' && effectiveCardId && (
                <CommentsTab cardId={effectiveCardId} />
              )}
              {activeTab === 'relations' && effectiveCardId && (
                <RelationsTab cardId={effectiveCardId} />
              )}
              {activeTab === 'activity' && effectiveCardId && (
                <ActivityTab cardId={effectiveCardId} />
              )}
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
