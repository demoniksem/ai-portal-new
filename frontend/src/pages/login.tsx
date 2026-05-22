import { useState, FormEvent } from 'react';
import { motion } from 'framer-motion';
import { Envelope, Lock, ArrowRight, ShieldCheck, WarningCircle } from '@phosphor-icons/react';
import ThemeToggle from '../components/ThemeToggle';
import { Logo } from '../components/ui/Logo';
import { MotionButton } from '../components/ui/MotionButton';
import { BrandPanel } from '../components/ui/BrandPanel';

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
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка входа');
      localStorage.setItem('token', data.token);
      window.location.href = '/';
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full rounded-xl border border-line bg-surface py-2.5 pl-10 pr-3 text-[0.95rem] text-fg ' +
    'placeholder:text-fg-muted outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/15';

  return (
    <div className="grid min-h-[100dvh] grid-cols-1 bg-bg lg:grid-cols-[1fr_1.05fr]">
      {/* Form side */}
      <div className="flex flex-col px-6 py-8 sm:px-10 lg:px-16">
        <header className="flex items-center justify-between">
          <Logo />
          <ThemeToggle />
        </header>

        <div className="flex flex-1 items-center py-10">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 120, damping: 20 }}
            className="w-full max-w-[380px]"
          >
            <p className="text-sm font-medium text-accent">С возвращением</p>
            <h1 className="mt-2 text-3xl font-semibold leading-none tracking-tight text-fg sm:text-4xl">
              Вход в портал
            </h1>
            <p className="mt-3 max-w-[34ch] text-[0.95rem] leading-relaxed text-fg-secondary">
              Единая среда: документация, доски задач и рабочие процессы вашей команды.
            </p>

            <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <label htmlFor="email" className="text-sm font-medium text-fg">
                  Email
                </label>
                <div className="relative">
                  <Envelope
                    size={18}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted"
                  />
                  <input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@portal.com"
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="password" className="text-sm font-medium text-fg">
                  Пароль
                </label>
                <div className="relative">
                  <Lock
                    size={18}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted"
                  />
                  <input
                    id="password"
                    type="password"
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className={inputClass}
                  />
                </div>
              </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2.5 text-sm text-danger"
                  role="alert"
                >
                  <WarningCircle size={16} weight="fill" className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </motion.div>
              )}

              <MotionButton type="submit" loading={loading} fullWidth className="mt-1">
                {loading ? 'Вход…' : 'Войти'}
                {!loading && <ArrowRight size={16} weight="bold" />}
              </MotionButton>
            </form>

            <div className="mt-6 flex items-center gap-2.5 rounded-xl border border-line bg-surface px-3.5 py-3 text-[0.82rem] text-fg-secondary">
              <ShieldCheck size={16} weight="fill" className="shrink-0 text-accent" />
              <span>
                Демо-доступ:{' '}
                <span className="font-mono text-fg">admin@portal.com</span> /{' '}
                <span className="font-mono text-fg">admin123</span>
              </span>
            </div>
          </motion.div>
        </div>

        <footer className="text-xs text-fg-muted">AI Portal — корпоративный superapp</footer>
      </div>

      {/* Brand side */}
      <BrandPanel />
    </div>
  );
}
