import { createContext, useContext } from 'solid-js';

export interface ComboboxGroupContext {
  labelId: string | undefined;
  setLabelId: (
    value: string | undefined | ((prev: string | undefined) => string | undefined),
  ) => void;
  /**
   * Optional list of items that belong to this group. Used by nested
   * collections to render group-specific items.
   */
  items?: readonly any[] | undefined;
}

export const ComboboxGroupContext = createContext<ComboboxGroupContext | null>(null);

export function useComboboxGroupContext() {
  const context = useContext(ComboboxGroupContext);
  if (context == null) {
    throw new Error(
      'Base UI: ComboboxGroupContext is missing. ComboboxGroup parts must be placed within <Combobox.Group>.',
    );
  }
  return context ?? undefined;
}
