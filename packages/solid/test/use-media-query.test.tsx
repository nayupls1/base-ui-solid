import { createRoot, flush } from 'solid-js';
import { describe, it, expect } from 'vitest';
import { useMediaQuery } from '../src/unstable-use-media-query';

function createMatchMedia(initial: boolean) {
  const listeners = new Set<() => void>();
  const list = {
    matches: initial,
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
  };
  return {
    matchMedia: ((query: string) => {
      expect(query).toBe('(min-width: 600px)');
      return list;
    }) as unknown as typeof window.matchMedia,
    set(value: boolean) {
      list.matches = value;
      listeners.forEach((fn) => fn());
    },
    listeners,
  };
}

describe('useMediaQuery', () => {
  it('tracks changes and strips the @media prefix', () => {
    const mock = createMatchMedia(false);
    let matches!: () => boolean;
    const dispose = createRoot((d) => {
      matches = useMediaQuery('@media (min-width: 600px)', { matchMedia: mock.matchMedia });
      return d;
    });
    flush();
    expect(matches()).toBe(false);
    mock.set(true);
    flush();
    expect(matches()).toBe(true);
    dispose();
    expect(mock.listeners.size).toBe(0);
  });

  it('falls back to defaultMatches without matchMedia', () => {
    const dispose = createRoot((d) => {
      const matches = useMediaQuery('(min-width: 600px)', { defaultMatches: true });
      expect(matches()).toBe(typeof window.matchMedia === 'function' ? matches() : true);
      return d;
    });
    dispose();
  });
});
