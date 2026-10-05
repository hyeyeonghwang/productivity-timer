/**
 * Audio helper — a tiny wrapper around the Web Audio API for the completion
 * chime. It holds NO timer state; callers decide when/whether to play.
 *
 * Browser autoplay policies require audio to be unlocked by a user gesture, so
 * {@link unlockAudio} should be called from a click handler (e.g. Start). All
 * functions degrade gracefully when the Web Audio API is unavailable.
 */

type AudioContextCtor = typeof AudioContext;

function getAudioContextCtor(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as Window &
    typeof globalThis & { webkitAudioContext?: AudioContextCtor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

let audioContext: AudioContext | null = null;

/** Resets the cached AudioContext. Intended for tests only. */
export function resetAudioForTesting(): void {
  audioContext = null;
}

/** True when the Web Audio API is available in this environment. */
export function isAudioSupported(): boolean {
  return getAudioContextCtor() !== null;
}

/**
 * Lazily creates (and resumes) the shared AudioContext. Safe to call multiple
 * times. Should be invoked from a user gesture to satisfy autoplay policies.
 * Returns the context, or null when unsupported.
 */
export function unlockAudio(): AudioContext | null {
  const Ctor = getAudioContextCtor();
  if (!Ctor) return null;
  if (!audioContext) {
    try {
      audioContext = new Ctor();
    } catch {
      return null;
    }
  }
  if (audioContext.state === 'suspended') {
    void audioContext.resume().catch(() => {
      /* ignore resume failures */
    });
  }
  return audioContext;
}

/**
 * Plays a short two-tone completion chime. No-op when audio is unsupported or
 * the context cannot be created. Never throws.
 *
 * @param volume gain in the range [0, 1] (default 0.3)
 */
export function playChime(volume = 0.3): void {
  const ctx = unlockAudio();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const gain = ctx.createGain();
    const safeVolume = Math.min(1, Math.max(0, volume));
    gain.gain.setValueAtTime(0.0001, now);
    gain.connect(ctx.destination);

    // Two short beeps (A5 then E6) for a pleasant "done" cue.
    const notes = [
      { freq: 880, start: 0, duration: 0.18 },
      { freq: 1318.5, start: 0.2, duration: 0.22 },
    ];

    for (const note of notes) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(note.freq, now + note.start);
      osc.connect(gain);

      // Simple attack/decay envelope to avoid clicks.
      const startAt = now + note.start;
      const endAt = startAt + note.duration;
      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.exponentialRampToValueAtTime(safeVolume, startAt + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, endAt);

      osc.start(startAt);
      osc.stop(endAt + 0.02);
    }
  } catch {
    /* ignore playback failures */
  }
}
