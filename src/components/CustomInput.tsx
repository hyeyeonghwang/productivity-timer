import { useId, useState, type FormEvent } from 'react';
import { Button } from './ui/Button';

/** Approved custom-duration bounds, in whole minutes. */
export const MIN_CUSTOM_MINUTES = 1;
export const MAX_CUSTOM_MINUTES = 999;

export interface CustomInputProps {
  /** Called with a valid duration in milliseconds when the user applies it. */
  onApply: (durationMs: number) => void;
  disabled?: boolean;
}

/**
 * Validates a raw string as a whole-minute value within [1, 999].
 * Returns the integer minutes on success, or an error message on failure.
 * Rejects empty, non-numeric, zero, negative, decimal, and over-limit values.
 */
export function validateMinutes(raw: string): { minutes: number } | { error: string } {
  const trimmed = raw.trim();
  if (trimmed === '') return { error: 'Enter a number of minutes.' };

  // Whole numbers only: reject decimals, signs, and any non-digit characters.
  if (!/^\d+$/.test(trimmed)) {
    return { error: 'Enter a whole number (no decimals or signs).' };
  }

  const minutes = Number(trimmed);
  if (!Number.isInteger(minutes)) {
    return { error: 'Enter a whole number of minutes.' };
  }
  if (minutes < MIN_CUSTOM_MINUTES) {
    return { error: `Minimum is ${MIN_CUSTOM_MINUTES} minute.` };
  }
  if (minutes > MAX_CUSTOM_MINUTES) {
    return { error: `Maximum is ${MAX_CUSTOM_MINUTES} minutes.` };
  }
  return { minutes };
}

/**
 * Custom-duration input. Validation lives here (presentation-level input
 * guarding); it only ever emits a valid duration in ms via `onApply`, so an
 * invalid value can never become a timer duration. Errors are announced to
 * assistive tech via `aria-describedby` + `role="alert"`.
 */
export function CustomInput({ onApply, disabled = false }: CustomInputProps): JSX.Element {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();
  const errorId = `${inputId}-error`;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const result = validateMinutes(value);
    if ('error' in result) {
      setError(result.error);
      return;
    }
    setError(null);
    onApply(result.minutes * 60_000);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-1" noValidate>
      <label htmlFor={inputId} className="text-sm font-medium text-slate-700">
        Custom duration (minutes)
      </label>
      <div className="flex gap-2">
        <input
          id={inputId}
          type="text"
          inputMode="numeric"
          value={value}
          disabled={disabled}
          aria-invalid={error !== null}
          aria-describedby={error ? errorId : undefined}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          placeholder={`${MIN_CUSTOM_MINUTES}–${MAX_CUSTOM_MINUTES}`}
          className={[
            'w-full min-h-[44px] rounded-md border px-3 py-2 text-sm',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
            error ? 'border-red-500' : 'border-slate-300',
          ].join(' ')}
        />
        <Button type="submit" variant="secondary" disabled={disabled}>
          Set
        </Button>
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </form>
  );
}
