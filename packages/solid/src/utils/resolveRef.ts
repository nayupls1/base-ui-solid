/**
 * If the provided argument is a ref object or an accessor, returns its current value.
 * Otherwise, returns the argument itself.
 */
export function resolveRef<T extends Element | null | undefined>(
  maybeRef: T | { current: T } | (() => T),
): T {
  if (maybeRef == null) {
    return maybeRef as T;
  }
  if (typeof maybeRef === 'function') {
    return (maybeRef as () => T)();
  }
  return 'current' in (maybeRef as object) ? (maybeRef as { current: T }).current : (maybeRef as T);
}
