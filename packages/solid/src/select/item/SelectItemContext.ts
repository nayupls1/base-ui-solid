import { createContext, useContext } from 'solid-js';
import type { RefObject } from '@base-ui-solid/utils/types';

/** Values are getters. */
export interface SelectItemContext {
  readonly selected: boolean;
  readonly index: number;
  textRef: RefObject<HTMLElement | null>;
  readonly selectedByFocus: boolean;
}

export const SelectItemContext = createContext<SelectItemContext | null>(null);

export function useSelectItemContext() {
  const context = useContext(SelectItemContext);
  if (!context) {
    throw new Error(
      'Base UI: SelectItemContext is missing. SelectItem parts must be placed within <Select.Item>.',
    );
  }
  return context;
}
