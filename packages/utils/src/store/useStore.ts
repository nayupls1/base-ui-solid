import { createMemo, type Accessor } from 'solid-js';
import type { ReactiveStore } from './ReactiveStore';
import type { ReadonlyStore } from './Store';

/**
 * Returns a memoized accessor for `selector(state, ...args)`.
 * For a `ReactiveStore`, reads are tracked per key.
 */
export function useStore<State extends object, Value>(
  store: ReadonlyStore<State> | ReactiveStore<State, any, any>,
  selector: (state: State, ...args: any[]) => Value,
  a1?: unknown,
  a2?: unknown,
  a3?: unknown,
): Accessor<Value> {
  const tracked = (store as ReactiveStore<State, any, any>).trackedState;
  return createMemo(() => selector(tracked ?? store.state, a1, a2, a3));
}
