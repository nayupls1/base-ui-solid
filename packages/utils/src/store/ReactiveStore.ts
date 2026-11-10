import { createMemo, createEffect, untrack, createSignal, getOwner, onCleanup, type Accessor, type Setter } from 'solid-js';
import { Store } from './Store';
import { NOOP } from '../empty';

type SignalPair = [Accessor<number>, Setter<number>];

/**
 * A store with a synchronous, imperative source of truth (`store.state`) that also exposes
 * fine-grained reactive reads for Solid.
 *
 * Imperative reads (`store.state`, `store.select()`) always see the latest value, matching the
 * semantics of Base UI's React store. Reactive reads (`store.useState()`, `store.get()`) are
 * tracked per state key, so a computation only re-runs when a key it read changes.
 */
export class ReactiveStore<
  State extends object,
  Context = Record<string, never>,
  Selectors extends Record<string, SelectorFunction<State>> = Record<string, never>,
> extends Store<State> {
  constructor(state: State, context: Context = {} as Context, selectors?: Selectors) {
    super(state);
    this.context = context;
    this.selectors = selectors;
    this.keySignals = new Map();
    // eslint-disable-next-line consistent-this
    const store = this;
    this.trackedState = new Proxy({} as State, {
      get(_target, key) {
        store.track(key as keyof State);
        return (store.state as any)[key];
      },
      has(_target, key) {
        store.track(key as keyof State);
        return key in store.state;
      },
      ownKeys() {
        return Reflect.ownKeys(store.state);
      },
      getOwnPropertyDescriptor(_target, key) {
        store.track(key as keyof State);
        const descriptor = Reflect.getOwnPropertyDescriptor(store.state, key);
        if (descriptor) {
          descriptor.configurable = true;
        }
        return descriptor;
      },
    });
  }

  declare readonly context: Context;

  declare private selectors: Selectors | undefined;

  declare private keySignals: Map<keyof State, SignalPair>;

  /**
   * A proxy of the state that tracks every key read inside a reactive computation.
   */
  declare readonly trackedState: State;

  private track(key: keyof State) {
    let pair = this.keySignals.get(key);
    if (!pair) {
      pair = createSignal(0, { ownedWrite: true, equals: false }) as unknown as SignalPair;
      this.keySignals.set(key, pair);
    }
    pair[0]();
  }

  override setState(newState: State) {
    const prevState = this.state;
    if (prevState === newState) {
      return;
    }
    for (const [key, pair] of this.keySignals) {
      if (!Object.is(prevState[key], newState[key])) {
        pair[1](1);
      }
    }
    super.setState(newState);
  }

  override notifyAll() {
    for (const [, pair] of this.keySignals) {
      pair[1](1);
    }
    super.notifyAll();
  }

  /**
   * Reactive read of a single state key.
   */
  get<Key extends keyof State>(key: Key): State[Key] {
    return this.trackedState[key];
  }

  /**
   * Keeps the given state key in sync with a reactive value.
   */
  useSyncedValue<Key extends keyof State>(key: Key, value: Accessor<State[Key]>) {
    // eslint-disable-next-line consistent-this
    const store = this;
    const initial = untrack(value);
    if (!Object.is(store.state[key], initial)) {
      store.set(key, initial);
    }
    createEffect(value, (next) => {
      if (!Object.is(store.state[key], next)) {
        store.set(key, next);
      }
    });
  }

  useSyncedValueWithCleanup<Key extends KeysAllowingUndefined<State>>(
    key: Key,
    value: Accessor<State[Key]>,
  ) {
    // eslint-disable-next-line consistent-this
    const store = this;
    createEffect(value, (next) => {
      if (!Object.is(store.state[key], next)) {
        store.set(key, next);
      }
      return () => {
        store.set(key, undefined as State[Key]);
      };
    });
  }

  /**
   * Keeps several state keys in sync with reactive values.
   * The object is expected to have getters (or accessor functions are passed via `useSyncedValue`).
   */
  useSyncedValues<const Key extends keyof State>(statePart: Accessor<Pick<State, Key>>) {
    // eslint-disable-next-line consistent-this
    const store = this;
    store.update(untrack(statePart));
    createEffect(statePart, (next) => {
      store.update(next);
    });
  }

  /**
   * Syncs a controlled prop into the store whenever it's defined.
   */
  useControlledProp<Key extends keyof State>(key: Key, controlled: Accessor<State[Key] | undefined>) {
    // eslint-disable-next-line consistent-this
    const store = this;
    const initial = untrack(controlled);
    if (initial !== undefined && !Object.is(store.state[key], initial)) {
      store.setState({ ...store.state, [key]: initial });
    }
    createEffect(controlled, (next) => {
      if (next !== undefined && !Object.is(store.state[key], next)) {
        store.setState({ ...store.state, [key]: next });
      }
    });
  }

  select<Key extends keyof Selectors>(
    key: Key,
    ...args: SelectorArgs<Selectors[Key]>
  ): ReturnType<Selectors[Key]>;

  select(key: keyof Selectors, a1?: unknown, a2?: unknown, a3?: unknown) {
    const selector = this.selectors![key];
    return selector(this.state, a1, a2, a3);
  }

  /**
   * Reactive read of a selector. Returns the current value when called inside a tracking scope.
   */
  read<Key extends keyof Selectors>(
    key: Key,
    ...args: SelectorArgs<Selectors[Key]>
  ): ReturnType<Selectors[Key]>;

  read(key: keyof Selectors, a1?: unknown, a2?: unknown, a3?: unknown) {
    const selector = this.selectors![key];
    return selector(this.trackedState, a1, a2, a3);
  }

  /**
   * Returns a memoized accessor for a selector.
   * Arguments may be accessors, which are unwrapped on every evaluation.
   */
  useState<Key extends keyof Selectors>(
    key: Key,
    ...args: MaybeAccessorArgs<SelectorArgs<Selectors[Key]>>
  ): Accessor<ReturnType<Selectors[Key]>>;

  useState(key: keyof Selectors, a1?: unknown, a2?: unknown, a3?: unknown) {
    const selector = this.selectors![key];
    return createMemo(() =>
      selector(this.trackedState, unwrapArg(a1), unwrapArg(a2), unwrapArg(a3)),
    );
  }

  /**
   * Registers a callback in the store context. The latest callback is always invoked.
   */
  useContextCallback<Key extends ContextFunctionKeys<Context>>(
    key: Key,
    getFn: Accessor<ContextFunction<Context, Key> | undefined>,
  ) {
    (this.context as Record<Key, any>)[key] = (...args: any[]) => {
      const callback = getFn() ?? (NOOP as any);
      return callback(...args);
    };
  }

  useStateSetter<const Key extends keyof State>(key: Key) {
    return (value: State[Key]) => {
      this.set(key, value);
    };
  }

  observe<Key extends keyof Selectors>(
    selector: Key,
    listener: (
      newValue: ReturnType<Selectors[Key]>,
      oldValue: ReturnType<Selectors[Key]>,
      store: this,
    ) => void,
  ): () => void;

  observe<Selector extends ObserveSelector<State>>(
    selector: Selector,
    listener: (newValue: ReturnType<Selector>, oldValue: ReturnType<Selector>, store: this) => void,
  ): () => void;

  observe(
    selector: keyof Selectors | ObserveSelector<State>,
    listener: (newValue: any, oldValue: any, store: this) => void,
  ) {
    let selectFn: ObserveSelector<State>;

    if (typeof selector === 'function') {
      selectFn = selector;
    } else {
      selectFn = this.selectors![selector] as ObserveSelector<State>;
    }

    let prevValue = selectFn(this.state);

    listener(prevValue, prevValue, this);

    const unsubscribe = this.subscribe((nextState) => {
      const nextValue = selectFn(nextState);
      if (!Object.is(prevValue, nextValue)) {
        const oldValue = prevValue;
        prevValue = nextValue;
        listener(nextValue, oldValue, this);
      }
    });

    if (getOwner()) {
      onCleanup(unsubscribe);
    }

    return unsubscribe;
  }
}

