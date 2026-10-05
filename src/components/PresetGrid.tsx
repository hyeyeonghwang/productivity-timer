import type { PresetMinutes } from '../core/types';
import { Button } from './ui/Button';

/** The approved preset durations in minutes. */
export const PRESET_MINUTES: readonly PresetMinutes[] = [5, 10, 25, 50];

export interface PresetGridProps {
  /** Currently selected preset, or null when a custom duration is active. */
  selected: PresetMinutes | null;
  /** Called with the chosen preset. Parent updates timer/settings state. */
  onSelect: (minutes: PresetMinutes) => void;
  disabled?: boolean;
}

/**
 * Grid of preset-duration buttons. The active preset is indicated both by color
 * and by `aria-pressed` (not color alone). Selection is reported via callback;
 * the component changes no timer state itself.
 */
export function PresetGrid({
  selected,
  onSelect,
  disabled = false,
}: PresetGridProps): JSX.Element {
  return (
    <div
      className="grid grid-cols-4 gap-2"
      role="group"
      aria-label="Preset durations"
    >
      {PRESET_MINUTES.map((minutes) => {
        const isActive = selected === minutes;
        return (
          <Button
            key={minutes}
            variant={isActive ? 'primary' : 'secondary'}
            aria-pressed={isActive}
            disabled={disabled}
            onClick={() => onSelect(minutes)}
            className="whitespace-nowrap px-2"
          >
            {minutes} min
          </Button>
        );
      })}
    </div>
  );
}
