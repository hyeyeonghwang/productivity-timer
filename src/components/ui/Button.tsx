import type { ButtonHTMLAttributes, ReactNode } from 'react';

/** Visual variants for {@link Button}. */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  children: ReactNode;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-indigo-600 text-white hover:bg-indigo-500 disabled:bg-indigo-300',
  secondary:
    'bg-slate-200 text-slate-900 hover:bg-slate-300 disabled:bg-slate-100 disabled:text-slate-400',
  ghost:
    'bg-transparent text-slate-700 hover:bg-slate-100 disabled:text-slate-400',
};

/**
 * Reusable button primitive.
 *
 * - Native `<button>` so keyboard activation (Enter/Space) works for free.
 * - Visible focus ring via `focus-visible`.
 * - `disabled` is forwarded natively and also prevents click handlers firing.
 * - All native button attributes (incl. `aria-*`, `type`) pass through.
 */
export function Button({
  variant = 'primary',
  className = '',
  type = 'button',
  children,
  ...rest
}: ButtonProps): JSX.Element {
  return (
    <button
      type={type}
      className={[
        'inline-flex min-h-[44px] items-center justify-center rounded-md px-4 py-2',
        'text-sm font-medium transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
        'focus-visible:ring-offset-2 disabled:cursor-not-allowed',
        VARIANT_CLASSES[variant],
        className,
      ].join(' ')}
      {...rest}
    >
      {children}
    </button>
  );
}
