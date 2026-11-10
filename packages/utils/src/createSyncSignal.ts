import { createSignal, getObserver, type Accessor } from 'solid-js';

export type SyncSetter<T> = (value: T | ((prev: T) => T)) => T;

/**
 * A signal whose imperative reads are synchronous: right after a write, `get()` returns the new
 * value even before Solid flushes. Reactive consumers are still notified through Solid's
 * scheduler. This mirrors the semantics Base UI relies on for its internal state.
 */
export function createSyncSignal<T>(
  initial: T,
  options?: { equals?: false | ((prev: T, next: T) => boolean) },
): [Accessor<T>, SyncSetter<T>] {
  let current = initial;
  const [version, setVersion] = createSignal(0, { ownedWrite: true, equals: false });
  const equals =
    options?.equals === false ? () => false : (options?.equals ?? ((a: T, b: T) => Object.is(a, b)));

  const get = () => {
    // Only subscribe inside tracking scopes; imperative reads (event handlers, effect callbacks)
    // just need the latest value.
    if (getObserver() !== null) {
      version();
    }
    return current;
  };

  const set: SyncSetter<T> = (value) => {
    const next =
      typeof value === 'function' ? (value as (prev: T) => T)(current) : (value as T);
    if (!equals(current, next)) {
      current = next;
      setVersion(0);
    }
    return current;
  };

  return [get, set];
}
