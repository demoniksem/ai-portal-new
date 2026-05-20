'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  Notification,
} from '../lib/api';

// Paperclip API base (:3100)
const PC_API = 'http://localhost:3100';
// ai-portal backend base (:8081)
const PORTAL_API = 'http://localhost:3001';

function getToken(): string {
  return typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '';
}

// Fetches against Paperclip API
async function pcFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${PC_API}${endpoint}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json() as Promise<T>;
}

// Fetches against ai-portal backend (:8081) for home-specific data
async function portalFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${PORTAL_API}${endpoint}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json() as Promise<T>;
}

interface MyCard {
  id: string;
  board_id: string;
  column_id: string;
  swimlane_id: string | null;
  title: string;
  type: string;
  description?: string;
  priority: string;
  deadline?: string;
  start_date?: string;
  position: number;
  boardName: string;
  columnName: string;
  created_at: string;
  updated_at: string;
}

interface ActivityItem {
  id: string;
  card_id: string;
  actor_id: string;
  action: string;
  field: string | null;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
  card_title: string;
  board_name: string;
  username: string;
}

interface CalendarCard {
  id: string;
  title: string;
  board_id: string;
  boardName: string;
  columnName: string;
  deadline: string;
  priority: string;
}

async function getMyCards(): Promise<MyCard[]> {
  const data = await portalFetch<{ cards: MyCard[] }>('/api/home/my-cards');
  return data.cards;
}

async function getActivity(limit = 30): Promise<ActivityItem[]> {
  const data = await portalFetch<{ activities: ActivityItem[] }>(`/api/home/activity?limit=${limit}`);
  return data.activities;
}

async function getCalendar(start: string, end: string): Promise<CalendarCard[]> {
  const data = await portalFetch<{ cards: CalendarCard[] }>(`/api/home/calendar?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`);
  return data.cards;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'только что';
  if (mins < 60) return `${mins} мин. назад`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ч. назад`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} дн. назад`;
  return new Date(dateStr).toLocaleDateString('ru-RU');
}

function formatActivityDescription(item: ActivityItem): string {
  const actor = item.username || 'Кто-то';
  const card = item.card_title || 'карточка';
  const board = item.board_name || '';
  switch (item.action) {
    case 'created': return `✏️ ${actor} создал(а) «${card}»${board ? ` в ${board}` : ''}`;
    case 'updated': return `🔄 ${actor} обновил(а) «${card}»${board ? ` в ${board}` : ''}`;
    case 'moved': return `📦 ${actor} переместил(а) «${card}»${board ? ` в ${board}` : ''}`;
    case 'commented': return `💬 ${actor} прокомментировал(а) «${card}»${board ? ` в ${board}` : ''}`;
    case 'assigned': return `👤 ${actor} назначил(а) «${card}»${board ? ` в ${board}` : ''}`;
    default: return `📝 ${actor} изменил(а) «${card}»${board ? ` в ${board}` : ''}`;
  }
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

function isOverdue(deadline: string | null | undefined): boolean {
  if (!deadline) return false;
  return new Date(deadline) < new Date();
}

function getPriorityColor(priority: string): string {
  const colors: Record<string, string> = {
    low: '#22c55e', medium: '#3b82f6', high: '#f59e0b', urgent: '#ef4444',
  };
  return colors[priority] || '#6b7280';
}

function getPriorityLabel(priority: string): string {
  const labels: Record<string, string> = {
    low: 'Низкий', medium: 'Средний', high: 'Высокий', urgent: 'Срочный',
  };
  return labels[priority] || priority;
}

function getTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    task: '📋', bug: '🐛', story: '📖', epic: '🚀',
  };
  return icons[type] || '📋';
}

// ─── My Tasks Widget ─────────────────────────────────────────────────────────

interface MyTasksWidgetProps {
  currentUserId: string;
}

