/* ============================================================
   AI Portal Design System — JS Tokens Export
   Version: 1.0.0
   ============================================================ */

/**
 * Design tokens as a plain JS object — usable in JS/TS files
 * for dynamic styling,兵团 token validation, or programmatic access.
 *
 * Usage:
 *   import { tokens } from './tokens';
 *   console.log(tokens.color.primary);
 */

/** @type {Record<string, unknown>} */
export const tokens = {
  // ── Colors ───────────────────────────────────────────────
  color: {
    primary: {
      DEFAULT: 'var(--color-primary)',
      hover: 'var(--color-primary-hover)',
      active: 'var(--color-primary-active)',
      light: 'var(--color-primary-light)',
      dark: 'var(--color-primary-dark)',
      rgb: 'var(--color-primary-rgb)',
    },
    secondary: {
      DEFAULT: 'var(--color-secondary)',
      hover: 'var(--color-secondary-hover)',
      active: 'var(--color-secondary-active)',
      light: 'var(--color-secondary-light)',
      dark: 'var(--color-secondary-dark)',
    },
    accent: {
      DEFAULT: 'var(--color-accent)',
      hover: 'var(--color-accent-hover)',
      active: 'var(--color-accent-active)',
      light: 'var(--color-accent-light)',
      dark: 'var(--color-accent-dark)',
    },
    background: {
      DEFAULT: 'var(--color-background)',
      alt: 'var(--color-background-alt)',
    },
    surface: {
      DEFAULT: 'var(--color-surface)',
      hover: 'var(--color-surface-hover)',
      raised: 'var(--color-surface-raised)',
    },
    text: {
      DEFAULT: 'var(--color-text)',
      secondary: 'var(--color-text-secondary)',
      muted: 'var(--color-text-muted)',
      inverted: 'var(--color-text-inverted)',
      link: 'var(--color-text-link)',
      'link-hover': 'var(--color-text-link-hover)',
    },
    border: {
      DEFAULT: 'var(--color-border)',
      strong: 'var(--color-border-strong)',
      focus: 'var(--color-border-focus)',
    },
    sidebar: {
      bg: 'var(--color-sidebar-bg)',
      border: 'var(--color-sidebar-border)',
    },
    activeNav: 'var(--color-active-nav)',
    success: {
      DEFAULT: 'var(--color-success)',
      hover: 'var(--color-success-hover)',
      active: 'var(--color-success-active)',
      light: 'var(--color-success-light)',
      dark: 'var(--color-success-dark)',
    },
    warning: {
      DEFAULT: 'var(--color-warning)',
      hover: 'var(--color-warning-hover)',
      active: 'var(--color-warning-active)',
      light: 'var(--color-warning-light)',
      dark: 'var(--color-warning-dark)',
    },
    error: {
      DEFAULT: 'var(--color-error)',
      hover: 'var(--color-error-hover)',
      active: 'var(--color-error-active)',
      light: 'var(--color-error-light)',
      dark: 'var(--color-error-dark)',
    },
    info: {
      DEFAULT: 'var(--color-info)',
      hover: 'var(--color-info-hover)',
      light: 'var(--color-info-light)',
      dark: 'var(--color-info-dark)',
    },
    kanban: {
      columnBacklog: 'var(--color-column-backlog)',
      columnTodo: 'var(--color-column-todo)',
      columnInprogress: 'var(--color-column-inprogress)',
      columnReview: 'var(--color-column-review)',
      columnDone: 'var(--color-column-done)',
      columnBlocked: 'var(--color-column-blocked)',
    },
    priority: {
      critical: 'var(--color-priority-critical)',
      high: 'var(--color-priority-high)',
      medium: 'var(--color-priority-medium)',
      low: 'var(--color-priority-low)',
    },
    status: {
      done: { bg: 'var(--color-status-done-bg)', text: 'var(--color-status-done-text)' },
      inprogress: { bg: 'var(--color-status-inprogress-bg)', text: 'var(--color-status-inprogress-text)' },
      blocked: { bg: 'var(--color-status-blocked-bg)', text: 'var(--color-status-blocked-text)' },
      review: { bg: 'var(--color-status-review-bg)', text: 'var(--color-status-review-text)' },
      todo: { bg: 'var(--color-status-todo-bg)', text: 'var(--color-status-todo-text)' },
      backlog: { bg: 'var(--color-status-backlog-bg)', text: 'var(--color-status-backlog-text)' },
    },
    panel: {
      info: { bg: 'var(--color-panel-info-bg)', border: 'var(--color-panel-info-border)', text: 'var(--color-panel-info-text)' },
      tip: { bg: 'var(--color-panel-tip-bg)', border: 'var(--color-panel-tip-border)', text: 'var(--color-panel-tip-text)' },
      note: { bg: 'var(--color-panel-note-bg)', border: 'var(--color-panel-note-border)', text: 'var(--color-panel-note-text)' },
      warning: { bg: 'var(--color-panel-warning-bg)', border: 'var(--color-panel-warning-border)', text: 'var(--color-panel-warning-text)' },
    },
  },

  // ── Typography ────────────────────────────────────────────
  font: {
    heading: 'var(--font-heading)',
    body: 'var(--font-body)',
    mono: 'var(--font-mono)',
  },
  text: {
    xs: 'var(--text-xs)',
    sm: 'var(--text-sm)',
    base: 'var(--text-base)',
    lg: 'var(--text-lg)',
    xl: 'var(--text-xl)',
    '2xl': 'var(--text-2xl)',
    '3xl': 'var(--text-3xl)',
    '4xl': 'var(--text-4xl)',
  },
  leading: {
    tight: 'var(--leading-tight)',
    normal: 'var(--leading-normal)',
    relaxed: 'var(--leading-relaxed)',
  },
  weight: {
    regular: 'var(--weight-regular)',
    medium: 'var(--weight-medium)',
    semibold: 'var(--weight-semibold)',
    bold: 'var(--weight-bold)',
  },

  // ── Spacing ───────────────────────────────────────────────
  space: {
    '0': 'var(--space-0)',
    '1': 'var(--space-1)',
    '2': 'var(--space-2)',
    '3': 'var(--space-3)',
    '4': 'var(--space-4)',
    '5': 'var(--space-5)',
    '6': 'var(--space-6)',
    '8': 'var(--space-8)',
    '10': 'var(--space-10)',
    '12': 'var(--space-12)',
    '16': 'var(--space-16)',
  },

  // ── Border Radius ─────────────────────────────────────────
  radius: {
    none: '0',
    sm: 'var(--radius-sm)',
    md: 'var(--radius-md)',
    lg: 'var(--radius-lg)',
    xl: 'var(--radius-xl)',
    '2xl': 'var(--radius-2xl)',
    full: 'var(--radius-full)',
  },

  // ── Shadows ───────────────────────────────────────────────
  shadow: {
    xs: 'var(--shadow-xs)',
    sm: 'var(--shadow-sm)',
    md: 'var(--shadow-md)',
    lg: 'var(--shadow-lg)',
    xl: 'var(--shadow-xl)',
    '2xl': 'var(--shadow-2xl)',
    inner: 'var(--shadow-inner)',
    card: 'var(--shadow-card)',
    'card-hover': 'var(--shadow-card-hover)',
    modal: 'var(--shadow-modal)',
    tooltip: 'var(--shadow-tooltip)',
    focus: 'var(--shadow-focus)',
    'focus-error': 'var(--shadow-focus-error)',
    'focus-success': 'var(--shadow-focus-success)',
  },

  // ── Transitions ───────────────────────────────────────────
  transition: {
    fast: 'var(--transition-fast)',
    base: 'var(--transition-base)',
    smooth: 'var(--transition-smooth)',
    slow: 'var(--transition-slow)',
    spring: 'var(--transition-spring)',
  },

  // ── Layout ───────────────────────────────────────────────
  layout: {
    sidebarWidth: 'var(--sidebar-width)',
    sidebarCollapsedWidth: 'var(--sidebar-collapsed-width)',
    headerHeight: 'var(--header-height)',
    contentMaxWidth: 'var(--content-max-width)',
  },

  // ── Z-index ──────────────────────────────────────────────
  z: {
    base: 'var(--z-base)',
    raised: 'var(--z-raised)',
    dropdown: 'var(--z-dropdown)',
    sticky: 'var(--z-sticky)',
    overlay: 'var(--z-overlay)',
    modal: 'var(--z-modal)',
    popover: 'var(--z-popover)',
    tooltip: 'var(--z-tooltip)',
    toast: 'var(--z-toast)',
  },

  // ── Kanban ───────────────────────────────────────────────
  kanban: {
    columnWidth: 'var(--kanban-column-width)',
    columnMinHeight: 'var(--kanban-column-min-height)',
    cardGap: 'var(--kanban-card-gap)',
    columnGap: 'var(--kanban-column-gap)',
    swimlaneHeight: 'var(--kanban-swimlane-height)',
    wipLimitWarning: 'var(--kanban-wip-limit-warning)',
  },
};

