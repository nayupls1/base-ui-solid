import type { JSX } from '@solidjs/web';
import { createMemo, omit, untrack } from 'solid-js';
import type { BaseUIComponentProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import {
  useComboboxDerivedItemsContext,
  useComboboxRootContext,
} from '../root/ComboboxRootContext';
import { useComboboxPositionerContext } from '../positioner/ComboboxPositionerContext';
import { ComboboxCollection } from '../collection/ComboboxCollection';
import { CompositeList } from '../../internals/composite/list/CompositeList';
import { stopEvent } from '../../utils/popups/event';
import { clickHighlightedItem } from '../utils/parts';
import { mergeProps } from '../../merge-props';
import { ownedProps } from '../../internals/ownedProps';

/**
 * A list container for the items.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export function ComboboxList(componentProps: ComboboxList.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'children', 'ref');

  const store = useComboboxRootContext();
  const hasPositionerContext = Boolean(useComboboxPositionerContext(true));
  const derivedItems = useComboboxDerivedItemsContext();

  const selectionMode = store.useState('selectionMode');
  const grid = store.useState('grid');
  const readOnly = store.useState('readOnly');
  const listProps = store.useState('listProps');
  const forceMounted = store.useState('forceMounted');
  const defaultPopupId = store.useState('defaultPopupId');

  const multiple = () => selectionMode() === 'multiple';
  const empty = () => derivedItems.filteredItems.length === 0;

  const setPositionerElement = store.useStateSetter('positionerElement');
  const setListElement = store.useStateSetter('listElement');

  // Support "closed template" API: if children is a function, implicitly wrap it
  // with a Combobox.Collection that reads items from context/root.
  const resolvedChildren = (): JSX.Element => {
    const children = componentProps.children as any;
    if (typeof children === 'function') {
      return <ComboboxCollection>{children}</ComboboxCollection>;
    }
    return children;
  };

  const state = createMemo<ComboboxListState>(() => ({
    empty: empty(),
  }));

  const element = () =>
    useRenderElement('div', componentProps as any, {
      state,
      ref: [setListElement as any, hasPositionerContext ? null : (setPositionerElement as any)],
      props: [
        (merged: Record<string, any>) => mergeProps(merged, listProps() as any),
        {
          tabindex: -1,
          get id() {
            return defaultPopupId();
          },
          get role() {
            return grid() ? 'grid' : 'listbox';
          },
          get 'aria-multiselectable'() {
            return multiple() ? 'true' : undefined;
          },
          // On a grid the attribute describes cell editability, not selection, so it's left to the
          // combobox element in that mode.
          get 'aria-readonly'() {
            return !grid() && readOnly() ? true : undefined;
          },
          onKeyDown(event: KeyboardEvent) {
            if (store.state.disabled || store.state.readOnly) {
              return;
            }

            if (event.key === 'Enter') {
              const activeIndex = store.state.activeIndex;

              if (activeIndex == null) {
                // Allow form submission when no item is highlighted.
                return;
              }

              stopEvent(event);
              clickHighlightedItem(store, activeIndex, event);
            }
          },
        } as any,
        elementProps,
      ],
      children: resolvedChildren,
    });

  if (untrack(() => store.select('virtualized'))) {
    return untrack(element);
  }

  // With the `items` prop, typeahead labels are derived from the items so they survive the list
  // unmounting (unmounting clears the registered labels). Rendered labels only need to be
  // registered when the list is force-mounted to match browser autofill against rendered text.
  return (
    <CompositeList
      elementsRef={store.context.listRef}
      labelsRef={derivedItems.hasItems && !forceMounted() ? undefined : store.context.labelsRef}
    >
      {untrack(element)}
    </CompositeList>
  );
}

export interface ComboboxListState {
  /**
   * Whether the list is empty.
   */
  empty: boolean;
}

export interface ComboboxListProps extends Omit<
  BaseUIComponentProps<'div', ComboboxListState>,
  'children'
> {
  children?: JSX.Element | ((item: any, index: number) => JSX.Element);
}

export namespace ComboboxList {
  export type State = ComboboxListState;
  export type Props = ComboboxListProps;
}
