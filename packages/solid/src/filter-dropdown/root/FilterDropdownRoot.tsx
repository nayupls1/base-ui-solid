import type { JSX } from '@solidjs/web';
import type { RefObject } from 'base-ui-solidjs-utils/types';
import { createEffect, createMemo, createSignal, untrack, useContext } from 'solid-js';
import { getFilter } from '../../internals/filter';
import { useBaseUiId } from '../../internals/useBaseUiId';
import { useItemRegistry } from '../../internals/useItemRegistry';
import {
  FilterDropdownRootContext,
  FilterDropdownItemContext,
  FilterDropdownValueContext,
} from './FilterDropdownRootContext';
import type {
  FilterDropdownItemRegistration,
  FilterDropdownFilter,
  FilterDropdownRoot as FilterDropdownRootNamespace,
} from './FilterDropdownRootContext';
import { FilterDropdownStore } from '../store';

/**
 * Filters the items registered below it against a query and tracks the list's highlight.
 * The host component (such as a filterable menu) owns the open state and the list navigation.
 * Props are read lazily, so they can be getters.
 */
export function FilterDropdownRoot(props: FilterDropdownRoot.Props): JSX.Element {
  const parentItemContext = useContext(FilterDropdownItemContext);

  const openedByKeyboard = () => props.openedByKeyboard ?? false;
  const autoHighlight = () => props.autoHighlight ?? false;

  const [renderedListId, setRenderedListId] = createSignal<string | undefined>(undefined, {
    ownedWrite: true,
  });
  const [inputFocusVisible, setInputFocusVisible] = createSignal(untrack(openedByKeyboard), {
    ownedWrite: true,
  });
  const [keyboardModality, setKeyboardModality] = createSignal(untrack(openedByKeyboard), {
    ownedWrite: true,
  });

  // Both reset when the host reports a new value.
  createEffect(openedByKeyboard, (value, previous) => {
    if (previous === undefined) {
      return;
    }
    setInputFocusVisible(value);
    setKeyboardModality(value);
  });

  const {
    items: registeredItems,
    registerItem: registerInRegistry,
    liveItems,
  } = useItemRegistry<symbol, FilterDropdownItemRegistration>();

  const defaultId = useBaseUiId();
  const store = new FilterDropdownStore();

  // The count is published as items register, not with the next registry snapshot, so a
  // `Menu.Empty` mounting alongside the items never reads a stale zero.
  const registerItem = (id: symbol, item: FilterDropdownItemRegistration) => {
    const unregister = registerInRegistry(id, item);
    store.set('registeredItemCount', liveItems.size);
    return () => {
      unregister();
      store.set('registeredItemCount', liveItems.size);
    };
  };

  const fallbackFocusOwnerRef: RefObject<HTMLElement | null> = { current: null };
  let lastFilterQuery: string | null = null;

  const defaultMatchItem = createMemo(() => getFilter({ locale: props.locale }).contains);

  const focusOwnerRef = untrack(() => props.focusOwnerRef) ?? fallbackFocusOwnerRef;
  const queryValue = () => props.query ?? props.value;
  const filterQuery = createMemo(() => queryValue().trim());
  // An unused inline filter must not re-run auto-highlighting.
  const matchItem = createMemo<FilterDropdownFilter | null>(() =>
    filterQuery() === '' || props.filter === null
      ? null
      : ((props.filter ?? defaultMatchItem()) as FilterDropdownFilter),
  );
  const autoHighlightEnabled = createMemo(
    () =>
      props.open && (autoHighlight() === 'always' || (!!autoHighlight() && filterQuery() !== '')),
  );
  const defaultListId = () => {
    const id = defaultId();
    return id ? `${id}-list` : undefined;
  };
  const listId = () => (renderedListId() ?? defaultListId()) || undefined;
  // The host owns the trigger. `null` and `''` both mean no element carries an id to point at.
  const triggerId = () => props.triggerId || undefined;

  const handleValueChange = (
    nextValue: string,
    eventDetails: FilterDropdownRoot.ChangeEventDetails,
  ) => {
    untrack(() => props.onValueChange)?.(nextValue, eventDetails);
    // Indexes are positional, so a kept highlight would land on whatever fills its slot.
    // With `autoHighlight`, the filtering effect below places the highlight instead.
    if (!eventDetails.isCanceled && !untrack(autoHighlight)) {
      props.setActiveIndex(null);
    }
  };

  const handleItemsChange = (previousItems: readonly (HTMLElement | null)[]) => {
    const items = props.listRef.current;
    const activeIndex = props.getActiveIndex();

    // A positional highlight must not silently move to another item. A change that leaves the
    // highlighted item in place keeps it, such as an item appended after it or one that renders
    // once before the query filters it out. A query change already reset the highlight.
    if (
      activeIndex != null &&
      items[activeIndex] != null &&
      items[activeIndex] === previousItems[activeIndex]
    ) {
      return;
    }

    props.setActiveIndex(untrack(autoHighlightEnabled) && items.length > 0 ? 0 : null);
  };

  // Re-runs on the registry snapshot published once the flush's items have registered, and on
  // the committed query, because a controlled consumer can reject a proposed change. It reads the
  // live registry so items registered in this flush count before their snapshot.
  createEffect(
    () =>
      [
        props.open,
        props.query,
        filterQuery(),
        registeredItems(),
        matchItem(),
        autoHighlightEnabled(),
      ] as const,
    ([open, query, currentQuery, , match, autoHighlighting]) => {
      if (!open && query === undefined) {
        return;
      }

      const queryChanged = lastFilterQuery !== null && lastFilterQuery !== currentQuery;
      lastFilterQuery = currentQuery;

      // With no query or external filtering, every registered item is visible. External
      // filtering still follows `autoHighlight`; otherwise the item set invalidates the highlight.
      if (match === null) {
        store.set('visibleItemIds', null);
        // Registry updates, such as an item's text changing, keep the current highlight.
        if (autoHighlighting && liveItems.size > 0) {
          if (queryChanged || props.getActiveIndex() == null) {
            props.setActiveIndex(0);
          }
        } else if (currentQuery === '' && queryChanged) {
          props.setActiveIndex(null);
        }
        return;
      }

      const currentIds = store.state.visibleItemIds;
      // The popup's content mounts after the root opens. Publishing an empty result before
      // anything registered would hide every item as it arrives and remount the matches.
      if (currentIds === null && liveItems.size === 0) {
        return;
      }

      const nextIds = new Set<symbol>();
      let hasNewMatch = currentIds === null;
      liveItems.forEach(({ getText }, id) => {
        const text = getText();
        if (text != null && match(text, currentQuery)) {
          nextIds.add(id);
          hasNewMatch ||= !currentIds?.has(id);
        }
      });

      // New matches or a smaller result set invalidate the previous item identities.
      if (hasNewMatch || currentIds?.size !== nextIds.size) {
        if (autoHighlighting && nextIds.size > 0) {
          props.setActiveIndex(0);
        } else if (currentIds !== null || queryChanged) {
          props.setActiveIndex(null);
        }
        store.set('visibleItemIds', nextIds);
      } else if (autoHighlighting && queryChanged && nextIds.size > 0) {
        props.setActiveIndex(0);
      }
    },
  );

  const contextValue: FilterDropdownRootContext = {
    get open() {
      return props.open;
    },
    get disabled() {
      return props.disabled ?? false;
    },
    get inputFocusVisible() {
      return inputFocusVisible();
    },
    setInputFocusVisible,
    get keyboardModality() {
      return keyboardModality();
    },
    setKeyboardModality,
    get autoHighlight() {
      return autoHighlight();
    },
    get triggerId() {
      return triggerId();
    },
    get defaultListId() {
      return defaultListId();
    },
    get listId() {
      return listId();
    },
    setRenderedListId: (id) => setRenderedListId(() => id),
    focusOwnerRef,
    setActiveIndex: (index) => props.setActiveIndex(index),
    onItemsChange: handleItemsChange,
    onValueChange: handleValueChange,
  };

  const itemContextValue: FilterDropdownItemContext = {
    parent: parentItemContext,
    store,
    registerItem,
    get listRef() {
      return props.listRef;
    },
  };

  return (
    <FilterDropdownItemContext value={itemContextValue}>
      <FilterDropdownRootContext value={contextValue}>
        <FilterDropdownValueContext value={queryValue}>{props.children}</FilterDropdownValueContext>
      </FilterDropdownRootContext>
    </FilterDropdownItemContext>
  );
}

export interface FilterDropdownRootProps {
  children?: JSX.Element;
  open: boolean;
  disabled?: boolean | undefined;
  openedByKeyboard?: boolean | undefined;
  locale?: Intl.LocalesArgument | undefined;
  value: string;
  query?: string | undefined;
  onValueChange?:
    | ((value: string, eventDetails: FilterDropdownRootNamespace.ChangeEventDetails) => void)
    | undefined;
  filter?: FilterDropdownFilter | null | undefined;
  autoHighlight?: boolean | 'always' | undefined;
  triggerId?: string | null | undefined;
  listRef: RefObject<Array<HTMLElement | null>>;
  getActiveIndex: () => number | null;
  setActiveIndex: (index: number | null) => void;
  focusOwnerRef?: RefObject<HTMLElement | null> | undefined;
}

export namespace FilterDropdownRoot {
  export type Props = FilterDropdownRootProps;
  export type ChangeEventReason = FilterDropdownRootNamespace.ChangeEventReason;
  export type ChangeEventDetails = FilterDropdownRootNamespace.ChangeEventDetails;
}
