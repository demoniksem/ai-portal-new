import React from 'react';
import styles from './Header.module.css';
import { Avatar } from './Avatar';

export interface HeaderProps {
  /** App name displayed in the header */
  appName?: string;
  /** Logo emoji or SVG */
  logo?: React.ReactNode;
  /** Right side content */
  actions?: React.ReactNode;
  /** User name shown next to avatar */
  userName?: string;
  /** User avatar src */
  userAvatar?: string;
  /** Callback when sidebar toggle is clicked */
  onToggleSidebar?: () => void;
  /** Whether sidebar is open (for toggle icon state) */
  sidebarOpen?: boolean;
  className?: string;
}

export function Header({
  appName = 'AI Portal',
  logo,
  actions,
  userName,
  userAvatar,
  onToggleSidebar,
  sidebarOpen = true,
  className = '',
}: HeaderProps) {
  return (
    <header className={[styles.header, className].filter(Boolean).join(' ')}>
      {/* Left: sidebar toggle + logo */}
      <div className={styles.left}>
        {onToggleSidebar && (
          <button
            className={styles.menuBtn}
            onClick={onToggleSidebar}
            aria-label={sidebarOpen ? 'Свернуть боковую панель' : 'Развернуть боковую панель'}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
              {sidebarOpen ? (
                // Hamburger → X
                <>
                  <path d="M3 12h18M3 6h18M3 18h18" />
                </>
              ) : (
                // Collapsed → hamburger
                <>
                  <path d="M4 6h16M4 12h16M4 18h16" />
                </>
              )}
            </svg>
          </button>
        )}

        <div className={styles.brand}>
          {logo && <span className={styles.logo} aria-hidden="true">{logo}</span>}
          <span className={styles.appName}>{appName}</span>
        </div>
      </div>

      {/* Right: actions + user */}
      <div className={styles.right}>
        {actions && <div className={styles.actions}>{actions}</div>}
        {userName && (
          <div className={styles.user}>
            <Avatar name={userName} src={userAvatar} size="sm" />
            <span className={styles.userName}>{userName}</span>
          </div>
        )}
      </div>
    </header>
  );
}
