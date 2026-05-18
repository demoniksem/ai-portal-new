import React from 'react';
import styles from './Badge.module.css';
import { statusColorMap, priorityColorMap } from '../../styles/tokens';

export type BadgeVariant = 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';
export type BadgeSize = 'sm' | 'md';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  removable?: boolean;
  onRemove?: () => void;
  style?: React.CSSProperties;
  className?: string;
}

export interface StatusBadgeProps {
  status: keyof typeof statusColorMap;
  size?: BadgeSize;
  className?: string;
}

export interface PriorityBadgeProps {
  priority: keyof typeof priorityColorMap;
  size?: BadgeSize;
  className?: string;
}

// ── Generic Badge ────────────────────────────────────────────

export function Badge({
  children,
  variant = 'default',
  size = 'md',
  dot = false,
  removable = false,
  onRemove,
  style,
  className = '',
}: BadgeProps) {
  return (
    <span
      className={[styles.badge, styles[`badge--${variant}`], styles[`badge--${size}`], className].filter(Boolean).join(' ')}
      style={style}
    >
      {dot && <span className={styles.dot} aria-hidden="true" />}
      {children}
      {removable && (
        <button
          className={styles.removeBtn}
          onClick={onRemove}
          aria-label="Удалить"
          type="button"
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" width="10" height="10">
            <path d="M12 4L4 12M4 4l8 8" />
          </svg>
        </button>
      )}
    </span>
  );
}

// ── Status Badge ─────────────────────────────────────────────

export function StatusBadge({ status, size = 'md', className = '' }: StatusBadgeProps) {
  const cfg = statusColorMap[status];
  if (!cfg) return null;
  return (
    <span
      className={[styles.badge, styles[`badge--${size}`], className].filter(Boolean).join(' ')}
      style={{ backgroundColor: cfg.bg, color: cfg.text }}
    >
      {dotForStatus(status) && <span className={styles.dot} aria-hidden="true" />}
      {cfg.label}
    </span>
  );
}

function dotForStatus(status: string): boolean {
  return ['done', 'in_progress', 'blocked'].includes(status);
}

// ── Priority Badge ────────────────────────────────────────────

export function PriorityBadge({ priority, size = 'md', className = '' }: PriorityBadgeProps) {
  const cfg = priorityColorMap[priority];
  if (!cfg) return null;
  return (
    <span
      className={[styles.badge, styles[`badge--${size}`], className].filter(Boolean).join(' ')}
      style={{ color: cfg.color, fontWeight: 600 }}
    >
      <span
        className={styles.priorityDot}
        aria-hidden="true"
        style={{ backgroundColor: cfg.color }}
      />
      {cfg.label}
    </span>
  );
}
