import React, { useState, useRef } from 'react';
import type { NextPage } from 'next';
import {
  Button,
  Input,
  Select,
  Modal,
  Badge,
  StatusBadge,
  PriorityBadge,
  Avatar,
  Tooltip,
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  Header,
} from '../components/ui';
import { KanbanBoard, CardModal, type KanbanCardData, type KanbanColumnDef } from '../components/kanban';
import type { BoardCardResponse, BoardColumnResponse } from '../lib/api';
import { tokens } from '../styles/tokens';
import styles from '../styles/Demo.module.css';

// ── Helpers for demo ────────────────────────────────────────────────

/** Convert KanbanCardData (local demo type) to BoardCardResponse (API shape) */
function demoCardToResponse(card: KanbanCardData): BoardCardResponse {
  const columnMap: Record<string, string> = {
    backlog: 'col-backlog',
    todo: 'col-todo',
    in_progress: 'col-in-progress',
    review: 'col-review',
    done: 'col-done',
    blocked: 'col-blocked',
  };
  return {
    id: card.id,
    board_id: 'demo-board',
    column_id: columnMap[card.status] ?? 'col-backlog',
    title: card.title,
    type: 'task',
    description: card.description,
    priority: (card.priority as BoardCardResponse['priority']) ?? 'medium',
    position: 0,
    assignees: card.assignee
      ? [{ user_id: card.assignee.name, full_name: card.assignee.name }]
      : [],
    labels: card.labels?.map((l, i) => ({ id: String(i), name: l.text, color: l.color ?? '#888' })),
    deadline: card.dueDate,
    archived_at: undefined,
  };
}

/** Demo columns in BoardColumnResponse format */
const DEMO_COLUMNS_RESPONSE: BoardColumnResponse[] = [
  { id: 'col-backlog', board_id: 'demo-board', name: 'Бэклог', position: 0, wip_limit: 10, created_at: new Date().toISOString() },
  { id: 'col-todo', board_id: 'demo-board', name: 'К выполнению', position: 1, created_at: new Date().toISOString() },
  { id: 'col-in-progress', board_id: 'demo-board', name: 'В работе', position: 2, wip_limit: 5, created_at: new Date().toISOString() },
  { id: 'col-review', board_id: 'demo-board', name: 'На проверке', position: 3, created_at: new Date().toISOString() },
  { id: 'col-done', board_id: 'demo-board', name: 'Готово', position: 4, created_at: new Date().toISOString() },
];

// ── Sample data ───────────────────────────────────────────────

const DEMO_COLUMNS: KanbanColumnDef[] = [
  { id: 'backlog', title: 'Бэклог', wipLimit: 10 },
  { id: 'todo', title: 'К выполнению' },
  { id: 'in_progress', title: 'В работе', wipLimit: 5 },
  { id: 'review', title: 'На проверке' },
  { id: 'done', title: 'Готово' },
];

const DEMO_CARDS: KanbanCardData[] = [
  {
    id: '1',
    title: 'Настроить CI/CD pipeline',
    description: 'GitHub Actions для автоматической сборки и деплоя',
    status: 'in_progress',
    priority: 'high',
    assignee: { name: 'Алексей Морозов' },
    labels: [{ text: 'DevOps', color: '#3b82f6' }, { text: 'Срочно' }],
    dueDate: '2026-05-20',
    commentCount: 3,
    cardNumber: 'ACD-101',
    checklistProgress: { done: 3, total: 5 },
  },
  {
    id: '2',
    title: 'Дизайн-система: компоненты',
    description: 'Button, Input, Modal, Badge, Avatar, Tooltip, Card',
    status: 'done',
    priority: 'critical',
    assignee: { name: 'Елена Волкова' },
    labels: [{ text: 'UI', color: '#8b5cf6' }],
    cardNumber: 'ACD-64',
  },
  {
    id: '3',
    title: 'Интеграция с Meilisearch',
    description: 'Полнотекстовый поиск по страницам и карточкам',
    status: 'todo',
    priority: 'medium',
    assignee: { name: 'Дмитрий Соколов' },
    labels: [{ text: 'Backend', color: '#22c55e' }],
    dueDate: '2026-05-25',
    cardNumber: 'ACD-108',
  },
  {
    id: '4',
    title: 'Исправить баг с авторизацией',
    status: 'review',
    priority: 'high',
    assignee: { name: 'Алексей Морозов' },
    labels: [{ text: 'Bug', color: '#ef4444' }],
    commentCount: 7,
    cardNumber: 'ACD-112',
  },
  {
    id: '5',
    title: 'Добавить микро-интеракции',
    status: 'backlog',
    priority: 'low',
    assignee: { name: 'Елена Волкова' },
    labels: [{ text: 'UX', color: '#f59e0b' }],
    cardNumber: 'ACD-28',
  },
  {
    id: '6',
    title: 'Реализовать RBAC',
    description: 'Многоуровневая ролевая модель доступа',
    status: 'in_progress',
    priority: 'critical',
    assignee: { name: 'Дмитрий Соколов' },
    labels: [{ text: 'Security', color: '#ef4444' }, { text: 'Backend', color: '#22c55e' }],
    blockedBy: ['4'],
    dueDate: '2026-05-22',
    cardNumber: 'ACD-95',
  },
];

