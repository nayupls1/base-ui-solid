export type RefCallback<I> = (instance: I) => void | (() => void);
type Empty = null | undefined | false;
export type InputRef<I> = RefCallback<I> | { current: I | null } | Empty;

/**
 * Assigns a value to a callback ref or a `{ current }` ref object.
 */
export function assignRef<I>(ref: InputRef<I> | undefined, value: I) {
  if (!ref) {
    return;
  }
  if (typeof ref === 'function') {
    ref(value);
  } else {
    ref.current = value;
  }
}

/**
 * Merges refs into a single callback ref.
 * In Solid, refs are invoked once with the element, so this is a plain fan-out.
 * Arrays (as accepted by Solid's `ref` attribute) are flattened.
 */
export function useMergedRefs<I>(...refs: Array<InputRef<I> | InputRef<I>[] | undefined>) {
  return (instance: I) => {
    for (const ref of refs) {
      if (Array.isArray(ref)) {
        for (const nested of ref) {
          assignRef(nested, instance);
        }
      } else {
        assignRef(ref as InputRef<I>, instance);
      }
    }
  };
}

export function useMergedRefsN<I>(refs: Array<InputRef<I> | undefined>) {
  return useMergedRefs<I>(...refs);
}
