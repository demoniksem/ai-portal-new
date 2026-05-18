'use client';
export const dynamic = 'force-dynamic';
import React, { useState, useEffect, FormEvent } from 'react';
import AdminLayout from '../../../components/admin/AdminLayout';
import { getBrand, updateBrand, BrandSettings } from '../../../lib/admin-api';
import styles from '../../../styles/admin.module.css';

export default function BrandPage() {
  const [brand, setBrand] = useState<BrandSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const [companyName, setCompanyName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#6366f1');
  const [accentColor, setAccentColor] = useState('#818cf8');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const data = await getBrand();
        setBrand(data);
        setCompanyName(data.companyName || '');
        setLogoUrl(data.logoUrl || '');
        setPrimaryColor(data.primaryColor || '#6366f1');
        setAccentColor(data.accentColor || '#818cf8');
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSaved(false);
    setSaving(true);
    try {
      const data = await updateBrand({
        companyName,
        logoUrl: logoUrl || undefined,
        primaryColor,
        accentColor,
      });
      setBrand(data);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <AdminLayout><div className={styles.loadingContainer}>Загрузка...</div></AdminLayout>;

  return (
    <AdminLayout>
      <div style={{ marginBottom: 24 }}>
        <h1 className={styles.pageTitle}>Брендинг</h1>
        <p className={styles.pageSubtitle}>Настройка внешнего вида портала компании</p>
      </div>

      <form onSubmit={e => { void handleSave(e); }}>
        {/* Company Info */}
        <div className={styles.section} style={{ marginBottom: 24 }}>
          <h2 className={styles.sectionTitle}>Компания</h2>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Название компании</label>
            <input
              type="text"
              className={styles.formInput}
              value={companyName}
              onChange={e => { setCompanyName(e.target.value); setSaved(false); }}
              placeholder="Моя компания"
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>URL логотипа</label>
            <input
              type="text"
              className={styles.formInput}
              value={logoUrl}
              onChange={e => { setLogoUrl(e.target.value); setSaved(false); }}
              placeholder="https://example.com/logo.png"
            />
          </div>
        </div>

        {/* Colors */}
        <div className={styles.section} style={{ marginBottom: 24 }}>
          <h2 className={styles.sectionTitle}>Цвета</h2>
          <div className={styles.colorRow}>
            <div className={styles.formGroup} style={{ flex: 1, marginBottom: 0 }}>
              <label className={styles.formLabel}>Основной цвет</label>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input
                  type="color"
                  className={styles.colorInput}
                  value={primaryColor}
                  onChange={e => { setPrimaryColor(e.target.value); setSaved(false); }}
                />
                <span className={styles.colorHex}>{primaryColor}</span>
              </div>
            </div>
            <div className={styles.formGroup} style={{ flex: 1, marginBottom: 0 }}>
              <label className={styles.formLabel}>Акцентный цвет</label>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input
                  type="color"
                  className={styles.colorInput}
                  value={accentColor}
                  onChange={e => { setAccentColor(e.target.value); setSaved(false); }}
                />
                <span className={styles.colorHex}>{accentColor}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className={styles.section} style={{ marginBottom: 24 }}>
          <h2 className={styles.sectionTitle}>Предпросмотр</h2>
          <div style={{
            background: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
            borderRadius: 10,
            padding: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 16,
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: 10,
              background: primaryColor + '22',
              borderLeft: `3px solid ${primaryColor}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.4rem', flexShrink: 0,
              overflow: 'hidden',
            }}>
              {logoUrl
                ? <img src={logoUrl} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }} />
                : <span>🏢</span>
              }
            </div>
              <div style={{ flex: 1 }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: primaryColor }}>
                {companyName || 'Название компании'}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>ai-portal.company</div>
            </div>
            <div style={{
              background: primaryColor,
              color: '#fff',
              padding: '8px 16px',
              borderRadius: 7,
              fontSize: '0.85rem',
              fontWeight: 600,
            }}>
              Карточка
            </div>
          </div>
        </div>

        {error && <div className={`${styles.alert} ${styles.alertError}`}>{error}</div>}
        {saved && <div className={`${styles.alert} ${styles.alertSuccess}`}>✓ Настройки сохранены!</div>}

        <div className={styles.btnGroup}>
          <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={saving}>
            {saving ? 'Сохранение...' : '💾 Сохранить'}
          </button>
        </div>
      </form>
    </AdminLayout>
  );
}
