import React from 'react';
import styles from './Card.module.css';

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
  selected?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  style?: React.CSSProperties;
}

export function Card({
  children,
  className = '',
  onClick,
  hoverable = false,
  selected = false,
  padding = 'md',
  style,
}: CardProps) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      className={[
        styles.card,
        hoverable || onClick ? styles['card--hoverable'] : '',
        selected ? styles['card--selected'] : '',
        styles[`card--padding-${padding}`],
        className,
      ].filter(Boolean).join(' ')}
      onClick={onClick}
      style={style}
    >
      {children}
    </Tag>
  );
}

// ── Card Header ─────────────────────────────────────────────

export interface CardHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}

export function CardHeader({ title, subtitle, action, className = '' }: CardHeaderProps) {
  return (
    <div className={[styles.header, className].filter(Boolean).join(' ')}>
      <div className={styles.headerText}>
        <h3 className={styles.title}>{title}</h3>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}

// ── Card Body ────────────────────────────────────────────────

export interface CardBodyProps {
  children: React.ReactNode;
  className?: string;
}

export function CardBody({ children, className = '' }: CardBodyProps) {
  return <div className={[styles.body, className].filter(Boolean).join(' ')}>{children}</div>;
}

// ── Card Footer ──────────────────────────────────────────────

export interface CardFooterProps {
  children: React.ReactNode;
  className?: string;
}

export function CardFooter({ children, className = '' }: CardFooterProps) {
  return <div className={[styles.footer, className].filter(Boolean).join(' ')}>{children}</div>;
}
