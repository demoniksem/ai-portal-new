import { useState, FormEvent } from 'react'
import ThemeToggle from '../components/ThemeToggle';

const API = typeof window !== 'undefined' ? 'http://' + window.location.hostname + ':8081' : '';

export default function Login() {
  const [email, setEmail] = useState('admin@portal.com');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(API + '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка входа');
      localStorage.setItem('token', data.token);
      window.location.href = '/';
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'var(--color-background, #fafbfc)', padding: 20
    }}>
      <div style={{
        background: 'var(--color-surface, #fff)', borderRadius: 12, padding: '32px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)', width: '100%', maxWidth: 380
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text, #1a1a2e)', margin: 0 }}>🚀 AI Portal</h1>
          <ThemeToggle />
        </div>
        <p style={{ color: 'var(--color-text-secondary, #6b7280)', marginBottom: 24, fontSize: '0.95rem' }}>Войдите в свой аккаунт</p>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-text, #374151)', marginBottom: 4 }}>Email</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="admin@portal.com" required
              className="micro-input"
              style={{
                width: '100%', padding: '8px 12px', border: '1px solid var(--color-text-muted, #e5e7eb)',
                borderRadius: 6, fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box',
                background: 'var(--color-background-alt, #fff)', color: 'var(--color-text, #1a1a2e)'
              }}
            />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-text, #374151)', marginBottom: 4 }}>Пароль</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" required
              className="micro-input"
              style={{
                width: '100%', padding: '8px 12px', border: '1px solid var(--color-text-muted, #e5e7eb)',
                borderRadius: 6, fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box',
                background: 'var(--color-background-alt, #fff)', color: 'var(--color-text, #1a1a2e)'
              }}
            />
          </div>
          <button type="submit" disabled={loading}
            className="micro-btn"
            style={{
              width: '100%', padding: '10px 16px', background: 'var(--color-primary, #667eea)', color: '#fff',
              border: 'none', borderRadius: 7, cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '0.95rem', fontWeight: 600, opacity: loading ? 0.6 : 1
            }}>
            {loading ? 'Вход...' : 'Войти'}
          </button>
          {error && (
            <div style={{
              marginTop: 12, padding: '10px 12px', background: 'var(--color-error-light, #fef2f2)',
              border: '1px solid var(--color-error, #fecaca)', borderRadius: 6,
              color: 'var(--color-error, #dc2626)', fontSize: '0.85rem'
            }}>
              {error}
            </div>
          )}
        </form>
        <div style={{ marginTop: 16, padding: 10, background: 'var(--color-primary-light, #f0f0ff)', borderRadius: 6, fontSize: '0.82rem', color: 'var(--color-text-secondary, #6b7280)' }}>
          <strong>Прототип:</strong> admin@portal.com / admin123
        </div>
      </div>
    </div>
  );
}
