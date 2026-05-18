'use client';
export const dynamic = 'force-dynamic';
import React, { useState, useEffect, useCallback, FormEvent } from 'react';
import AdminLayout from '../../../components/admin/AdminLayout';
import {
  getUsers, createUser, updateUser, deleteUser,
  AdminUser,
} from '../../../lib/admin-api';
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

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AdminUser | null>(null);

  const [cEmail, setCEmail] = useState('');
  const [cPassword, setCPassword] = useState('');
  const [cFullName, setCFullName] = useState('');
  const [cRole, setCRole] = useState('employee');
  const [cSaving, setCSaving] = useState(false);
  const [cError, setCError] = useState('');

  const [eFullName, setEFullName] = useState('');
  const [eRole, setERole] = useState('');
  const [eSaving, setESaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getUsers();
      setUsers(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setCError('');
    setCSaving(true);
    try {
      await createUser({ email: cEmail, password: cPassword, fullName: cFullName, role: cRole });
      setShowCreate(false);
      setCEmail(''); setCPassword(''); setCFullName(''); setCRole('employee');
      await load();
    } catch (err) {
      setCError((err as Error).message);
    } finally {
      setCSaving(false);
    }
  }

  function openEdit(u: AdminUser) {
    setEditUser(u);
    setEFullName(u.full_name || '');
    setERole(u.company_role || 'employee');
  }

  async function handleEdit(e: FormEvent) {
    e.preventDefault();
    if (!editUser) return;
    setESaving(true);
    try {
      await updateUser(editUser.id, { fullName: eFullName, role: eRole });
      setEditUser(null);
      await load();
    } catch { /* ok */ } finally {
      setESaving(false);
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    try {
      await deleteUser(confirmDelete.id);
      setConfirmDelete(null);
      await load();
    } catch { /* ok */ }
  }

  async function handleToggleActive(u: AdminUser) {
    try {
      await updateUser(u.id, { isActive: !u.is_active });
      await load();
    } catch { /* ok */ }
  }

  return (
    <AdminLayout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className={styles.pageTitle}>Пользователи</h1>
          <p className={styles.pageSubtitle}>{users.length} пользователей в компании</p>
        </div>
        <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setShowCreate(true)}>
          + Новый пользователь
        </button>
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
                <th>Роль</th>
                <th>Статус</th>
                <th>Создан</th>
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
                    {u.is_active
                      ? <span className={`${styles.badge} ${styles.badgeActive}`}>● Активен</span>
                      : <span className={`${styles.badge} ${styles.badgeInactive}`}>○ Неактивен</span>
                    }
                  </td>
                  <td style={{ color: 'var(--color-text-muted)', fontSize: '0.82rem' }}>{formatDate(u.created_at)}</td>
                  <td>
                    <div className={styles.btnGroup}>
                      <button className={`${styles.btn} ${styles.btnSm} ${styles.btnGhost}`} onClick={() => openEdit(u)}>Изменить</button>
                      {u.is_active
                        ? <button className={`${styles.btn} ${styles.btnSm} ${styles.btnGhost}`} onClick={() => handleToggleActive(u)}>Деактивировать</button>
                        : <button className={`${styles.btn} ${styles.btnSm} ${styles.btnGhost}`} onClick={() => handleToggleActive(u)}>Активировать</button>
                      }
                      <button className={`${styles.btn} ${styles.btnSm} ${styles.btnDanger}`} onClick={() => setConfirmDelete(u)}>Удалить</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className={styles.modalOverlay} onClick={() => setShowCreate(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalTitle}>Новый пользователь</div>
            {cError && <div className={`${styles.alert} ${styles.alertError}`}>{cError}</div>}
            <form onSubmit={e => { void handleCreate(e); }}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Email *</label>
                <input type="email" className={styles.formInput} value={cEmail}
                  onChange={e => setCEmail(e.target.value)} required />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Пароль *</label>
                <input type="password" className={styles.formInput} value={cPassword}
                  onChange={e => setCPassword(e.target.value)} required />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Полное имя</label>
                <input type="text" className={styles.formInput} value={cFullName}
                  onChange={e => setCFullName(e.target.value)} />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Роль</label>
                <select className={styles.formSelect} value={cRole} onChange={e => setCRole(e.target.value)}>
                  <option value="employee">Сотрудник</option>
                  <option value="admin">Админ</option>
                  <option value="super_admin">Супер Админ</option>
                  <option value="guest">Гость</option>
                </select>
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => setShowCreate(false)}>Отмена</button>
                <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={cSaving}>
                  {cSaving ? 'Создание...' : 'Создать'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editUser && (
        <div className={styles.modalOverlay} onClick={() => setEditUser(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalTitle}>Редактировать: {editUser.full_name || editUser.email}</div>
            <form onSubmit={e => { void handleEdit(e); }}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Полное имя</label>
                <input type="text" className={styles.formInput} value={eFullName}
                  onChange={e => setEFullName(e.target.value)} />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Роль</label>
                <select className={styles.formSelect} value={eRole} onChange={e => setERole(e.target.value)}>
                  <option value="employee">Сотрудник</option>
                  <option value="admin">Админ</option>
                  <option value="super_admin">Супер Админ</option>
                  <option value="guest">Гость</option>
                </select>
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => setEditUser(null)}>Отмена</button>
                <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={eSaving}>
                  {eSaving ? 'Сохранение...' : 'Сохранить'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {confirmDelete && (
        <div className={styles.modalOverlay} onClick={() => setConfirmDelete(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalTitle}>Удалить пользователя?</div>
            <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', marginBottom: 16 }}>
              Пользователь &laquo;{confirmDelete.full_name || confirmDelete.email}&raquo; будет удалён навсегда.
            </p>
            <div className={styles.modalFooter}>
              <button className={`${styles.btn} ${styles.btnGhost}`} onClick={() => setConfirmDelete(null)}>Отмена</button>
              <button className={`${styles.btn} ${styles.btnDanger}`} onClick={() => { void handleDelete(); }}>Удалить</button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
