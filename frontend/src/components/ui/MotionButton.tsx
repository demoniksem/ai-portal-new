import { type ReactNode } from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { CircleNotch } from '@phosphor-icons/react';

type Variant = 'primary' | 'ghost' | 'subtle';

type MotionButtonProps = Omit<HTMLMotionProps<'button'>, 'children'> & {
  loading?: boolean;
  variant?: Variant;
  fullWidth?: boolean;
  children?: ReactNode;
};

const VARIANT: Record<Variant, string> = {
  primary: 'bg-accent text-white hover:bg-accent-hover',
  ghost: 'bg-transparent text-fg-secondary hover:bg-surface-hover',
  subtle: 'bg-surface-hover text-fg hover:bg-line',
};

export function MotionButton({
  loading = false,
  disabled,
  variant = 'primary',
  fullWidth = false,
  className = '',
  children,
  ...rest
}: MotionButtonProps) {
  const inert = disabled || loading;
  return (
    <motion.button
      whileHover={inert ? undefined : { y: -1 }}
      whileTap={inert ? undefined : { scale: 0.98, y: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      disabled={inert}
      className={[
        'relative inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5',
        'text-sm font-semibold tracking-tight select-none transition-colors',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/20',
        'disabled:cursor-not-allowed disabled:opacity-60',
        VARIANT[variant],
        fullWidth ? 'w-full' : '',
        className,
      ].join(' ')}
      {...rest}
    >
      {loading && <CircleNotch size={16} weight="bold" className="animate-spin" />}
      {children}
    </motion.button>
  );
}
