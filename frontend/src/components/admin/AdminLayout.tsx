'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChartBar, Users, Buildings, Lock, Palette, Robot, Gear } from '@phosphor-icons/react';
import styles from '../../styles/admin.module.css';

const NAV_ITEMS = [
  { href: '/admin', label: 'Dashboard', icon: <ChartBar size={18} weight="duotone" />, exact: true },
  { href: '/admin/users', label: 'Users', icon: <Users size={18} weight="duotone" /> },
  { href: '/admin/departments', label: 'Departments', icon: <Buildings size={18} weight="duotone" /> },
  { href: '/admin/roles', label: 'Roles', icon: <Lock size={18} weight="duotone" /> },
  { href: '/admin/brand', label: 'Brand Settings', icon: <Palette size={18} weight="duotone" /> },
  { href: '/settings', label: 'AI Settings', icon: <Robot size={18} weight="duotone" /> },
];

function getToken(): string {
  return typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '';
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      window.location.href = '/login';
      return;
    }
    setChecking(false);
  }, []);

  if (checking) {
    return <div className={styles.loadingContainer}>Checking auth...</div>;
  }

  const isActive = (item: typeof NAV_ITEMS[0]) => {
    if (item.exact) return pathname === item.href;
    return pathname === item.href || pathname.startsWith(item.href + '/');
  };

  return (
    <div className={styles.page}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <p className={styles.sidebarTitle} style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Gear size={18} weight="duotone" />Admin Panel</p>
        </div>
        <nav className={styles.nav}>
          {NAV_ITEMS.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.navLink} ${isActive(item) ? styles.navLinkActive : ''}`}
            >
              <span className={styles.navIcon}>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
