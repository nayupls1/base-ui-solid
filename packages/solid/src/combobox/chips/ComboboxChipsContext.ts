import { createContext, useContext } from 'solid-js';
import type { RefObject } from 'base-ui-solidjs-utils/types';

export interface ComboboxChipsContext {
  chipsRef: RefObject<Array<HTMLButtonElement | null>>;
}

export const ComboboxChipsContext = createContext<ComboboxChipsContext | null>(null);

export function useComboboxChipsContext() {
  return useContext(ComboboxChipsContext);
}
