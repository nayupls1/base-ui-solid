import { createEffect, untrack, type Accessor } from 'solid-js';

/**
 * Calls `onChange` with the previous value whenever `value` changes (not on mount).
 */
export function useValueChanged<T>(value: Accessor<T>, onChange: (previousValue: T) => void) {
  let previous = untrack(value);
  createEffect(value, (next) => {
    if (previous !== next) {
      const prev = previous;
      previous = next;
      untrack(() => onChange(prev));
      return;
    }
    previous = next;
  });
}
