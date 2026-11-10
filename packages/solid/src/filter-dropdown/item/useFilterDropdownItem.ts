import { createEffect, createSignal, untrack, type Accessor } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { useStore } from '@base-ui-solid/utils/store';
import { useFilterDropdownItemContext } from '../root/FilterDropdownRootContext';
import type { FilterDropdownItemContext } from '../root/FilterDropdownRootContext';
import { useFilterDropdownGroupContext } from '../group/FilterDropdownGroupContext';
import { DETACHED_OWNER, selectors } from '../store';

export interface UseFilterDropdownItemParameters {
  /**
   * Text to filter by instead of the item's rendered text.
   */
  label?: string | undefined;
  /**
   * Whether the enclosing group stays visible even if this item is filtered out.
   */
  retainGroup?: boolean | undefined;
  /**
   * Accepted for parity with the React hook. The Solid port reads the rendered text from the
   * element instead, since reading `children` would create the elements again.
   */
  children?: JSX.Element;
  render?: unknown;
  /**
   * The filter the item registers with, instead of the nearest one. `null` registers nowhere.
   */
  context?: FilterDropdownItemContext | null | undefined;
}

export interface UseFilterDropdownItemReturnValue {
  visible: Accessor<boolean>;
  ref: (element: HTMLElement | null) => void;
}

/**
 * Registers an item with the filter and reports whether it matches the query.
 * Parameters are read lazily, so they can be getters.
 */
export function useFilterDropdownItem(
  params: UseFilterDropdownItemParameters,
): UseFilterDropdownItemReturnValue {
  const explicitContext = untrack(() => params.context);
  const nearestContext = useFilterDropdownItemContext(explicitContext !== undefined);
  const groupContext = useFilterDropdownGroupContext();

  const owner = explicitContext === undefined ? nearestContext : explicitContext;
  const { registerItem, store } = owner ?? DETACHED_OWNER;
  const registerGroupItem = groupContext?.registerItem;

  const itemId = Symbol('filter-dropdown-item');
  let element: HTMLElement | null = null;
  const [elementSignal, setElementSignal] = createSignal<HTMLElement | null>(null, {
    ownedWrite: true,
  });
  let registeredText: string | undefined;

  const matched = useStore(store, selectors.isItemVisible, itemId);

  // An initial item is visible before registration (`visibleItemIds` is null), so start
  // registered. A late item under an active filter starts unregistered and renders once so its
  // DOM text can be captured.
  const [registered, setRegistered] = createSignal(untrack(matched), { ownedWrite: true });

  const resolveText = () => {
    const label = untrack(() => params.label);
    if (label != null) {
      return label;
    }
    if (element !== null) {
      return element.textContent ?? '';
    }
    // A filtered-out item has no DOM node left, so the cached text stands in for it.
    return registeredText;
  };

  // Registers once the element is attached (so its text can be read) and again when the label
  // changes, so the active query runs again.
  createEffect(
    () => [params.label, elementSignal()] as const,
    ([label, el]) => {
      if (label == null && el == null && registeredText === undefined) {
        return undefined;
      }
      const text = resolveText();
      if (text) {
        registeredText = text;
      }
      const unregister = registerItem(itemId, {
        getText() {
          // A mounted item reports what it renders now, even nothing, since a descendant can
          // change its text without the item updating. A filtered-out item falls back to the
          // cached text.
          if (untrack(() => params.label) == null && element) {
            registeredText = element.textContent ?? '';
          }
          return untrack(() => params.label) ?? registeredText;
        },
      });
      setRegistered(true);
      return unregister;
    },
  );

  createEffect(
    () => params.retainGroup ?? false,
    (retainGroup) => registerGroupItem?.(itemId, retainGroup),
  );

  return {
    visible: () => !registered() || matched(),
    ref: (node: HTMLElement | null) => {
      element = node;
      if (node) {
        registeredText = node.textContent ?? registeredText;
      }
      setElementSignal(() => node);
    },
  };
}
