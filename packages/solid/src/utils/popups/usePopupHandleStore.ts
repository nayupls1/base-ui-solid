import { createMemo, createSignal, onCleanup, type Accessor } from 'solid-js';
import type { PopupHandleStoreProvider } from './popupHandle';

/**
 * Reads the store currently exposed by a popup handle and follows store-pointer changes.
 *
 * Detached triggers use this to follow a handle as a root attaches or detaches: while no root is
 * attached, the handle exposes its fallback store; once a root attaches, the returned proxy
 * forwards to the live root store. Reactive reads made through the proxy (`useState`, `read`)
 * track the pointer, so they re-evaluate when the handle switches stores.
 *
 * Returns `undefined` when no handle is provided so callers can fall back to their root context.
 *
 * @param handle The popup handle to read from, or `undefined` when the trigger is not handle-bound.
 */
export function usePopupHandleStore<HandleStore>(
  handle: PopupHandleStoreProvider<HandleStore> | undefined,
): HandleStore | undefined {
  if (handle === undefined) {
    return undefined;
  }

  const [version, setVersion] = createSignal(0, { ownedWrite: true });
  const unsubscribe = handle.subscribeStore(() => {
    setVersion((v) => v + 1);
  });
  onCleanup(unsubscribe);

  const current: Accessor<any> = () => {
    version();
    return handle.store;
  };

  return createHandleStoreProxy(current) as HandleStore;
}

/**
 * Creates an object that forwards every member access to the store returned by `getStore`.
 * `useState(key, ...args)` returns a memo that tracks both the store pointer and the selector.
 */
export function createHandleStoreProxy(getStore: Accessor<any>) {
  return new Proxy(
    {},
    {
      get(_target, key) {
        if (key === 'useState') {
          return (selectorKey: string, ...args: unknown[]) =>
            createMemo(() => {
              const store = getStore();
              const unwrapped = args.map((arg) =>
                typeof arg === 'function' && (arg as Function).length === 0
                  ? (arg as () => unknown)()
                  : arg,
              );
              return typeof store.read === 'function'
                ? store.read(selectorKey, ...unwrapped)
                : store.select(selectorKey, ...unwrapped);
            });
        }
        const store = getStore();
        const value = store[key];
        return typeof value === 'function' ? value.bind(store) : value;
      },
      has(_target, key) {
        return key in getStore();
      },
    },
  );
}
