'use client';
export const dynamic = 'force-dynamic';
import React, { useState, useEffect, useCallback, FormEvent } from 'react';
import AdminLayout from '../../../components/admin/AdminLayout';
import {
  getDepartments, createDepartment, updateDepartment, deleteDepartment,
  getDepartmentMembers, addDepartmentMember, removeDepartmentMember, updateDepartmentMember,
  AdminDepartment, DeptMember,
} from '../../../lib/admin-api';
import styles from '../../../styles/admin.module.css';

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<AdminDepartment[]>([]);
  const [members, setMembers] = useState<Record<string, DeptMember[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editDept, setEditDept] = useState<AdminDepartment | null>(null);
  const [deptMembers, setDeptMembers] = useState<DeptMember[]>([]);
  const [viewMembersDept, setViewMembersDept] = useState<string | null>(null);

  const [cName, setCName] = useState('');
  const [cDesc, setCDesc] = useState('');
  const [cHead, setCHead] = useState('');
  const [cSaving, setCSaving] = useState(false);
  const [cError, setCError] = useState('');

  const [eName, setEName] = useState('');
  const [eDesc, setEDesc] = useState('');
  const [eHead, setEHead] = useState('');
  const [eSaving, setESaving] = useState(false);

  const [addUserId, setAddUserId] = useState('');
  const [addRole, setAddRole] = useState('member');
  const [addSaving, setAddSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getDepartments();
      setDepartments(data);
      const m: Record<string, DeptMember[]> = {};
      for (const d of data) {
        try {
          m[d.id] = await getDepartmentMembers(d.id);
        } catch { m[d.id] = []; }
      }
      setMembers(m);
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
      await createDepartment({ name: cName, description: cDesc, headUserId: cHead || undefined });
      setShowCreate(false);
      setCName(''); setCDesc(''); setCHead('');
      await load();
    } catch (err) {
      setCError((err as Error).message);
    } finally {
      setCSaving(false);
    }
  }

  function openEdit(d: AdminDepartment) {
    setEditDept(d);
    setEName(d.name);
    setEDesc(d.description || '');
    setEHead(d.head_user_id || '');
  }

  async function handleEdit(e: FormEvent) {
    e.preventDefault();
    if (!editDept) return;
    setESaving(true);
    try {
      await updateDepartment(editDept.id, { name: eName, description: eDesc, headUserId: eHead || undefined });
      setEditDept(null);
      await load();
    } catch { /* ok */ } finally {
      setESaving(false);
    }
  }

  async function handleDelete(d: AdminDepartment) {
    if (!confirm(`Удалить подразделение "${d.name}"?`)) return;
    try {
      await deleteDepartment(d.id);
      await load();
    } catch { /* ok */ }
  }

  async function openMembersView(d: AdminDepartment) {
    setViewMembersDept(d.id);
    setDeptMembers(members[d.id] || []);
    setAddUserId('');
    setAddRole('member');
  }

  async function handleAddMember() {
    if (!viewMembersDept || !addUserId) return;
    setAddSaving(true);
    try {
      await addDepartmentMember(viewMembersDept, addUserId, addRole);
      const updated = await getDepartmentMembers(viewMembersDept);
      setDeptMembers(updated);
      setMembers(prev => ({ ...prev, [viewMembersDept]: updated }));
      setAddUserId('');
    } catch { /* ok */ } finally {
      setAddSaving(false);
    }
  }

  async function handleRemoveMember(userId: string) {
    if (!viewMembersDept) return;
    try {
      await removeDepartmentMember(viewMembersDept, userId);
      const updated = await getDepartmentMembers(viewMembersDept);
      setDeptMembers(updated);
      setMembers(prev => ({ ...prev, [viewMembersDept]: updated }));
    } catch { /* ok */ }
  }

  async function handleUpdateMemberRole(userId: string, role: string) {
    if (!viewMembersDept) return;
    try {
      await updateDepartmentMember(viewMembersDept, userId, role);
      const updated = await getDepartmentMembers(viewMembersDept);
      setDeptMembers(updated);
      setMembers(prev => ({ ...prev, [viewMembersDept]: updated }));
    } catch { /* ok */ }
  }

  return (
    <AdminLayout>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className={styles.pageTitle}>Подразделения</h1>
          <p className={styles.pageSubtitle}>{departments.length} подразделений</p>
        </div>
        <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setShowCreate(true)}>
          + Новое подразделение
        </button>
      </div>

      {loading && <div className={styles.loadingContainer}>Загрузка...</div>}
      {error && <div className={`${styles.alert} ${styles.alertError}`}>{error}</div>}
      {!loading && departments.length === 0 && <div className={styles.emptyState}>Нет подразделений</div>}

      {!loading && departments.map(dept => (
        <div key={dept.id} className={styles.section} style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>{dept.name}</h2>
                {dept.head_user_name && (
                  <span className={`${styles.badge} ${styles.badgeHead}`}>★ {dept.head_user_name}</span>
                )}
              </div>
              {dept.description && (
                <p style={{ margin: '0 0 8px', fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                  {dept.description}
                </p>
              )}
              <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                {dept.member_count || 0} участников · Создано {formatDate(dept.created_at)}
              </div>
              {members[dept.id] && members[dept.id].length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                  {members[dept.id].slice(0, 6).map(m => (
                    <span key={m.user_id} className={`${styles.badge} ${m.role === 'department_head' ? styles.badgeHead : styles.badgeMember}`}>
                      {m.full_name || m.email}
                      {m.role === 'department_head' && ' ★'}
                    </span>
                  ))}
                  {members[dept.id].length > 6 && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', alignSelf: 'center' }}>
                      +{members[dept.id].length - 6} more
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className={styles.btnGroup}>
              <button className={`${styles.btn} ${styles.btnSm} ${styles.btnGhost}`} onClick={() => openMembersView(dept)}>Участники</button>
              <button className={`${styles.btn} ${styles.btnSm} ${styles.btnGhost}`} onClick={() => openEdit(dept)}>Изменить</button>
              <button className={`${styles.btn} ${styles.btnSm} ${styles.btnDanger}`} onClick={() => handleDelete(dept)}>Удалить</button>
            </div>
          </div>
        </div>
      ))}

      {/* Create Modal */}
      {showCreate && (
        <div className={styles.modalOverlay} onClick={() => setShowCreate(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalTitle}>Новое подразделение</div>
            {cError && <div className={`${styles.alert} ${styles.alertError}`}>{cError}</div>}
            <form onSubmit={e => { void handleCreate(e); }}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Название *</label>
                <input type="text" className={styles.formInput} value={cName}
                  onChange={e => setCName(e.target.value)} required />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Описание</label>
                <input type="text" className={styles.formInput} value={cDesc}
                  onChange={e => setCDesc(e.target.value)} />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Руководитель (UUID пользователя)</label>
                <input type="text" className={styles.formInput} value={cHead}
                  onChange={e => setCHead(e.target.value)} placeholder="Оставьте пустым, если нет" />
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
      {editDept && (
        <div className={styles.modalOverlay} onClick={() => setEditDept(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalTitle}>Редактировать подразделение</div>
            <form onSubmit={e => { void handleEdit(e); }}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Название *</label>
                <input type="text" className={styles.formInput} value={eName}
                  onChange={e => setEName(e.target.value)} required />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Описание</label>
                <input type="text" className={styles.formInput} value={eDesc}
                  onChange={e => setEDesc(e.target.value)} />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Руководитель (UUID пользователя)</label>
                <input type="text" className={styles.formInput} value={eHead}
                  onChange={e => setEHead(e.target.value)} placeholder="Оставьте пустым, чтобы убрать" />
              </div>
              <div className={styles.modalFooter}>
                <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => setEditDept(null)}>Отмена</button>
                <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={eSaving}>
                  {eSaving ? 'Сохранение...' : 'Сохранить'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Members Modal */}
      {viewMembersDept && (
        <div className={styles.modalOverlay} onClick={() => setViewMembersDept(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalTitle}>
              Участники: {departments.find(d => d.id === viewMembersDept)?.name}
            </div>
            <div className={styles.tableWrapper} style={{ marginBottom: 16 }}>
              <table className={styles.table}>
                <thead>
                  <tr><th>Пользователь</th><th>Роль</th><th>Действия</th></tr>
                </thead>
                <tbody>
                  {deptMembers.map(m => (
                    <tr key={m.user_id}>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{m.full_name || '—'}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>{m.email}</div>
                      </td>
                      <td>
                        <select
                          className={styles.formSelect}
                          value={m.role}
                          onChange={e => { void handleUpdateMemberRole(m.user_id, e.target.value); }}
                          style={{ fontSize: '0.8rem', padding: '4px 8px' }}
                        >
                          <option value="member">Участник</option>
                          <option value="department_head">Руководитель ★</option>
                        </select>
                      </td>
                      <td>
                        <button className={`${styles.btn} ${styles.btnSm} ${styles.btnDanger}`}
                          onClick={() => { void handleRemoveMember(m.user_id); }}>Удалить</button>
                      </td>
                    </tr>
                  ))}
                  {deptMembers.length === 0 && (
                    <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 24 }}>Нет участников</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div className={styles.formGroup} style={{ flex: 1, marginBottom: 0 }}>
                <label className={styles.formLabel}>UUID пользователя</label>
                <input type="text" className={styles.formInput} value={addUserId}
                  onChange={e => setAddUserId(e.target.value)} placeholder="Вставьте UUID пользователя" />
              </div>
              <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                <label className={styles.formLabel}>Роль</label>
                <select className={styles.formSelect} value={addRole} onChange={e => setAddRole(e.target.value)}>
                  <option value="member">Участник</option>
                  <option value="department_head">Руководитель ★</option>
                </select>
              </div>
              <button className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={() => { void handleAddMember(); }} disabled={addSaving || !addUserId}>
                {addSaving ? '...' : 'Добавить'}
              </button>
            </div>
            <div className={styles.modalFooter}>
              <button className={`${styles.btn} ${styles.btnGhost}`} onClick={() => setViewMembersDept(null)}>Закрыть</button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
