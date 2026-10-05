export interface ToggleProps {
  /** Current on/off state. */
  checked: boolean;
  /** Called with the next state when toggled. */
  onChange: (checked: boolean) => void;
  /** Accessible label describing what the toggle controls. */
  label: string;
  /** Optional id to associate with external label text; auto-generated if absent. */
  id?: string;
  disabled?: boolean;
}

/**
 * Reusable switch primitive using the ARIA `switch` role.
 *
 * - Semantic state via `role="switch"` + `aria-checked` (not color-only).
 * - Keyboard accessible: it's a native `<button>`, so Enter/Space activate it.
 * - Accessible name via `aria-label`.
 * - Visible focus ring via `focus-visible`.
 */
export function Toggle({
  checked,
  onChange,
  label,
  id,
  disabled = false,
}: ToggleProps): JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={[
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full',
        'transition-colors focus:outline-none focus-visible:ring-2',
        'focus-visible:ring-indigo-500 focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-indigo-600' : 'bg-slate-300',
      ].join(' ')}
    >
      <span
        aria-hidden="true"
        className={[
          'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-5' : 'translate-x-1',
        ].join(' ')}
      />
    </button>
  );
}
