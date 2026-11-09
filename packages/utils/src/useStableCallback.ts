/**
 * In Solid, components run once, so callbacks are stable by construction.
 * This helper exists for parity with the React implementation and wraps an
 * optional callback so it can always be invoked.
 */
export function useStableCallback<Args extends any[], R>(
  callback: ((...args: Args) => R) | undefined,
): (...args: Args) => R {
  return (...args: Args) => callback?.(...args) as R;
}
