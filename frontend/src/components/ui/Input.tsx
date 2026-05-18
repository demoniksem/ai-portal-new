import React from 'react';
import styles from './Input.module.css';

export type InputSize = 'sm' | 'md' | 'lg';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  hint?: string;
  error?: string;
  size?: InputSize;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      hint,
      error,
      size = 'md',
      icon,
      iconPosition = 'left',
      fullWidth = false,
      className = '',
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id || `input-${Math.random().toString(36).slice(2, 9)}`;
    const hasError = Boolean(error);

    return (
      <div className={[styles.wrapper, fullWidth ? styles['wrapper--full'] : '', className].filter(Boolean).join(' ')}>
        {label && (
          <label htmlFor={inputId} className={styles.label}>
            {label}
          </label>
        )}
        <div className={[styles.inputWrap, styles[`inputWrap--${size}`], hasError ? styles['inputWrap--error'] : ''].filter(Boolean).join(' ')}>
          {icon && iconPosition === 'left' && (
            <span className={[styles.icon, styles['icon--left']].join(' ')} aria-hidden="true">{icon}</span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={[
              styles.input,
              styles[`input--${size}`],
              icon && iconPosition === 'left' ? styles['input--iconLeft'] : '',
              icon && iconPosition === 'right' ? styles['input--iconRight'] : '',
            ].filter(Boolean).join(' ')}
            aria-invalid={hasError}
            aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
            {...props}
          />
          {icon && iconPosition === 'right' && (
            <span className={[styles.icon, styles['icon--right']].join(' ')} aria-hidden="true">{icon}</span>
          )}
        </div>
        {error && (
          <span id={`${inputId}-error`} className={styles.error} role="alert">
            {error}
          </span>
        )}
        {hint && !error && (
          <span id={`${inputId}-hint`} className={styles.hint}>
            {hint}
          </span>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