// ── Status → color map (useful for dynamic badge rendering) ──────────────────
export const statusColorMap = {
  done: { bg: 'var(--color-status-done-bg)', text: 'var(--color-status-done-text)', label: 'Выполнено' },
  in_progress: { bg: 'var(--color-status-inprogress-bg)', text: 'var(--color-status-inprogress-text)', label: 'В работе' },
  blocked: { bg: 'var(--color-status-blocked-bg)', text: 'var(--color-status-blocked-text)', label: 'Заблокировано' },
  review: { bg: 'var(--color-status-review-bg)', text: 'var(--color-status-review-text)', label: 'На проверке' },
  todo: { bg: 'var(--color-status-todo-bg)', text: 'var(--color-status-todo-text)', label: 'К выполнению' },
  backlog: { bg: 'var(--color-status-backlog-bg)', text: 'var(--color-status-backlog-text)', label: 'Бэклог' },
} as const;

// ── Priority → color map ──────────────────────────────────────────────────────
export const priorityColorMap = {
  critical: { color: 'var(--color-priority-critical)', label: 'Критический' },
  high: { color: 'var(--color-priority-high)', label: 'Высокий' },
  medium: { color: 'var(--color-priority-medium)', label: 'Средний' },
  low: { color: 'var(--color-priority-low)', label: 'Низкий' },
} as const;

// ── Column → default accent color map ───────────────────────────────────────
export const columnColorMap = {
  backlog: 'var(--color-column-backlog)',
  todo: 'var(--color-column-todo)',
  in_progress: 'var(--color-column-inprogress)',
  review: 'var(--color-column-review)',
  done: 'var(--color-column-done)',
  blocked: 'var(--color-column-blocked)',
} as const;
