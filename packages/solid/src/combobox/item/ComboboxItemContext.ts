import { createContext, useContext } from 'solid-js';
import type { RefObject } from '@base-ui-solid/utils/types';

export interface ComboboxItemContext {
  selected: boolean;
  textRef: RefObject<HTMLElement | null>;
}

export const ComboboxItemContext = createContext<ComboboxItemContext | null>(null);

export function useComboboxItemContext() {
  const context = useContext(ComboboxItemContext);
  if (!context) {
    throw new Error(
      'Base UI: ComboboxItemContext is missing. ComboboxItem parts must be placed within <Combobox.Item>.',
    );
  }
  return context ?? undefined;
}
