import { createContext, useContext } from 'solid-js';
import { NOOP } from '../noop';
import type { HTMLProps } from '../types';

type SetStateAction<T> = T | ((prev: T) => T);

export interface LabelableContext {
  /**
   * The `id` of the labelable element.
   * When `null` the label omits `for`, either because the association is implicit or
   * because the control takes its name from `aria-labelledby`.
   * Reactive (getter).
   */
  readonly controlId: string | null | undefined;
  registerControlId: (source: symbol, id: string | null | undefined) => void;
  resetControlId: () => void;
  /**
   * The `id` of the label. Reactive (getter).
   */
  readonly labelId: string | undefined;
  setLabelId: (value: SetStateAction<string | undefined>) => void;
  /**
   * An array of `id`s of elements that provide an accessible description. Reactive (getter).
   */
  readonly messageIds: string[];
  setMessageIds: (value: SetStateAction<string[]>) => void;
  getDescriptionProps: (externalProps: HTMLProps) => HTMLProps;
}

const DEFAULT_LABELABLE_CONTEXT: LabelableContext = {
  controlId: undefined,
  registerControlId: NOOP,
  resetControlId: NOOP,
  labelId: undefined,
  setLabelId: NOOP,
  messageIds: [],
  setMessageIds: NOOP,
  getDescriptionProps: (externalProps: HTMLProps) => externalProps,
};

/**
 * A context for providing [labelable elements](https://html.spec.whatwg.org/multipage/forms.html#category-label)
 * with an accessible name (label) and description.
 */
export const LabelableContext = createContext<LabelableContext>(DEFAULT_LABELABLE_CONTEXT);

export function useLabelableContext() {
  return useContext(LabelableContext);
}
