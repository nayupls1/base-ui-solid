import { createContext, useContext } from 'solid-js';
import type { ProgressRootState } from './ProgressRoot';

type SetStateAction<T> = T | ((prev: T) => T);

/** Reactive values are getters. */
export type ProgressRootContext = {
  /**
   * The value clamped to the range. `null` while the progress is indeterminate.
   */
  readonly clampedValue: number | null;
  readonly format: Intl.NumberFormatOptions | undefined;
  readonly locale: Intl.LocalesArgument | undefined;
  /**
   * The value normalized to a `0`–`100` percentage of the range, clamped to those bounds.
   * `null` while the progress is indeterminate.
   */
  readonly percentageValue: number | null;
  /**
   * Value of the component.
   */
  readonly value: number | null;
  setLabelId: (value: SetStateAction<string | undefined>) => void;
  readonly state: ProgressRootState;
};

/**
 * @internal
 */
export const ProgressRootContext = createContext<ProgressRootContext | null>(null);

export function useProgressRootContext() {
  const context = useContext(ProgressRootContext);
  if (context == null) {
    throw new Error(
      'Base UI: ProgressRootContext is missing. Progress parts must be placed within <Progress.Root>.',
    );
  }

  return context;
}
