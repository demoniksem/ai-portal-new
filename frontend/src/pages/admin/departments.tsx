'use client';
export const dynamic = 'force-dynamic';
import React, { useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import {
  getDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  getUsers,
  getDepartmentMembers,
  addDepartmentMember,
  removeDepartmentMember,
  updateDepartmentMember,
  AdminDepartment,
  AdminUser,
  DeptMember,
} from '../../lib/admin-api';
import styles from '../../styles/admin.module.css';

type ModalMode = 'create' | 'edit' | null;

export default function AdminDepartmentsPage() {
  const [departments, setDepartments] = useState<AdminDepartment[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [members, setMembers] = useState<Record<string, DeptMember[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [editingDept, setEditingDept] = useState<AdminDepartment | null>(null);
  const [form, setForm] = useState({ name: '', description: '', headUserId: '' });
  const [saving, setSaving] = useState(false);

  // Members sub-panel
  const [expandedDept, setExpandedDept] = useState<string | null>(null);
  const [membersLoading, setMembersLoading] = useState<Record<string, boolean>>({});
  const [addMemberDept, setAddMemberDept] = useState<string | null>(null);
  const [addMemberUserId, setAddMemberUserId] = useState('');
  const [addMemberRole, setAddMemberRole] = useState<'department_head' | 'member'>('member');
  const [addMemberSaving, setAddMemberSaving] = useState(false);

  useEffect(() => {
    loadDepartments();
    loadUsers();
  }, []);

  function loadDepartments() {
    setLoading(true);
    setError('');
    getDepartments()
      .then(data => { setDepartments(data); setLoading(false); })
      .catch((e: unknown) => { setError((e as Error).message); setLoading(false); });
  }

  function loadUsers() {
    getUsers()
      .then(data => setUsers(data))
      .catch(() => {});
  }

  function loadMembers(deptId: string) {
    setMembersLoading(prev => ({ ...prev, [deptId]: true }));
    getDepartmentMembers(deptId)
      .then(data => setMembers(prev => ({ ...prev, [deptId]: data })))
      .catch(() => {})
      .finally(() => setMembersLoading(prev => ({ ...prev, [deptId]: false })));
  }

  function toggleMembers(deptId: string) {
    if (expandedDept === deptId) {
      setExpandedDept(null);
    } else {
      setExpandedDept(deptId);
      if (!members[deptId]) loadMembers(deptId);
    }
  }

  function openCreate() {
    setForm({ name: '', description: '', headUserId: '' });
    setEditingDept(null);
    setModalMode('create');
  }

  function openEdit(dept: AdminDepartment) {
    setForm({ name: dept.name, description: dept.description || '', headUserId: dept.head_user_id || '' });
    setEditingDept(dept);
    setModalMode('edit');
  }

  function closeModal() { setModalMode(null); setEditingDept(null); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (modalMode === 'create') {
        await createDepartment({
          name: form.name,
          description: form.description || undefined,
          headUserId: form.headUserId || undefined,
        });
        setSuccess('Подразделение создано');
      } else if (modalMode === 'edit' && editingDept) {
        await updateDepartment(editingDept.id, {
          name: form.name,
          description: form.description,
          headUserId: form.headUserId || null,
        });
        setSuccess('Подразделение обновлено');
      }
      closeModal();
      loadDepartments();
      setTimeout(() => setSuccess(''), 3000);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(dept: AdminDepartment) {
    if (!confirm(`Удалить подразделение «${dept.name}»?`)) return;
    try {
      await deleteDepartment(dept.id);
      setSuccess('Подразделение удалено');
      loadDepartments();
      setTimeout(() => setSuccess(''), 3000);
    } catch (e: unknown) {
      setError((e as Error).message);
    }
  }

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    if (!addMemberDept || !addMemberUserId) return;
    setAddMemberSaving(true);
    setError('');
    try {
      await addDepartmentMember(addMemberDept, addMemberUserId, addMemberRole);
      setSuccess('Участник добавлен');
      setAddMemberDept(null);
      setAddMemberUserId('');
      setAddMemberRole('member');
      loadMembers(addMemberDept);
      loadDepartments();
      setTimeout(() => setSuccess(''), 3000);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setAddMemberSaving(false);
    }
  }

  async function handleRemoveMember(deptId: string, userId: string) {
    if (!confirm('Удалить участника из подразделения?')) return;
    try {
      await removeDepartmentMember(deptId, userId);
      setSuccess('Участник удалён');
      loadMembers(deptId);
      loadDepartments();
      setTimeout(() => setSuccess(''), 3000);
    } catch (e: unknown) {
      setError((e as Error).message);
    }
  }

  async function handleUpdateMemberRole(deptId: string, userId: string, role: string) {
    try {
      await updateDepartmentMember(deptId, userId, role);
      loadMembers(deptId);
      loadDepartments();
    } catch (e: unknown) {
      setError((e as Error).message);
    }
  }

  // Users not yet in this department
  const membersInDept = (deptId: string) => new Set((members[deptId] || []).map(m => m.user_id));
  const availableUsers = users.filter(u => membersInDept(expandedDept || '').has(u.id) === false);

  return (
    <AdminLayout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 className={styles.pageTitle}>Подразделения</h1>
          <p className={styles.pageSubtitle}>Управление подразделениями, руководителями и участниками</p>
        </div>
        <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={openCreate}>+ Добавить</button>
      </div>

      {success && <div className={`${styles.alert} ${styles.alertSuccess}`}>{success}</div>}
      {error && <div className={`${styles.alert} ${styles.alertError}`}>{error}</div>}

      <div className={styles.tableWrapper}>
        {loading ? (
          <div className={styles.loadingContainer}>Загрузка...</div>
        ) : departments.length === 0 ? (
          <div className={styles.emptyState}>Подразделения не найдены</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Название</th>
                <th>Описание</th>
                <th>Руководитель</th>
                <th>Участников</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {departments.map(dept => (
                <React.Fragment key={dept.id}>
                  <tr>
                    <td style={{ fontWeight: 600, color: 'var(--color-text)' }}>{dept.name}</td>
                    <td style={{ color: 'var(--color-text-secondary)' }}>{dept.description || '—'}</td>
                    <td>
                      {dept.head_user_name ? (
                        <span className={`${styles.badge} ${styles.badgeHead}`}>{dept.head_user_name}</span>
                      ) : <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                    </td>
                    <td style={{ color: 'var(--color-text-secondary)' }}>{dept.member_count}</td>
                    <td>
                      <div className={styles.btnGroup}>
                        <button
                          className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}
                          onClick={() => toggleMembers(dept.id)}
                        >
                          {expandedDept === dept.id ? 'Скрыть' : 'Участники'}
                        </button>
                        <button className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`} onClick={() => openEdit(dept)}>Ред.</button>
                        <button className={`${styles.btn} ${styles.btnDanger} ${styles.btnSm}`} onClick={() => handleDelete(dept)}>Удал.</button>
                      </div>
                    </td>
                  </tr>

                  {/* Members sub-panel */}
                  {expandedDept === dept.id && (
                    <tr>
                      <td colSpan={5} style={{ padding: '0', background: 'var(--color-bg)' }}>
                        <div style={{ padding: '16px 20px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              Участники подразделения
                            </span>
                            <button
                              className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}
                              onClick={() => { setAddMemberDept(dept.id); setAddMemberUserId(''); }}
                            >
                              + Добавить участника
                            </button>
                          </div>

                          {membersLoading[dept.id] ? (
                            <div style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Загрузка...</div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              {(members[dept.id] || []).map(member => (
                                <div key={member.user_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', background: 'var(--color-surface)', borderRadius: 7, border: '1px solid var(--color-border)' }}>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>{member.full_name || member.email}</div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{member.email}</div>
                                  </div>
                                  <select
                                    value={member.role}
                                    onChange={e => handleUpdateMemberRole(dept.id, member.user_id, e.target.value)}
                                    style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--color-border)', fontSize: '0.8rem', background: 'var(--color-bg)', color: 'var(--color-text)' }}
                                  >
                                    <option value="member">Участник</option>
                                    <option value="department_head">Руководитель</option>
                                  </select>
                                  <button
                                    className={`${styles.btn} ${styles.btnDanger} ${styles.btnSm}`}
                                    onClick={() => handleRemoveMember(dept.id, member.user_id)}
                                  >
                                    Удалить
                                  </button>
                                </div>
                              ))}
                              {(members[dept.id] || []).length === 0 && (
                                <div style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Нет участников</div>
                              )}
                            </div>
                          )}

                          {/* Add member inline form */}
                          {addMemberDept === dept.id && (
                            <form onSubmit={handleAddMember} style={{ display: 'flex', gap: 10, marginTop: 12, alignItems: 'center' }}>
                              <select
                                value={addMemberUserId}
                                onChange={e => setAddMemberUserId(e.target.value)}
                                required
                                style={{ flex: 1, padding: '7px 10px', borderRadius: 7, border: '1px solid var(--color-border)', fontSize: '0.875rem', background: 'var(--color-bg)', color: 'var(--color-text)' }}
                              >
                                <option value="">Выберите пользователя...</option>
                                {availableUsers.map(u => (
                                  <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
                                ))}
                              </select>
                              <select
                                value={addMemberRole}
                                onChange={e => setAddMemberRole(e.target.value as 'department_head' | 'member')}
                                style={{ padding: '7px 10px', borderRadius: 7, border: '1px solid var(--color-border)', fontSize: '0.875rem', background: 'var(--color-bg)', color: 'var(--color-text)' }}
                              >
                                <option value="member">Участник</option>
                                <option value="department_head">Руководитель</option>
                              </select>
                              <button type="submit" className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`} disabled={addMemberSaving}>
                                {addMemberSaving ? '...' : 'Добавить'}
                              </button>
                              <button type="button" className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`} onClick={() => setAddMemberDept(null)}>Отмена</button>
                            </form>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modalMode && (
        <div className={styles.modalOverlay} onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className={styles.modal}>
            <h2 className={styles.modalTitle}>
              {modalMode === 'create' ? 'Новое подразделение' : 'Редактирование подразделения'}
            </h2>
            <form onSubmit={handleSubmit}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Название *</label>
                <input className={styles.formInput} type="text" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Описание</label>
                <textarea className={styles.formTextarea} value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Руководитель</label>
                <select
                  className={styles.formSelect}
                  value={form.headUserId}
                  onChange={e => setForm(f => ({ ...f, headUserId: e.target.value }))}
                >
                  <option value="">Не назначен</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
                  ))}
                </select>
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={closeModal}>Отмена</button>
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
