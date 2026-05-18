import React from 'react';
import styles from './Avatar.module.css';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface AvatarProps {
  name?: string;
  src?: string;
  size?: AvatarSize;
  className?: string;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();
}

// Deterministic hue from name string
function getHue(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
}

export function Avatar({ name = '', src, size = 'md', className = '' }: AvatarProps) {
  const [imgError, setImgError] = React.useState(false);
  const initials = name ? getInitials(name) : '?';
  const hue = getHue(name || 'unknown');
  const bgColor = `hsl(${hue}, 55%, 45%)`;
  const textColor = `hsl(${hue}, 55%, 95%)`;

  if (src && !imgError) {
    return (
      <img
        src={src}
        alt={name}
        className={[styles.avatar, styles[`avatar--${size}`], className].filter(Boolean).join(' ')}
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <span
      className={[styles.avatar, styles.initials, styles[`avatar--${size}`], className].filter(Boolean).join(' ')}
      style={{ backgroundColor: bgColor, color: textColor }}
      aria-label={name || 'Пользователь'}
      title={name}
    >
      {initials}
    </span>
  );
}
