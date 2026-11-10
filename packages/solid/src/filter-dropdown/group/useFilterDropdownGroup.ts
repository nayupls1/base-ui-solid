import { createEffect, type Accessor } from 'solid-js';
import { useStore } from '@base-ui-solid/utils/store';
import { useFilterDropdownItemContext } from '../root/FilterDropdownRootContext';
import type { FilterDropdownGroupContext } from './FilterDropdownGroupContext';
import { useFilterDropdownGroupContext } from './FilterDropdownGroupContext';
import type { State as StoreState } from '../store';
import { useItemRegistry } from '../../internals/useItemRegistry';

function isGroupHidden(state: StoreState, items: ReadonlyMap<symbol, boolean>) {
  // A group with no members hasn't been filtered out, it hasn't registered yet.
  if (state.visibleItemIds === null || items.size === 0) {
    return false;
  }
  for (const [id, retained] of items) {
    if (retained || state.visibleItemIds.has(id)) {
      return false;
    }
  }
  return true;
}

export interface UseFilterDropdownGroupReturnValue {
  hidden: Accessor<boolean>;
  context: FilterDropdownGroupContext;
}

/**
 * Collects the items of a group and reports whether every one of them is filtered out.
 */
export function useFilterDropdownGroup(): UseFilterDropdownGroupReturnValue {
  const { store } = useFilterDropdownItemContext();
  const parentContext = useFilterDropdownGroupContext();

  const { items, registerItem } = useItemRegistry<symbol, boolean>();
  const hidden = useStore(store, (state: StoreState) => isGroupHidden(state, items()));

  // A nested container collects its own items, so the enclosing one only ever sees this
  // registration. Report visibility upward or a group of groups would look empty.
  const groupId = Symbol('filter-dropdown-group');
  const registerInParent = parentContext?.registerItem;

  createEffect(hidden, (isHidden) => registerInParent?.(groupId, !isHidden));

  return { hidden, context: { registerItem } };
}
