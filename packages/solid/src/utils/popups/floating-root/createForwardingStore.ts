import { createMemo, untrack, type Accessor } from 'solid-js';
import type { FloatingRootStore } from './FloatingRootStore';

/**
 * Returns a store that forwards every read and call to whichever store `getStore` currently
 * returns. Reactive reads (`useState`, `get`, `trackedState`) also track the store switch.
 *
 * Hooks in this port bind to the store passed at setup, whereas React re-runs them with the
 * latest store each render. Parts whose store changes over their lifetime (such as the
 * navigation menu positioner, which follows the active trigger) pass a forwarding store instead.
 */
export function createForwardingStore(getStore: Accessor<FloatingRootStore>): FloatingRootStore {
  return new Proxy({} as FloatingRootStore, {
    get(_target, key) {
      if (key === 'useState') {
        return (selectorKey: string, ...args: unknown[]) =>
          createMemo(() =>
            (getStore() as any).read(
              selectorKey,
              ...args.map((arg) => (typeof arg === 'function' ? (arg as () => unknown)() : arg)),
            ),
          );
      }
      // Only reactive reads track the store switch; imperative access reads the current store.
      const reactive = key === 'trackedState' || key === 'get' || key === 'read';
      const store = (reactive ? getStore() : untrack(getStore)) as any;
      const value = store[key];
      if (typeof value === 'function') {
        return (...args: unknown[]) => {
          const current = (reactive ? getStore() : untrack(getStore)) as any;
          return current[key](...args);
        };
      }
      return value;
    },
    set(_target, key, value) {
      (untrack(getStore) as any)[key] = value;
      return true;
    },
    has(_target, key) {
      return key in (untrack(getStore) as any);
    },
  });
}
