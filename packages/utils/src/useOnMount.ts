import { onSettled } from 'solid-js';

/**
 * Runs the callback once after the component's first settle. A returned function runs on disposal.
 */
export function useOnMount(fn: () => void | (() => void)) {
  onSettled(fn as any);
}
