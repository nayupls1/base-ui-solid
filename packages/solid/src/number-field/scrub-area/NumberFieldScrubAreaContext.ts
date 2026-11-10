import { createContext, useContext } from 'solid-js';
import type { RefObject } from '@base-ui-solid/utils/types';

/** Reactive values are getters. */
export interface NumberFieldScrubAreaContext {
  readonly isScrubbing: boolean;
  readonly isTouchInput: boolean;
  readonly isPointerLockDenied: boolean;
  scrubAreaCursorRef: RefObject<HTMLSpanElement | null>;
}

export const NumberFieldScrubAreaContext = createContext<NumberFieldScrubAreaContext | null>(null);

export function useNumberFieldScrubAreaContext() {
  const context = useContext(NumberFieldScrubAreaContext);
  if (context == null) {
    throw new Error(
      'Base UI: NumberFieldScrubAreaContext is missing. NumberFieldScrubArea parts must be placed within <NumberField.ScrubArea>.',
    );
  }
  return context;
}
