import type { TimerStatus } from '../core/types';
import { Button } from './ui/Button';

export interface ControlBarProps {
  status: TimerStatus;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
}

/**
 * Timer controls that reflect the supplied status. It calls parent-provided
 * callbacks and never touches the TimerEngine directly.
 *
 * Control visibility/enablement by status:
 * - idle:     Start enabled, Reset disabled
 * - running:  Pause enabled, Reset enabled
 * - paused:   Resume enabled, Reset enabled
 * - finished: Reset enabled (primary); no start/pause/resume
 */
export function ControlBar({
  status,
  onStart,
  onPause,
  onResume,
  onReset,
}: ControlBarProps): JSX.Element {
  const showStart = status === 'idle';
  const showPause = status === 'running';
  const showResume = status === 'paused';
  const resetDisabled = status === 'idle';

  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      {showStart && (
        <Button variant="primary" onClick={onStart}>
          Start
        </Button>
      )}
      {showPause && (
        <Button variant="primary" onClick={onPause}>
          Pause
        </Button>
      )}
      {showResume && (
        <Button variant="primary" onClick={onResume}>
          Resume
        </Button>
      )}
      <Button
        variant={status === 'finished' ? 'primary' : 'secondary'}
        onClick={onReset}
        disabled={resetDisabled}
      >
        Reset
      </Button>
    </div>
  );
}
