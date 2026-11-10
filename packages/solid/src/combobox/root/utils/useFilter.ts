import { createCollatorItemFilter, createSingleSelectionCollatorFilter } from './index';
import { getFilter } from '../../../internals/filter';
import type { Filter, GetFilterParameters as UseFilterOptions } from '../../../internals/filter';

export type { Filter, UseFilterOptions };

/**
 * Matches items against a query using `Intl.Collator` for robust string matching.
 */
export const useCoreFilter = getFilter;

export interface UseComboboxFilterOptions extends UseFilterOptions {
  /**
   * Whether the combobox is in multiple selection mode.
   * @default false
   */
  multiple?: boolean | undefined;
  /**
   * The current value of the combobox, used to keep every item visible while the query still
   * matches the selection.
   */
  value?: any;
}

/**
 * Matches items against a query using `Intl.Collator` for robust string matching.
 * Options are read lazily, so `value` can be a getter that tracks the current selection.
 */
export function useComboboxFilter(options: UseComboboxFilterOptions = {}): Filter {
  const getCoreFilter = () => {
    const { multiple: _multiple, value: _value, ...collatorOptions } = options;
    return getFilter(collatorOptions);
  };

  const contains: Filter['contains'] = (
    item: any,
    query: string,
    itemToString?: (item: any) => string,
  ) => {
    const coreFilter = getCoreFilter();
    if (options.multiple ?? false) {
      return createCollatorItemFilter(coreFilter, itemToString)(item, query);
    }
    return createSingleSelectionCollatorFilter(
      coreFilter,
      itemToString,
      options.value,
    )(item, query);
  };

  return {
    get startsWith() {
      return getCoreFilter().startsWith;
    },
    get endsWith() {
      return getCoreFilter().endsWith;
    },
    contains,
  } as Filter;
}
