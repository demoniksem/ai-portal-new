'use client';
export const dynamic = 'force-dynamic';
import React, { useState, useEffect, useCallback, FormEvent } from 'react';
import AdminLayout from '../../../components/admin/AdminLayout';
import { getRoles, updateCompanyRole, RoleUser } from '../../../lib/admin-api';
import styles from '../../../styles/admin.module.css';

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Супер Админ',
  admin: 'Админ',
  employee: 'Сотрудник',
  guest: 'Гость',
};

const ROLE_BADGE: Record<string, string> = {
  super_admin: styles.badgeSuperAdmin,
  admin: styles.badgeAdmin,
  employee: styles.badgeEmployee,
  guest: styles.badgeGuest,
};

function initials(name?: string): string {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

export default function RolesPage() {
  const [users, setUsers] = useState<RoleUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editRole, setEditRole] = useState<RoleUser | null>(null);
  const [newRole, setNewRole] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getRoles();
      setUsers(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function openEdit(u: RoleUser) {
    setEditRole(u);
    setNewRole(u.company_role || 'employee');
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!editRole) return;
    setSaving(true);
    try {
      await updateCompanyRole(editRole.id, newRole);
      setEditRole(null);
      await load();
    } catch { /* ok */ } finally {
      setSaving(false);
    }
  }

  return (
    <AdminLayout>
      <div style={{ marginBottom: 24 }}>
        <h1 className={styles.pageTitle}>Роли и права доступа</h1>
        <p className={styles.pageSubtitle}>Управление ролями компании и подразделений для всех пользователей</p>
      </div>

      {loading && <div className={styles.loadingContainer}>Загрузка...</div>}
      {error && <div className={`${styles.alert} ${styles.alertError}`}>{error}</div>}
      {!loading && users.length === 0 && <div className={styles.emptyState}>Пользователи не найдены</div>}

      {!loading && users.length > 0 && (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Пользователь</th>
                <th>Роль компании</th>
                <th>Роли подразделений</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%',
                        background: 'var(--color-primary-bg)', color: 'var(--color-primary)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.75rem', fontWeight: 700, flexShrink: 0,
                      }}>
                        {initials(u.full_name)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{u.full_name || '—'}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`${styles.badge} ${ROLE_BADGE[u.company_role] || styles.badgeGuest}`}>
                      {ROLE_LABELS[u.company_role] || u.company_role}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {u.department_roles.length === 0 && (
                        <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>—</span>
                      )}
                      {u.department_roles.map((dr, i) => (
                        <span key={i} className={`${styles.badge} ${dr.role === 'department_head' ? styles.badgeHead : styles.badgeMember}`}>
                          {dr.departmentName}
                          {dr.role === 'department_head' ? ' ★' : ''}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <button
                      className={`${styles.btn} ${styles.btnSm} ${styles.btnGhost}`}
                      onClick={() => openEdit(u)}
                    >
                      Изменить роль
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editRole && (
        <div className={styles.modalOverlay} onClick={() => setEditRole(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalTitle}>
              Изменить роль: {editRole.full_name || editRole.email}
            </div>
            <form onSubmit={e => { void handleSave(e); }}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Роль компании</label>
                <select className={styles.formSelect} value={newRole} onChange={e => setNewRole(e.target.value)}>
                  <option value="employee">Сотрудник</option>
                  <option value="admin">Админ</option>
                  <option value="super_admin">Супер Админ</option>
                  <option value="guest">Гость</option>
                </select>
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => setEditRole(null)}>Отмена</button>
                <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={saving}>
                  {saving ? 'Сохранение...' : 'Сохранить'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
