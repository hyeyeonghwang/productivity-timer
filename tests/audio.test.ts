import { describe, it, expect, afterEach } from 'vitest';
import {
  isAudioSupported,
  unlockAudio,
  playChime,
  resetAudioForTesting,
} from '../src/lib/audio';

afterEach(() => {
  resetAudioForTesting();
  delete (globalThis as { AudioContext?: unknown }).AudioContext;
  delete (globalThis as { webkitAudioContext?: unknown }).webkitAudioContext;
});

describe('audio — unsupported environment', () => {
  it('reports unsupported when AudioContext is absent (jsdom default)', () => {
    expect(isAudioSupported()).toBe(false);
  });

  it('unlockAudio returns null without throwing', () => {
    expect(unlockAudio()).toBeNull();
  });

  it('playChime is a safe no-op without throwing', () => {
    expect(() => playChime()).not.toThrow();
  });
});

describe('audio — with a mocked AudioContext', () => {
  it('creates and resumes a context, and plays without throwing', () => {
    const started: boolean[] = [];

    class FakeOscillator {
      type = 'sine';
      frequency = { setValueAtTime: () => {} };
      connect() {}
      start() {
        started.push(true);
      }
      stop() {}
    }
    class FakeGain {
      gain = {
        setValueAtTime: () => {},
        exponentialRampToValueAtTime: () => {},
      };
      connect() {}
    }
    class FakeAudioContext {
      state: AudioContextState = 'suspended';
      currentTime = 0;
      destination = {};
      async resume() {
        this.state = 'running';
      }
      createOscillator() {
        return new FakeOscillator();
      }
      createGain() {
        return new FakeGain();
      }
    }

    // @ts-expect-error — install mock
    globalThis.AudioContext = FakeAudioContext;

    expect(isAudioSupported()).toBe(true);
    const ctx = unlockAudio();
    expect(ctx).not.toBeNull();
    expect(() => playChime(0.5)).not.toThrow();
    // Two oscillators (two beeps) should have started.
    expect(started.length).toBe(2);
  });
});
