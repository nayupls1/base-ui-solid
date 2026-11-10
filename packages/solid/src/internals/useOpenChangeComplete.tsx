import { createEffect, untrack } from 'solid-js';
import { useAnimationsFinished } from './useAnimationsFinished';

/**
 * Calls the provided function when the CSS open/close animation or transition completes.
 * Parameters are read lazily, so they can be getters.
 */
export function useOpenChangeComplete(parameters: UseOpenChangeCompleteParameters) {
  const runOnceAnimationsFinish = useAnimationsFinished(
    () => resolveElement(parameters.ref),
    () => parameters.open,
    parameters.batch ?? false,
  );

  createEffect(
    () => [parameters.enabled ?? true, parameters.open, parameters.restartKey] as const,
    ([enabled]) => {
      if (!enabled) {
        return undefined;
      }

      const abortController = new AbortController();

      untrack(() =>
        runOnceAnimationsFinish(() => parameters.onComplete(), abortController.signal),
      );

      return () => {
        abortController.abort();
      };
    },
  );
}

function resolveElement(ref: UseOpenChangeCompleteParameters['ref']) {
  if (typeof ref === 'function') {
    return ref() ?? null;
  }
  return ref?.current ?? null;
}

export interface UseOpenChangeCompleteParameters {
  /**
   * Whether the hook is enabled.
   * @default true
   */
  enabled?: boolean | undefined;
  /**
   * Whether the element is open.
   */
  open?: boolean | undefined;
  /**
   * The element being closed: a `{ current }` ref or an accessor.
   */
  ref: { current: HTMLElement | null } | (() => HTMLElement | null | undefined);
  /**
   * Whether completions ready in the same microtask may be coalesced into a single flush.
   * @default false
   */
  batch?: boolean | undefined;
  /**
   * Restarts the wait when it changes, such as when the element attaches after the wait started.
   */
  restartKey?: unknown;
  /**
   * Function to call when the animation completes (or there is no animation).
   */
  onComplete: () => void;
}

export interface UseOpenChangeCompleteState {}
