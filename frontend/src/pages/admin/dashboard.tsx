'use client';
export const dynamic = 'force-dynamic';
import React, { useState, useEffect } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Users, Buildings, Kanban, Cards, Lock, Palette, Robot } from '@phosphor-icons/react';
import { getStats, AdminStats } from '@/lib/admin-api';
import styles from '@/styles/admin.module.css';

const linkStyle = { display: 'inline-flex', alignItems: 'center', gap: 8 } as const;

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getStats()
      .then((s: AdminStats) => { setStats(s); setLoading(false); })
      .catch((e: unknown) => { setError((e as Error).message); setLoading(false); });
  }, []);

  return (
    <AdminLayout>
      <div style={{ marginBottom: 24 }}>
        <h1 className={styles.pageTitle}>Дашборд</h1>
        <p className={styles.pageSubtitle}>Обзор компании и ключевые метрики</p>
      </div>

      {loading && <div className={styles.loadingContainer}>Загрузка статистики…</div>}
      {error && <div className={`${styles.alert} ${styles.alertError}`}>{error}</div>}

      {stats && (
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statIcon}><Users size={26} weight="duotone" /></div>
            <p className={styles.statLabel}>Пользователи</p>
            <p className={styles.statValue}>{stats.users}</p>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statIcon}><Buildings size={26} weight="duotone" /></div>
            <p className={styles.statLabel}>Отделы</p>
            <p className={styles.statValue}>{stats.departments}</p>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statIcon}><Kanban size={26} weight="duotone" /></div>
            <p className={styles.statLabel}>Доски</p>
            <p className={styles.statValue}>{stats.boards}</p>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statIcon}><Cards size={26} weight="duotone" /></div>
            <p className={styles.statLabel}>Карточки</p>
            <p className={styles.statValue}>{stats.cards}</p>
          </div>
        </div>
      )}

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Быстрые действия</h2>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <a href="/admin/users" className={`${styles.btn} ${styles.btnPrimary}`} style={linkStyle}><Users size={16} weight="duotone" />Пользователи</a>
          <a href="/admin/departments" className={`${styles.btn} ${styles.btnPrimary}`} style={linkStyle}><Buildings size={16} weight="duotone" />Отделы</a>
          <a href="/admin/roles" className={`${styles.btn} ${styles.btnPrimary}`} style={linkStyle}><Lock size={16} weight="duotone" />Роли</a>
          <a href="/admin/brand" className={`${styles.btn} ${styles.btnPrimary}`} style={linkStyle}><Palette size={16} weight="duotone" />Брендинг</a>
          <a href="/settings" className={`${styles.btn} ${styles.btnGhost}`} style={linkStyle}><Robot size={16} weight="duotone" />Настройки ИИ</a>
        </div>
      </div>
    </AdminLayout>
  );
}
