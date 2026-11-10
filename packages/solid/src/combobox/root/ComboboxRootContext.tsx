import { createContext, useContext } from 'solid-js';
import type { ComboboxStore } from '../store';

/**
 * Reactive values are getters.
 */
export interface ComboboxDerivedItemsContext {
  hasItems: boolean;
  filteredItems: any[];
  /**
   * `filteredItems` flattened across groups and projected to selection values. Identical to the
   * items themselves unless `items` is a `createItems()` collection.
   */
  flatFilteredValues: any[];
}

export const ComboboxRootContext = createContext<ComboboxStore | null>(null);
export const ComboboxDerivedItemsContext = createContext<ComboboxDerivedItemsContext | null>(null);
export const ComboboxHasItemsContext = createContext<boolean>(false);
// `inputValue` can't be placed in the store.
// https://github.com/mui/base-ui/issues/2703
// Holds an accessor for the input value.
export const ComboboxInputValueContext = createContext<() => string | number | readonly string[]>(
  () => '',
);

export function useComboboxRootContext() {
  const context = useContext(ComboboxRootContext) as ComboboxStore | undefined;
  if (!context) {
    throw new Error(
      'Base UI: ComboboxRootContext is missing. Combobox parts must be placed within <Combobox.Root>.',
    );
  }
  return context ?? undefined;
}

export function useComboboxDerivedItemsContext() {
  const context = useContext(ComboboxDerivedItemsContext);
  if (!context) {
    throw new Error(
      'Base UI: ComboboxItemsContext is missing. Combobox parts must be placed within <Combobox.Root>.',
    );
  }
  return context ?? undefined;
}

export function useComboboxInputValueContext() {
  return useContext(ComboboxInputValueContext);
}

export function useComboboxHasItemsContext() {
  return useContext(ComboboxHasItemsContext);
}