/**
 * Zero-arity functions passed as selector arguments are treated as accessors and unwrapped.
 */
function unwrapArg(arg: unknown) {
  return typeof arg === 'function' && (arg as any).length === 0 ? (arg as () => unknown)() : arg;
}

type MaybeAccessorArgs<T extends readonly any[]> = { [K in keyof T]: T[K] | Accessor<T[K]> };

type MaybeCallable = (...args: any[]) => any;

type ContextFunctionKeys<Context> = {
  [Key in keyof Context]-?: Extract<Context[Key], MaybeCallable> extends never ? never : Key;
}[keyof Context];

type ContextFunction<Context, Key extends keyof Context> = Extract<Context[Key], MaybeCallable>;

type KeysAllowingUndefined<State> = {
  [Key in keyof State]-?: undefined extends State[Key] ? Key : never;
}[keyof State];

type ObserveSelector<State> = (state: State) => any;

export type SelectorFunction<State> = (state: State, ...args: any[]) => any;

type Tail<T extends readonly any[]> = T extends readonly [any, ...infer Rest] ? Rest : [];

type SelectorArgs<Selector> = Selector extends (...params: infer Params) => any
  ? Tail<Params>
  : never;

/**
 * Alias kept for parity with Base UI's React store.
 */
export { ReactiveStore as ReactStore };
