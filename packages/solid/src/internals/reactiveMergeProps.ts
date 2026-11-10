import { $PROXY, createMemo, untrack } from 'solid-js';
import { mergePropsSkipping } from '../merge-props/mergeProps';

const SKIP = { children: true, ref: true } as const;

type Input =
  Record<string, any> | ((merged: Record<string, any>) => Record<string, any>) | undefined;

/**
 * `mergeProps` for component props that are forwarded to another component: the merge runs in a
 * memo, so reading the result tracks the inputs' getters, and `children`/`ref` are forwarded from
 * the last input that has them without being evaluated.
 *
 * Use it instead of calling `mergeProps(ours, componentProps)` at setup, which would read every
 * prop once, outside any tracking scope.
 */
export function reactiveMergeProps<P extends Record<string, any>>(...inputs: Input[]): P {
  const merged = createMemo(() => mergePropsSkipping(inputs as any, SKIP));

  const lastWith = (key: 'children' | 'ref') => {
    for (let i = inputs.length - 1; i >= 0; i -= 1) {
      const input = inputs[i];
      if (input && typeof input === 'object' && key in input) {
        return input[key];
      }
    }
    return undefined;
  };

  const hasForwarded = (key: 'children' | 'ref') =>
    inputs.some((input) => input && typeof input === 'object' && key in input);

  const read = (key: PropertyKey) =>
    key === 'children' || key === 'ref' ? lastWith(key) : (merged() as any)[key];

  const proxy = new Proxy({} as P, {
    get(_target, key) {
      if (key === $PROXY) {
        return proxy;
      }
      if (typeof key === 'symbol') {
        return undefined;
      }
      return read(key);
    },
    has(_target, key) {
      if (key === $PROXY) {
        return true;
      }
      if (key === 'children' || key === 'ref') {
        return hasForwarded(key);
      }
      // Key sets are stable; only values are read reactively.
      return key in untrack(merged);
    },
    ownKeys() {
      const keys: PropertyKey[] = Object.keys(untrack(merged));
      if (hasForwarded('children')) {
        keys.push('children');
      }
      if (hasForwarded('ref')) {
        keys.push('ref');
      }
      return keys as (string | symbol)[];
    },
    getOwnPropertyDescriptor(_target, key) {
      return {
        configurable: true,
        enumerable: true,
        get: () => read(key),
      };
    },
  });
  return proxy;
}
