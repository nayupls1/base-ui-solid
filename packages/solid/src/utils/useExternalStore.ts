import { createSignal, onCleanup, type Accessor } from 'solid-js';

export interface ExternalStore<T> {
  getSnapshot: () => T;
  subscribe: (listener: () => void) => () => void;
}

/**
 * Reads a `useSyncExternalStore`-style store as an accessor.
 */
export function useExternalStore<T>(store: ExternalStore<T>): Accessor<T> {
  const [value, setValue] = createSignal<T>(store.getSnapshot() as any, {
    ownedWrite: true,
  });
  onCleanup(
    store.subscribe(() => {
      setValue(() => store.getSnapshot());
    }),
  );
  return value;
}
