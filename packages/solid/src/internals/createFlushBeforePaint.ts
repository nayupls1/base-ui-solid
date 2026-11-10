import { flush } from 'solid-js';

/**
 * Creates a queue that runs callbacks in a synchronous flush before the browser paints, so that
 * the browser doesn't paint an intermediate frame.
 * Callbacks that become ready within the same microtask checkpoint are batched into a single
 * flush.
 */
export function createFlushBeforePaint() {
  let pendingCallbacks: Array<() => void> | null = null;

  return function flushBeforePaint(fn: () => void) {
    if (!pendingCallbacks) {
      const callbacks: Array<() => void> = [];
      pendingCallbacks = callbacks;
      queueMicrotask(() => {
        pendingCallbacks = null;
        for (const callback of callbacks) {
          callback();
        }
        flush();
      });
    }
    pendingCallbacks.push(fn);
  };
}
