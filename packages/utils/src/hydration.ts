import { isHydrating } from 'solid-js';

/** Returns `true` while Solid is hydrating server-rendered markup. */
export function useIsHydrating() {
  return isHydrating();
}

/** Returns `true` once Solid has taken over on the client. */
export function useIsHydrated() {
  return !isHydrating();
}
