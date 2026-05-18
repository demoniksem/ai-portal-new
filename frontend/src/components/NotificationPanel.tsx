import { useState, useEffect, useRef } from 'react';
import { getNotifications, markNotificationRead, markAllNotificationsRead, type Notification } from '../lib/api';

interface NotificationPanelProps {
  onClose: () => void;
}

export default function NotificationPanel({ onClose }: NotificationPanelProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadNotifications();
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  async function loadNotifications() {
    setLoading(true);
    try {
      const data = await getNotifications();
      setNotifications(data);
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  }

  async function handleMarkRead(id: number) {
    try {
      await markNotificationRead(id);
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, read: true } : n)
      );
    } catch {
      // silent fail
    }
  }

  async function handleMarkAllRead() {
    setMarking(true);
    try {
      await markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch {
      // silent fail
    } finally {
      setMarking(false);
    }
  }

  const unread = notifications.filter(n => !n.read).length;

  function formatTime(iso: string) {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 1) return 'только что';
    if (mins < 60) return `${mins} мин. назад`;
    if (hours < 24) return `${hours} ч. назад`;
    if (days < 7) return `${days} дн. назад`;
    return d.toLocaleDateString('ru-RU');
  }

  return (
    <div
      ref={panelRef}
      style={{
        position: 'fixed',
        top: 56,
        right: 16,
        width: 340,
        maxHeight: 480,
        background: 'var(--color-surface)',
        border: '1px solid var(--color-text-muted)',
        borderRadius: 10,
        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--color-text-muted)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--color-text)' }}>
            Уведомления
          </span>
          {unread > 0 && (
            <span style={{
              background: '#ef4444',
              color: '#fff',
              borderRadius: 10,
              padding: '1px 7px',
              fontSize: '0.72rem',
              fontWeight: 700,
            }}>
              {unread}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {unread > 0 && (
            <button
              onClick={handleMarkAllRead}
              disabled={marking}
              style={{
                background: 'none',
                border: 'none',
                color: '#3b82f6',
                cursor: marking ? 'not-allowed' : 'pointer',
                fontSize: '0.8rem',
                padding: '2px 4px',
                opacity: marking ? 0.5 : 1,
              }}
            >
              Отметить все прочитанными
            </button>
          )}
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-text-muted)',
              cursor: 'pointer',
              fontSize: '1.1rem',
              padding: '2px 4px',
              lineHeight: 1,
            }}
            aria-label="Закрыть"
          >
            ✕
          </button>
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {loading ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
            Загрузка...
          </div>
        ) : notifications.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
            Нет уведомлений
          </div>
        ) : (
          notifications.map(n => (
            <div
              key={n.id}
              onClick={() => !n.read && handleMarkRead(n.id)}
              style={{
                padding: '10px 16px',
                borderBottom: '1px solid var(--color-background-alt)',
                background: n.read ? 'transparent' : 'rgba(59,130,246,0.04)',
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = n.read ? 'var(--color-background-alt)' : 'rgba(59,130,246,0.08)')}
              onMouseLeave={e => (e.currentTarget.style.background = n.read ? 'transparent' : 'rgba(59,130,246,0.04)')}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 8 }}>
                <div style={{ fontSize: '0.88rem', fontWeight: n.read ? 400 : 600, color: 'var(--color-text)', flex: 1 }}>
                  {n.title}
                </div>
                {!n.read && (
                  <div style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: '#3b82f6',
                    flexShrink: 0,
                    marginTop: 5,
                  }} />
                )}
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', marginTop: 3, lineHeight: 1.4 }}>
                {n.message}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                {formatTime(n.created_at)}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