// ── Select options ───────────────────────────────────────────

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Администратор' },
  { value: 'editor', label: 'Редактор' },
  { value: 'viewer', label: 'Наблюдатель' },
  { value: 'guest', label: 'Гость', disabled: true },
];

// ── Page ─────────────────────────────────────────────────────

const DesignSystemDemo: NextPage = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectValue, setSelectValue] = useState('');
  const [inputVal, setInputVal] = useState('');
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  // demoCards: mutable demo card store so CardModal edits persist in the session
  const [demoCards, setDemoCards] = useState<KanbanCardData[]>(DEMO_CARDS);
  // cardMoveToast: briefly shows which card was moved during drag
  const [cardMoveToast, setCardMoveToast] = useState<string | null>(null);

  const handleCardMove = (cardId: string, newStatus: typeof DEMO_COLUMNS[number]['id']) => {
    setCardMoveToast(`${cardId} → ${newStatus}`);
    setTimeout(() => setCardMoveToast(null), 2000);
    // In demo: update local card status
    setDemoCards((prev) =>
      prev.map((c) => (c.id === cardId ? { ...c, status: newStatus as KanbanCardData['status'] } : c))
    );
  };

  const handleCardUpdated = (updated: BoardCardResponse) => {
    // Map API shape back to KanbanCardData and update demo state
    const reverseColumnMap: Record<string, KanbanCardData['status']> = {
      'col-backlog': 'backlog',
      'col-todo': 'todo',
      'col-in-progress': 'in_progress',
      'col-review': 'review',
      'col-done': 'done',
      'col-blocked': 'blocked',
    };
    const priorityMap: Record<string, KanbanCardData['priority']> = {
      critical: 'critical',
      high: 'high',
      medium: 'medium',
      low: 'low',
    };
    setDemoCards((prev) =>
      prev.map((c) =>
        c.id === updated.id
          ? {
              ...c,
              title: updated.title,
              description: updated.description,
              status: reverseColumnMap[updated.column_id] ?? c.status,
              priority: priorityMap[updated.priority ?? ''] ?? c.priority,
            }
          : c
      )
    );
  };

  return (
    <div className={styles.page}>
      {/* ── Page header ─────────────────────────────── */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Дизайн-система AI Portal</h1>
          <p className={styles.pageSubtitle}>
            Визуальный язык, токены, компоненты и Kanban-доска
          </p>
        </div>
        <div className={styles.colorSwatches}>
          {(['primary', 'secondary', 'accent'] as const).map((c) => (
            <span
              key={c}
              className={styles.swatch}
              style={{ background: tokens.color[c].DEFAULT }}
              title={c}
            />
          ))}
        </div>
      </div>

      <div className={styles.grid}>
        {/* ── SECTION 1: Design Tokens ─────────────── */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>1. Дизайн-токены</h2>
          <div className={styles.tokenGrid}>
            {/* Colors */}
            <div className={styles.tokenGroup}>
              <h3 className={styles.groupTitle}>Цвета</h3>
              <div className={styles.colorGrid}>
                {(['primary', 'secondary', 'accent', 'success', 'warning', 'error', 'info'] as const).map((c) => (
                  <div key={c} className={styles.colorCard}>
                    <div
                      className={styles.colorPreview}
                      style={{ background: tokens.color[c].DEFAULT }}
                    />
                    <span className={styles.colorName}>{c}</span>
                    <code className={styles.tokenRef}>var(--color-{c})</code>
                  </div>
                ))}
              </div>
            </div>

            {/* Spacing */}
            <div className={styles.tokenGroup}>
              <h3 className={styles.groupTitle}>Отступы</h3>
              <div className={styles.spacingRow}>
                {[1, 2, 3, 4, 5, 6, 8, 10, 12, 16].map((n) => (
                  <div key={n} className={styles.spacingItem} title={`--space-${n}`}>
                    <div
                      className={styles.spacingBar}
                      style={{ width: `${n * 4}px`, height: `${n * 4}px` }}
                    />
                    <span className={styles.spacingLabel}>{n}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Typography */}
            <div className={styles.tokenGroup}>
              <h3 className={styles.groupTitle}>Типографика</h3>
              {([
                { size: '4xl', text: 'Заголовок 4xl', weight: 'bold' },
                { size: '3xl', text: 'Заголовок 3xl', weight: 'bold' },
                { size: '2xl', text: 'Заголовок 2xl', weight: 'semibold' },
                { size: 'xl', text: 'Заголовок xl', weight: 'semibold' },
                { size: 'lg', text: 'Подзаголовок lg', weight: 'medium' },
                { size: 'base', text: 'Основной текст base', weight: 'regular' },
                { size: 'sm', text: 'Вторичный текст sm', weight: 'regular' },
                { size: 'xs', text: 'Метка текста xs', weight: 'medium' },
              ] as const).map(({ size, text, weight }) => (
                <div key={size} className={styles.typeRow}>
                  <code className={styles.typeSize}>text-{size}</code>
                  <span
                    style={{
                      fontSize: `var(--text-${size})`,
                      fontWeight: `var(--weight-${weight})`,
                      color: 'var(--color-text)',
                    }}
                  >
                    {text}
                  </span>
                </div>
              ))}
            </div>

            {/* Shadows */}
            <div className={styles.tokenGroup}>
              <h3 className={styles.groupTitle}>Тени</h3>
              <div className={styles.shadowGrid}>
                {['xs', 'sm', 'md', 'lg', 'xl'].map((s) => (
                  <div
                    key={s}
                    className={styles.shadowCard}
                    style={{ boxShadow: `var(--shadow-${s})` }}
                  >
                    <code>shadow-{s}</code>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── SECTION 2: Buttons ───────────────────── */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>2. Кнопки</h2>
          <div className={styles.demoRow}>
            {(['primary', 'secondary', 'outline', 'ghost', 'danger', 'success'] as const).map((v) => (
              <Button key={v} variant={v}>{v}</Button>
            ))}
          </div>
          <div className={styles.demoRow}>
            {(['sm', 'md', 'lg'] as const).map((s) => (
              <Button key={s} size={s} variant="primary">{s}</Button>
            ))}
            <Button variant="primary" loading>Загрузка</Button>
            <Button variant="primary" icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <path d="M12 5v14M5 12h14" />
              </svg>
            }>
              С иконкой
            </Button>
          </div>
        </section>

        {/* ── SECTION 3: Form Controls ──────────────── */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>3. Формы</h2>
          <div className={styles.formGrid}>
            <Input
              label="Email"
              placeholder="you@company.com"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              hint="Используйте корпоративную почту"
            />
            <Input
              label="Пароль"
              type="password"
              placeholder="********"
              error="Пароль слишком короткий"
            />
            <Select
              label="Роль доступа"
              options={ROLE_OPTIONS}
              value={selectValue}
              onChange={setSelectValue}
              placeholder="Выберите роль..."
            />
          </div>
        </section>

        {/* ── SECTION 4: Badges ─────────────────────── */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>4. Бейджи и статусы</h2>
          <div className={styles.demoRow}>
            <Badge variant="default">default</Badge>
            <Badge variant="primary">primary</Badge>
            <Badge variant="secondary">secondary</Badge>
            <Badge variant="success">success</Badge>
            <Badge variant="warning">warning</Badge>
            <Badge variant="error">error</Badge>
            <Badge variant="info">info</Badge>
            <Badge variant="default" dot>с точкой</Badge>
            <Badge variant="default" removable onRemove={() => {}}>удаляемый</Badge>
          </div>
          <div className={styles.demoRow}>
            <StatusBadge status="backlog" />
            <StatusBadge status="todo" />
            <StatusBadge status="in_progress" />
            <StatusBadge status="review" />
            <StatusBadge status="done" />
            <StatusBadge status="blocked" />
          </div>
          <div className={styles.demoRow}>
            <PriorityBadge priority="critical" />
            <PriorityBadge priority="high" />
            <PriorityBadge priority="medium" />
            <PriorityBadge priority="low" />
          </div>
        </section>

        {/* ── SECTION 5: Avatar ─────────────────────── */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>5. Аватары</h2>
          <div className={styles.demoRow}>
            {(['xs', 'sm', 'md', 'lg', 'xl'] as const).map((s) => (
              <Avatar key={s} name="Елена Волкова" size={s} />
            ))}
          </div>
          <div className={styles.demoRow}>
            {['Алексей', 'Дмитрий', 'Мария', 'Ольга', 'Сергей'].map((n) => (
              <Avatar key={n} name={n} />
            ))}
          </div>
        </section>

        {/* ── SECTION 6: Tooltip ────────────────────── */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>6. Подсказки</h2>
          <div className={styles.demoRow}>
            {(['top', 'bottom', 'left', 'right'] as const).map((p) => (
              <Tooltip key={p} content={`Подсказка ${p}`} position={p}>
                <Button variant="outline" size="sm">{p}</Button>
              </Tooltip>
            ))}
          </div>
        </section>

        {/* ── SECTION 7: Modal ──────────────────────── */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>7. Модальное окно</h2>
          <Button variant="primary" onClick={() => setModalOpen(true)}>
            Открыть модальное окно
          </Button>
          <Modal
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            title="Пример модального окна"
            size="md"
            footer={
              <>
                <Button variant="ghost" onClick={() => setModalOpen(false)}>Отмена</Button>
                <Button variant="primary" onClick={() => setModalOpen(false)}>Подтвердить</Button>
              </>
            }
          >
            <p style={{ color: 'var(--color-text-secondary)', lineHeight: 'var(--leading-relaxed)' }}>
              Модальное окно построено с использованием CSS Modules и соблюдением всех
              accessibility-требований: фокус-ловушка, закрытие по Escape, ARIA-атрибуты.
            </p>
          </Modal>
        </section>

        {/* ── SECTION 8: Card ───────────────────────── */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>8. Карточки</h2>
          <div className={styles.cardGrid}>
            <Card hoverable onClick={() => {}}>
              <CardHeader title="Карточка Hoverable" subtitle="Нажмите для действия" />
              <CardBody>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
                  Карточка с эффектом подъёма при наведении и CSS Module стилизацией.
                </p>
              </CardBody>
              <CardFooter>
                <Button variant="ghost" size="sm">Отмена</Button>
                <Button variant="primary" size="sm">Действие</Button>
              </CardFooter>
            </Card>
            <Card selected>
              <CardHeader
                title="Выбранная карточка"
                subtitle="Состояние selected"
                action={<Badge variant="primary">Выбрано</Badge>}
              />
              <CardBody>
                <StatusBadge status="in_progress" />
              </CardBody>
            </Card>
          </div>
        </section>

        {/* ── SECTION 9: Header ──────────────────────── */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>9. Шапка (Header)</h2>
          <div className={styles.headerDemoWrap}>
            <Header
              appName="AI Portal"
              logo={<span>🚀</span>}
              userName="Елена Волкова"
              onToggleSidebar={() => {}}
            />
          </div>
        </section>

        {/* ── SECTION 10: Kanban Board ──────────────── */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>10. Kanban-доска</h2>
          {cardMoveToast && (
            <div className={styles.moveToast}>
              Перемещена карточка: {cardMoveToast}
            </div>
          )}
          <div className={styles.kanbanWrap}>
            <KanbanBoard
              columns={DEMO_COLUMNS}
              cards={demoCards}
              onCardMove={handleCardMove}
              onCardClick={(card) => { setSelectedCardId(card.id); setModalOpen(true); }}
            />
          </div>
        </section>
      </div>

      {/* Card detail modal */}
      <CardModal
        open={modalOpen}
        cardId={selectedCardId ?? undefined}
        boardId="demo-board"
        columns={DEMO_COLUMNS_RESPONSE}
        onClose={() => { setModalOpen(false); setSelectedCardId(null); }}
        onCardUpdated={handleCardUpdated}
      />
    </div>
  );
};

export default DesignSystemDemo;
