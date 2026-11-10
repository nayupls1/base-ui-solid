import { createEffect, createSignal, onCleanup, untrack, type Accessor } from 'solid-js';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import type { FilterDropdownRoot } from './FilterDropdownRootContext';

interface UseFilterDropdownCloseQueryParameters {
  open: boolean;
  mounted: boolean;
  value: string;
  onValueChange: (value: string, details: FilterDropdownRoot.ChangeEventDetails) => void;
}

/**
 * Holds the query in place while the popup animates out, then clears it once the popup closes.
 * Parameters are read lazily, so they can be getters. Returns an accessor for the query to filter
 * with.
 */
export function useFilterDropdownCloseQuery(
  parameters: UseFilterDropdownCloseQueryParameters,
): Accessor<string> {
  const [closeQuery, setCloseQuery] = createSignal<string | null>(null, { ownedWrite: true });

  let previousOpen = untrack(() => parameters.open);
  let pendingReset = false;

  const settlePendingReset = () => {
    pendingReset = false;
    if (untrack(() => parameters.value) !== '') {
      parameters.onValueChange('', createChangeEventDetails(REASONS.popupClose));
    }
  };

  createEffect(
    () => [parameters.open, parameters.mounted, parameters.value, closeQuery()] as const,
    ([open, mounted, value, currentCloseQuery]) => {
      const wasOpen = previousOpen;
      previousOpen = open;
      if (wasOpen && !open && value !== '') {
        pendingReset = true;
        setCloseQuery(value);
      } else if ((open || !mounted) && currentCloseQuery !== null) {
        // A reopen that interrupts the exit never unmounts, so it settles the pending reset too.
        setCloseQuery(null);
        settlePendingReset();
      }
    },
  );

  onCleanup(() => {
    if (pendingReset) {
      settlePendingReset();
    }
  });

  return () => {
    const query = closeQuery();
    return !parameters.open && query !== null ? query : parameters.value;
  };
}