export function MyTasksWidget({ currentUserId }: MyTasksWidgetProps) {
  const [tasks, setTasks] = useState<MyCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<{ status: 'all' | 'active' | 'done' | 'overdue'; priority: string }>({
    status: 'all', priority: '',
  });

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const cards = await getMyCards();
      // Filter cards assigned to current user
      // The /api/home/my-cards already returns cards for the authed user
      setTasks(cards);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  // Client-side filtering by priority
  const filteredTasks = tasks.filter(task => {
    if (filter.status === 'overdue') return isOverdue(task.deadline);
    if (filter.status === 'active') return !isOverdue(task.deadline);
    return true;
  }).filter(task => {
    if (!filter.priority) return true;
    return task.priority === filter.priority;
  });

  return (
    <div style={W.widget}>
      <div style={W.widgetHeader}>
        <h2 style={W.widgetTitle}>📋 Мои задачи</h2>
        <div style={W.widgetActions}>
          <select
            value={filter.status}
            onChange={e => setFilter(f => ({ ...f, status: e.target.value as typeof f.status }))}
            style={W.select}
          >
            <option value="all">Все</option>
            <option value="active">Активные</option>
            <option value="overdue">Просроченные</option>
          </select>
          <select
            value={filter.priority}
            onChange={e => setFilter(f => ({ ...f, priority: e.target.value }))}
            style={W.select}
          >
            <option value="">Приоритет</option>
            <option value="urgent">Срочный</option>
            <option value="high">Высокий</option>
            <option value="medium">Средний</option>
            <option value="low">Низкий</option>
          </select>
          <button style={W.refreshBtn} onClick={fetchTasks} title="Обновить">🔄</button>
        </div>
      </div>

      {loading && <div style={W.loading}>Загрузка задач...</div>}
      {error && <div style={W.error}>{error}</div>}
      {!loading && !error && filteredTasks.length === 0 && (
        <div style={W.empty}>Нет задач{filter.status !== 'all' ? ' с выбранным фильтром' : ''}</div>
      )}
      {!loading && !error && filteredTasks.length > 0 && (
        <div style={W.taskList}>
          {filteredTasks.map(task => (
            <div key={task.id} style={W.taskCard}>
              <div style={W.taskCardTop}>
                <span style={W.taskTypeIcon}>{getTypeIcon(task.type)}</span>
                <span style={{
                  ...W.priorityBadge,
                  background: getPriorityColor(task.priority) + '22',
                  color: getPriorityColor(task.priority),
                }}>
                  {getPriorityLabel(task.priority)}
                </span>
                {isOverdue(task.deadline) && (
                  <span style={W.overdueBadge}>⚠️ Просрочено</span>
                )}
              </div>
              <div style={W.taskTitle}>{task.title}</div>
              {task.description && (
                <div style={W.taskDesc}>{task.description.slice(0, 80)}{task.description.length > 80 ? '…' : ''}</div>
              )}
              <div style={W.taskMeta}>
                <span>📁 {task.boardName}</span>
                <span>→ {task.columnName}</span>
              </div>
              {task.deadline && (
                <div style={{
                  ...W.taskDeadline,
                  color: isOverdue(task.deadline) ? '#ef4444' : 'var(--color-text-muted)',
                }}>
                  📅 {formatDate(task.deadline)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {!loading && !error && (
        <div style={W.widgetFooter}>
          Всего: {filteredTasks.length} из {tasks.length} задач
        </div>
      )}
    </div>
  );
}

// ─── Activity Feed Widget ────────────────────────────────────────────────────

export function ActivityFeedWidget() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchActivity = useCallback(async () => {
    setLoading(true);
    try {
      const items = await getActivity(30);
      setActivities(items);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchActivity(); }, [fetchActivity]);

  return (
    <div style={W.widget}>
      <div style={W.widgetHeader}>
        <h2 style={W.widgetTitle}>📣 Лента активности</h2>
        <button style={W.refreshBtn} onClick={fetchActivity} title="Обновить">🔄</button>
      </div>
      {loading && <div style={W.loading}>Загрузка...</div>}
      {!loading && activities.length === 0 && <div style={W.empty}>Нет активности</div>}
      {!loading && activities.length > 0 && (
        <div style={W.activityList}>
          {activities.map(item => (
            <div key={item.id} style={W.activityItem}>
              <div style={W.activityDot} />
              <div style={W.activityContent}>
                <div style={W.activityDesc}>{formatActivityDescription(item)}</div>
                <div style={W.activityTime}>{timeAgo(item.created_at)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Notifications Widget ─────────────────────────────────────────────────────

export function NotificationsWidget() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getNotifications();
      setNotifications(Array.isArray(data) ? data : []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch { /* silent */ }
  };

  const markOneRead = async (id: number) => {
    try {
      await markNotificationRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } catch { /* silent */ }
  };

  return (
    <div style={W.widget}>
      <div style={W.widgetHeader}>
        <h2 style={W.widgetTitle}>
          🔔 Уведомления
          {unreadCount > 0 && <span style={W.badge}>{unreadCount}</span>}
        </h2>
        {unreadCount > 0 && (
          <button style={W.markReadBtn} onClick={markAllRead}>Отметить прочитанными</button>
        )}
      </div>
      {loading && <div style={W.loading}>Загрузка...</div>}
      {!loading && notifications.length === 0 && <div style={W.empty}>Нет уведомлений</div>}
      {!loading && notifications.length > 0 && (
        <div style={W.notifList}>
          {notifications.map(n => (
            <div
              key={n.id}
              style={{ ...W.notifItem, opacity: n.read ? 0.6 : 1 }}
              onClick={() => !n.read && markOneRead(n.id)}
              title={!n.read ? 'Нажмите, чтобы отметить прочитанным' : undefined}
            >
              <div style={W.notifTitle}>{n.title}</div>
              {n.message && <div style={W.notifMsg}>{n.message}</div>}
              <div style={W.notifTime}>{timeAgo(n.created_at)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Calendar Widget ─────────────────────────────────────────────────────────

export function CalendarWidget() {
  const [calendarCards, setCalendarCards] = useState<CalendarCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());

  const fetchCalendarCards = useCallback(async () => {
    setLoading(true);
    try {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const start = new Date(year, month, 1).toISOString();
      const end = new Date(year, month + 1, 0, 23, 59, 59).toISOString();
      const cards = await getCalendar(start, end);
      setCalendarCards(cards);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [currentDate]);

  useEffect(() => { fetchCalendarCards(); }, [fetchCalendarCards]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
  const daysInMonth = lastDay.getDate();
  const today = new Date();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const monthName = currentDate.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });

  const getCardsForDay = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return calendarCards.filter(c => c.deadline.startsWith(dateStr));
  };

  const isToday = (day: number) =>
    today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;

  const isPast = (day: number) => {
    const d = new Date(year, month, day);
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return d < todayStart;
  };

  const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

  return (
    <div style={W.widget}>
      <div style={W.widgetHeader}>
        <h2 style={W.widgetTitle}>📅 Календарь</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button style={W.navBtn} onClick={prevMonth}>←</button>
          <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-text)', minWidth: 120, textAlign: 'center' }}>
            {monthName}
          </span>
          <button style={W.navBtn} onClick={nextMonth}>→</button>
        </div>
      </div>

      <div style={W.calendar}>
        <div style={W.calendarGrid}>
          {weekDays.map(d => <div key={d} style={W.calendarWeekday}>{d}</div>)}
          {Array.from({ length: startOffset }, (_, i) => (
            <div key={`empty-${i}`} style={W.calendarEmpty} />
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1;
            const dayCards = getCardsForDay(day);
            return (
              <div
                key={day}
                style={{
                  ...W.calendarDay,
                  ...(isToday(day) ? W.calendarDayToday : {}),
                  ...(isPast(day) && dayCards.length > 0 ? W.calendarDayPast : {}),
                }}
              >
                <span style={{
                  fontSize: '0.82rem',
                  fontWeight: isToday(day) ? 700 : 400,
                  color: isPast(day) && !isToday(day) ? '#9ca3af' : 'var(--color-text)',
                }}>
                  {day}
                </span>
                {dayCards.slice(0, 2).map(card => (
                  <div
                    key={card.id}
                    style={{
                      ...W.calendarCardChip,
                      background: getPriorityColor(card.priority) + '22',
                      color: getPriorityColor(card.priority),
                      borderLeft: `3px solid ${getPriorityColor(card.priority)}`,
                    }}
                    title={card.title}
                  >
                    {card.title.slice(0, 12)}{card.title.length > 12 ? '…' : ''}
                  </div>
                ))}
                {dayCards.length > 2 && (
                  <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', paddingLeft: 4 }}>
                    +{dayCards.length - 2}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {!loading && calendarCards.length > 0 && (
        <div style={W.calendarLegend}>
          <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
            {calendarCards.length} задач с дедлайнами
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Quick Stats ─────────────────────────────────────────────────────────────

interface QuickStatsProps {
  currentUserId: string;
}

export function QuickStats({ currentUserId }: QuickStatsProps) {
  const [stats, setStats] = useState({ total: 0, active: 0, overdue: 0 });

  useEffect(() => {
    const fetch = async () => {
      try {
        const cards = await getMyCards();
        const overdue = cards.filter(c => isOverdue(c.deadline));
        setStats({ total: cards.length, active: cards.length - overdue.length, overdue: overdue.length });
      } catch { /* silent */ }
    };
    fetch();
  }, [currentUserId]);

  return (
    <div style={W.statsRow}>
      <div style={W.statCard}>
        <div style={W.statNum}>{stats.total}</div>
        <div style={W.statLabel}>Всего задач</div>
      </div>
      <div style={{ ...W.statCard, borderLeft: '3px solid #3b82f6' }}>
        <div style={{ ...W.statNum, color: '#3b82f6' }}>{stats.active}</div>
        <div style={W.statLabel}>Активных</div>
      </div>
      <div style={{ ...W.statCard, borderLeft: '3px solid #ef4444' }}>
        <div style={{ ...W.statNum, color: '#ef4444' }}>{stats.overdue}</div>
        <div style={W.statLabel}>Просрочено</div>
      </div>
    </div>
  );
}

// ─── Main Home Page ──────────────────────────────────────────────────────────

export default function Home() {
  const router = typeof window !== 'undefined' ? useRouter() : null;
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [currentUserName, setCurrentUserName] = useState<string>('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showMobilePanel, setShowMobilePanel] = useState<'tasks' | 'activity' | 'calendar'>('tasks');

  useEffect(() => {
    const token = getToken();
    if (!token) {
      if (router) router.push('/login');
      else window.location.href = '/login';
      return;
    }
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      setCurrentUserId(payload.id || payload.sub || '');
      setCurrentUserName(payload.name || payload.username || 'Сотрудник');
    } catch {
      setCurrentUserId('');
      setCurrentUserName('Сотрудник');
    }
  }, [router]);

  // Poll for notifications every 30s
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    const interval = setInterval(async () => {
      try {
        await getNotifications();
      } catch { /* silent */ }
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  if (!currentUserId) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', color: 'var(--color-text-muted)' }}>
      Загрузка...
    </div>
  );

  return (
    <div style={H.container}>
      {/* Top Bar */}
      <header style={H.header}>
        <div style={H.headerLeft}>
          <h1 style={H.pageTitle}>🏠 Главная</h1>
          <span style={H.greeting}>Добро пожаловать, {currentUserName}</span>
        </div>
        <div style={H.headerRight}>
          <button
            style={H.notifBtn}
            onClick={() => setShowNotifications(!showNotifications)}
          >
            🔔
          </button>
          <button
            style={H.boardsBtn}
            onClick={() => router ? router.push('/') : window.location.href = '/'}
          >
            ← К доскам
          </button>
        </div>
      </header>

      {/* Notifications popup */}
      {showNotifications && (
        <div style={H.notifOverlay} onClick={() => setShowNotifications(false)}>
          <div style={H.notifPanel} onClick={e => e.stopPropagation()}>
            <NotificationsWidget />
          </div>
        </div>
      )}

      {/* Main content */}
      <main style={H.main}>
        {/* Quick Stats */}
        <QuickStats currentUserId={currentUserId} />

        {/* Mobile tabs */}
        <div style={H.mobileTabs} className="home-mobile-tabs">
          {(['tasks', 'activity', 'calendar'] as const).map(tab => (
            <button
              key={tab}
              style={{ ...H.mobileTab, ...(showMobilePanel === tab ? H.mobileTabActive : {}) }}
              onClick={() => setShowMobilePanel(tab)}
            >
              {tab === 'tasks' ? '📋 Задачи' : tab === 'activity' ? '📣 Активность' : '📅 Календарь'}
            </button>
          ))}
        </div>

        {/* Desktop: 3-column layout */}
        <div style={H.desktopLayout} className="home-desktop-layout">
          {/* My Tasks */}
          <div style={H.column}>
            <MyTasksWidget currentUserId={currentUserId} />
          </div>
          {/* Activity */}
          <div style={H.column}>
            <ActivityFeedWidget />
          </div>
          {/* Calendar */}
          <div style={H.column}>
            <CalendarWidget />
          </div>
        </div>

        {/* Mobile: single panel */}
        <div style={H.mobileLayout} className="home-mobile-layout">
          {showMobilePanel === 'tasks' && <MyTasksWidget currentUserId={currentUserId} />}
          {showMobilePanel === 'activity' && <ActivityFeedWidget />}
          {showMobilePanel === 'calendar' && <CalendarWidget />}
        </div>
      </main>
    </div>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const W: Record<string, React.CSSProperties> = {
  widget: {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-text-muted)',
    borderRadius: 12,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  widgetHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '14px 16px',
    borderBottom: '1px solid var(--color-text-muted)',
    background: 'var(--color-background-alt)',
    flexWrap: 'wrap',
    gap: 8,
  },
  widgetTitle: {
    fontSize: '1rem',
    fontWeight: 700,
    color: 'var(--color-text)',
    margin: 0,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  widgetActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  widgetFooter: {
    padding: '8px 16px',
    borderTop: '1px solid var(--color-text-muted)',
    fontSize: '0.78rem',
    color: 'var(--color-text-muted)',
    background: 'var(--color-background-alt)',
  },
  select: {
    padding: '4px 8px',
    border: '1px solid var(--color-text-muted)',
    borderRadius: 6,
    fontSize: '0.82rem',
    background: 'var(--color-surface)',
    color: 'var(--color-text)',
    cursor: 'pointer',
  },
  refreshBtn: {
    background: 'none',
    border: '1px solid var(--color-text-muted)',
    borderRadius: 6,
    cursor: 'pointer',
    padding: '4px 8px',
    fontSize: '0.82rem',
    color: 'var(--color-text-secondary)',
  },
  loading: {
    padding: '20px',
    textAlign: 'center',
    color: 'var(--color-text-muted)',
    fontSize: '0.9rem',
  },
  error: {
    padding: '12px 16px',
    color: '#ef4444',
    fontSize: '0.85rem',
  },
  empty: {
    padding: '24px',
    textAlign: 'center',
    color: 'var(--color-text-muted)',
    fontSize: '0.88rem',
    fontStyle: 'italic',
  },
  taskList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
    maxHeight: 480,
    overflowY: 'auto',
  },
  taskCard: {
    padding: '12px 16px',
    borderBottom: '1px solid var(--color-text-muted)',
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
  taskCardTop: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  taskTypeIcon: {
    fontSize: '0.85rem',
  },
  priorityBadge: {
    fontSize: '0.72rem',
    padding: '2px 7px',
    borderRadius: 999,
    fontWeight: 600,
  },
  overdueBadge: {
    fontSize: '0.72rem',
    color: '#ef4444',
    fontWeight: 600,
  },
  taskTitle: {
    fontSize: '0.9rem',
    fontWeight: 600,
    color: 'var(--color-text)',
    marginBottom: 2,
  },
  taskDesc: {
    fontSize: '0.78rem',
    color: 'var(--color-text-muted)',
    marginBottom: 4,
    lineHeight: 1.4,
  },
  taskMeta: {
    fontSize: '0.72rem',
    color: 'var(--color-text-muted)',
    marginBottom: 2,
    display: 'flex',
    gap: 6,
  },
  taskDeadline: {
    fontSize: '0.78rem',
    color: 'var(--color-text-muted)',
  },
  activityList: {
    display: 'flex',
    flexDirection: 'column',
    maxHeight: 480,
    overflowY: 'auto',
  },
  activityItem: {
    display: 'flex',
    gap: 10,
    padding: '10px 16px',
    borderBottom: '1px solid var(--color-text-muted)',
  },
  activityDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: 'var(--color-active-nav)',
    marginTop: 5,
    flexShrink: 0,
  },
  activityContent: {
    flex: 1,
    minWidth: 0,
  },
  activityDesc: {
    fontSize: '0.85rem',
    color: 'var(--color-text)',
    lineHeight: 1.4,
  },
  activityTime: {
    fontSize: '0.72rem',
    color: 'var(--color-text-muted)',
    marginTop: 2,
  },
  notifList: {
    display: 'flex',
    flexDirection: 'column',
    maxHeight: 400,
    overflowY: 'auto',
  },
  notifItem: {
    padding: '10px 16px',
    borderBottom: '1px solid var(--color-text-muted)',
    cursor: 'pointer',
  },
  notifTitle: {
    fontSize: '0.88rem',
    fontWeight: 600,
    color: 'var(--color-text)',
    marginBottom: 2,
  },
  notifMsg: {
    fontSize: '0.8rem',
    color: 'var(--color-text-muted)',
    marginBottom: 2,
    lineHeight: 1.4,
  },
  notifTime: {
    fontSize: '0.72rem',
    color: 'var(--color-text-muted)',
  },
  badge: {
    background: '#ef4444',
    color: '#fff',
    borderRadius: 999,
    padding: '1px 7px',
    fontSize: '0.72rem',
    fontWeight: 700,
    marginLeft: 4,
  },
  markReadBtn: {
    fontSize: '0.78rem',
    background: 'none',
    border: '1px solid var(--color-text-muted)',
    borderRadius: 6,
    cursor: 'pointer',
    padding: '3px 8px',
    color: 'var(--color-text-secondary)',
  },
  calendar: {
    padding: '12px',
  },
  calendarGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: 2,
  },
  calendarWeekday: {
    textAlign: 'center',
    fontSize: '0.72rem',
    fontWeight: 700,
    color: 'var(--color-text-muted)',
    padding: '4px 0',
  },
  calendarEmpty: {},
  calendarDay: {
    aspectRatio: '1',
    padding: '3px',
    border: '1px solid var(--color-text-muted)',
    borderRadius: 4,
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
    minHeight: 48,
    overflow: 'hidden',
  },
  calendarDayToday: {
    borderColor: 'var(--color-active-nav)',
    borderWidth: 2,
    background: 'var(--color-primary-light)',
  },
  calendarDayPast: {
    opacity: 0.7,
  },
  calendarCardChip: {
    fontSize: '0.6rem',
    padding: '1px 3px',
    borderRadius: 3,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  calendarLegend: {
    padding: '8px 12px',
    borderTop: '1px solid var(--color-text-muted)',
    background: 'var(--color-background-alt)',
  },
  statsRow: {
    display: 'flex',
    gap: 12,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  statCard: {
    flex: 1,
    minWidth: 120,
    background: 'var(--color-surface)',
    border: '1px solid var(--color-text-muted)',
    borderRadius: 10,
    padding: '14px 16px',
    borderLeft: '3px solid var(--color-active-nav)',
  },
  statNum: {
    fontSize: '1.8rem',
    fontWeight: 800,
    color: 'var(--color-text)',
    lineHeight: 1,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: '0.78rem',
    color: 'var(--color-text-muted)',
    fontWeight: 500,
  },
  navBtn: {
    background: 'var(--color-background-alt)',
    border: '1px solid var(--color-text-muted)',
    borderRadius: 6,
    cursor: 'pointer',
    padding: '4px 10px',
    fontSize: '0.85rem',
    color: 'var(--color-text)',
  },
};

const H: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    background: 'var(--color-background)',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 24px',
    background: 'var(--color-surface)',
    borderBottom: '1px solid var(--color-text-muted)',
    flexWrap: 'wrap',
    gap: 12,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    flexWrap: 'wrap',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  pageTitle: {
    fontSize: '1.4rem',
    fontWeight: 800,
    color: 'var(--color-text)',
    margin: 0,
  },
  greeting: {
    fontSize: '0.9rem',
    color: 'var(--color-text-muted)',
    fontWeight: 500,
  },
  notifBtn: {
    background: 'var(--color-background-alt)',
    border: '1px solid var(--color-text-muted)',
    borderRadius: 8,
    cursor: 'pointer',
    padding: '8px 12px',
    fontSize: '1.1rem',
  },
  boardsBtn: {
    background: 'var(--color-primary-light)',
    border: '1px solid var(--color-primary)',
    borderRadius: 8,
    cursor: 'pointer',
    padding: '8px 14px',
    fontSize: '0.85rem',
    color: 'var(--color-primary)',
    fontWeight: 600,
  },
  notifOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    background: 'rgba(0,0,0,0.3)',
  },
  notifPanel: {
    position: 'absolute',
    top: 60,
    right: 24,
    width: 380,
    maxHeight: '80vh',
    zIndex: 1001,
    boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
    borderRadius: 12,
    overflow: 'hidden',
  },
  main: {
    flex: 1,
    padding: '20px 24px',
    maxWidth: 1400,
    width: '100%',
    margin: '0 auto',
    boxSizing: 'border-box',
  },
  mobileTabs: {
    display: 'none',
    gap: 8,
    marginBottom: 16,
  },
  mobileTab: {
    flex: 1,
    padding: '8px 12px',
    background: 'var(--color-surface)',
    border: '1px solid var(--color-text-muted)',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: '0.85rem',
    color: 'var(--color-text-secondary)',
    fontWeight: 500,
  },
  mobileTabActive: {
    background: 'var(--color-primary-light)',
    borderColor: 'var(--color-primary)',
    color: 'var(--color-primary)',
    fontWeight: 600,
  },
  desktopLayout: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: 16,
    alignItems: 'start',
  },
  column: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  mobileLayout: {
    display: 'none',
  },
};
