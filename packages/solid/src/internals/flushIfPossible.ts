import { flush, getOwner } from 'solid-js';

/**
 * The counterpart of `ReactDOM.flushSync`: applies queued updates now.
 * Solid forbids flushing from inside a computation or effect, where updates are
 * already being processed, so it's skipped there.
 */
export function flushIfPossible() {
  if (getOwner()) {
    return;
  }
  try {
    flush();
  } catch {
    // Flushing isn't possible in this context; updates apply at the end of the current flush.
  }
}
