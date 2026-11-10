import { useComboboxDerivedItemsContext } from '../ComboboxRootContext';

/**
 * Returns an accessor for the filtered items.
 *
 * Returns the internally filtered items.
 * Treat the result as read-only: it is internal state and may be a shared frozen array.
 */
export function useFilteredItems<T>(): () => T[] {
  const items = useComboboxDerivedItemsContext();
  return () => items.filteredItems as T[];
}
