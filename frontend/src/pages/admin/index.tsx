'use client';
export const dynamic = 'force-dynamic';
import React, { useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import { Users, Buildings, Kanban, Cards, Lock, Palette, Robot } from '@phosphor-icons/react';
import { getStats, AdminStats } from '../../lib/admin-api';
import styles from '../../styles/admin.module.css';

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
      <h1 className={styles.pageTitle}>Dashboard</h1>
      <p className={styles.pageSubtitle}>Company overview and key metrics</p>

      {loading && <div className={styles.loadingContainer}>Loading stats...</div>}
      {error && <div className={`${styles.alert} ${styles.alertError}`}>{error}</div>}

      {stats && (
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statIcon}><Users size={26} weight="duotone" /></div>
            <p className={styles.statLabel}>Users</p>
            <p className={styles.statValue}>{stats.users}</p>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statIcon}><Buildings size={26} weight="duotone" /></div>
            <p className={styles.statLabel}>Departments</p>
            <p className={styles.statValue}>{stats.departments}</p>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statIcon}><Kanban size={26} weight="duotone" /></div>
            <p className={styles.statLabel}>Boards</p>
            <p className={styles.statValue}>{stats.boards}</p>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statIcon}><Cards size={26} weight="duotone" /></div>
            <p className={styles.statLabel}>Cards</p>
            <p className={styles.statValue}>{stats.cards}</p>
          </div>
        </div>
      )}

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Quick Actions</h2>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <a href="/admin/users" className={`${styles.btn} ${styles.btnPrimary}`} style={linkStyle}><Users size={16} weight="duotone" />Manage Users</a>
          <a href="/admin/departments" className={`${styles.btn} ${styles.btnPrimary}`} style={linkStyle}><Buildings size={16} weight="duotone" />Manage Departments</a>
          <a href="/admin/roles" className={`${styles.btn} ${styles.btnPrimary}`} style={linkStyle}><Lock size={16} weight="duotone" />Manage Roles</a>
          <a href="/admin/brand" className={`${styles.btn} ${styles.btnPrimary}`} style={linkStyle}><Palette size={16} weight="duotone" />Brand Settings</a>
          <a href="/admin/ai-config" className={`${styles.btn} ${styles.btnGhost}`} style={linkStyle}><Robot size={16} weight="duotone" />AI Settings</a>
        </div>
      </div>
    </AdminLayout>
  );
}
