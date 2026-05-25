/** @type {import('tailwindcss').Config} */
module.exports = {
  // Dark mode is driven by the existing ThemeProvider, which sets
  // data-theme="dark" on <html>. This keeps the theme toggle working.
  darkMode: ['selector', '[data-theme="dark"]'],
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      // Semantic colors map onto the existing CSS-variable design system so
      // light/dark flips happen automatically and legacy pages stay in sync.
      colors: {
        bg: 'var(--color-background)',
        'bg-alt': 'var(--color-background-alt)',
        surface: 'var(--color-surface)',
        'surface-hover': 'var(--color-surface-hover)',
        line: 'var(--color-border)',
        'line-strong': 'var(--color-border-strong)',
        fg: 'var(--color-text)',
        'fg-secondary': 'var(--color-text-secondary)',
        'fg-muted': 'var(--color-text-muted)',
        // Brand + semantic colors are fixed hex (constant across themes) so
        // Tailwind opacity modifiers like bg-accent/20 work correctly.
        accent: {
          DEFAULT: '#2563eb',
          hover: '#1d4ed8',
          active: '#1e40af',
          light: 'var(--color-primary-light)',
        },
        success: '#16a34a',
        warning: '#d97706',
        danger: '#dc2626',
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      boxShadow: {
        // Wide, soft "diffusion" shadows tinted to the background — no glows.
        diffusion: '0 20px 40px -18px rgba(15, 23, 42, 0.10)',
        'diffusion-lg': '0 32px 64px -24px rgba(15, 23, 42, 0.16)',
        'inset-hair': 'inset 0 1px 0 rgba(255,255,255,0.06)',
      },
      keyframes: {
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        float: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(0.9)', opacity: '0.7' },
          '100%': { transform: 'scale(2.2)', opacity: '0' },
        },
      },
      animation: {
        shimmer: 'shimmer 2.2s infinite',
        float: 'float 7s ease-in-out infinite',
        'pulse-ring': 'pulse-ring 2.4s cubic-bezier(0.16,1,0.3,1) infinite',
      },
    },
  },
  plugins: [],
};
