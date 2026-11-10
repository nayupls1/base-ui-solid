import { createEffect, createMemo, flush, omit, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { RefObject } from 'base-ui-solidjs-utils/types';
import {
  useComboboxRootContext,
  useComboboxHasItemsContext,
  useComboboxDerivedItemsContext,
} from '../root/ComboboxRootContext';
import { useCompositeListItem } from '../../internals/composite/list/useCompositeListItem';
import type { BaseUIComponentProps, HTMLProps, NonNativeButtonProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { ComboboxItemContext } from './ComboboxItemContext';
import { useButton } from '../../internals/use-button';
import { useComboboxRowContext } from '../row/ComboboxRowContext';
import {
  compareItemEquality,
  findItemIndex,
  resolveSelectedIndex,
} from '../../internals/itemEquality';
import { mergeProps } from '../../merge-props';
import { ownedProps } from '../../internals/ownedProps';

function ComboboxItemInner(props: {
  componentProps: ComboboxItem.Props;
  virtualized: boolean;
  indexFromFilter: (() => number | undefined) | undefined;
}) {
  const componentProps = props.componentProps;
  const virtualized = untrack(() => props.virtualized);
  const indexFromFilter = props.indexFromFilter;
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'style',
    'value',
    'index',
    'disabled',
    'nativeButton',
    'children',
    'ref',
  );

  const itemValue = () => componentProps.value ?? null;
  const indexProp = () => componentProps.index;

  const textRef: RefObject<HTMLElement | null> = { current: null };
  const listItem = useCompositeListItem({
    guess: true,
    get index() {
      return indexProp();
    },
    textRef,
  } as any);

  const store = useComboboxRootContext();
  const isRow = useComboboxRowContext();
  const hasItems = useComboboxHasItemsContext();

  const itemRoot = store.useState('itemRoot');

  const disabled = () => itemRoot().disabled || (componentProps.disabled ?? false);
  const selectable = () => itemRoot().selectionMode !== 'none';
  const index = createMemo(
    () => indexProp() ?? indexFromFilter?.() ?? (listItem.index() as number),
  );
  const hasRegistered = () => index() !== -1;

  const highlighted = store.useState('isActive', index);
  const matchesSelectedValue = store.useState('isSelected', itemValue);

  let itemElement: HTMLDivElement | null = null;

  const id = () => {
    const rootId = itemRoot().id;
    return rootId != null && hasRegistered() ? `${rootId}-${index()}` : undefined;
  };
  const selected = () => matchesSelectedValue() && selectable();

  createEffect(
    () => [hasRegistered(), index(), indexProp()] as const,
    ([registered, currentIndex, explicitIndex]) => {
      const shouldRun = registered && (virtualized || explicitIndex != null);
      if (!shouldRun) {
        return undefined;
      }

      const list = store.context.listRef.current;
      list[currentIndex] = itemElement;

      return () => {
        delete list[currentIndex];
      };
    },
  );

  createEffect(
    () => [hasRegistered(), index(), itemValue()] as const,
    ([registered, currentIndex, value]) => {
      if (!registered || hasItems) {
        return undefined;
      }

      const visibleValues = store.context.valuesRef.current;
      visibleValues[currentIndex] = value;

      return () => {
        delete visibleValues[currentIndex];
      };
    },
  );

  createEffect(
    () => [hasRegistered(), index(), itemValue(), itemRoot().isItemEqualToValue] as const,
    ([registered, currentIndex, value, isItemEqualToValue]) => {
      if (!registered || hasItems) {
        return;
      }

      // Runs while closed as well (the list can stay mounted via `keepMounted` or a
      // force-mount) so the index tracks the item's composite position, keeping features
      // like closed-trigger typeahead in sync when the rendered order changes.
      const selectedValue = store.state.selectedValue;

      let nextIndex = store.state.selectedIndex;
      if (store.state.selectionMode === 'multiple' && Array.isArray(selectedValue)) {
        nextIndex = resolveSelectedIndex(
          currentIndex,
          value,
          store.context.valuesRef.current,
          selectedValue,
          isItemEqualToValue,
          nextIndex,
        );
      } else if (compareItemEquality(value, selectedValue, isItemEqualToValue)) {
        nextIndex = currentIndex;
      }
      store.set('selectedIndex', nextIndex);
    },
  );

  const { getButtonProps, buttonRef } = useButton({
    get disabled() {
      return disabled();
    },
    focusableWhenDisabled: true,
    get native() {
      return componentProps.nativeButton ?? false;
    },
    composite: true,
  });

  const state = createMemo<ComboboxItemState>(() => ({
    disabled: disabled(),
    selected: selected(),
    highlighted: highlighted(),
  }));

  function commitSelection(nativeEvent: MouseEvent) {
    function selectItem() {
      store.context.handleSelection(nativeEvent, untrack(itemValue));
    }

    if (store.state.submitOnItemClick) {
      selectItem();
      flush();
      store.context.requestSubmit();
    } else {
      selectItem();
    }
  }

  const defaultProps: HTMLProps = {
    get id() {
      return id();
    },
    role: isRow ? 'gridcell' : 'option',
    get 'aria-selected'() {
      return selectable() ? selected() : undefined;
    },
    // Focusable items steal focus from the input upon mouseup.
    tabindex: undefined,
    onPointerDown(event: PointerEvent) {
      // The compat `mouseup` only fires for the primary pointer, so a non-primary
      // touch must not overwrite the shared ref — a mismatch would make the primary
      // pointer's release read as a drag-select and commit a second time after `click`.
      if (event.isPrimary) {
        store.context.pointerDownItemRef.current = event.currentTarget as Element;
      }
      event.preventDefault();
    },
    onMouseDown(event: MouseEvent) {
      // iOS Safari can emit a synthetic mousedown for touch taps without a preceding
      // pointerdown. Prevent default here too so tapping an item does not blur the input.
      event.preventDefault();
    },
    onClick(event: MouseEvent) {
      if (untrack(disabled) || store.state.readOnly) {
        return;
      }

      commitSelection(event);
    },
    onMouseUp(event: MouseEvent) {
      const pointerStartedOnItem = store.context.pointerDownItemRef.current === event.currentTarget;
      store.context.pointerDownItemRef.current = null;

      if (
        untrack(disabled) ||
        store.state.readOnly ||
        event.button !== 0 ||
        pointerStartedOnItem ||
        !untrack(highlighted)
      ) {
        return;
      }

      commitSelection(event);
    },
  } as any;

  const contextValue: ComboboxItemContext = {
    get selected() {
      return selected();
    },
    textRef,
  };

  return (
    <ComboboxItemContext value={contextValue}>
      {untrack(() =>
        useRenderElement('div', componentProps, {
          ref: [
            buttonRef,
            listItem.ref,
            (el: HTMLDivElement | null) => {
              itemElement = el;
            },
          ],
          state,
          props: [
            (merged: Record<string, any>) => mergeProps(merged, itemRoot().props),
            defaultProps,
            elementProps,
            getButtonProps,
          ],
          children: () => componentProps.children,
        }),
      )}
    </ComboboxItemContext>
  );
}

function ComboboxItemVirtualizedIndex(props: { componentProps: ComboboxItem.Props }) {
  const store = useComboboxRootContext();
  const isItemEqualToValue = store.useState('isItemEqualToValue');
  const derivedItems = useComboboxDerivedItemsContext();

  const indexFromFilter = () =>
    findItemIndex(
      derivedItems.flatFilteredValues,
      props.componentProps.value ?? null,
      isItemEqualToValue() as any,
    );

  // Only reached when `virtualized` is true (see the wrapper below).
  return (
    <ComboboxItemInner
      componentProps={props.componentProps}
      virtualized
      indexFromFilter={indexFromFilter}
    />
  );
}

/**
 * An individual item in the list.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export function ComboboxItem(componentProps: ComboboxItem.Props): JSX.Element {
  componentProps = ownedProps(componentProps);
  const store = useComboboxRootContext();
  const virtualized = untrack(() => store.select('virtualized'));

  // `virtualized` (and whether an item provides an explicit `index`) must be stable for an
  // item's lifetime.
  if (virtualized && untrack(() => componentProps.index) == null) {
    return <ComboboxItemVirtualizedIndex componentProps={componentProps} />;
  }

  return (
    <ComboboxItemInner
      componentProps={componentProps}
      virtualized={virtualized}
      indexFromFilter={undefined}
    />
  );
}

export interface ComboboxItemState {
  /**
   * Whether the item should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Whether the item is selected.
   */
  selected: boolean;
  /**
   * Whether the item is highlighted.
   */
  highlighted: boolean;
}

export interface ComboboxItemProps
  extends NonNativeButtonProps, Omit<BaseUIComponentProps<'div', ComboboxItemState>, 'id'> {
  children?: JSX.Element;
  /**
   * An optional click handler for the item when selected.
   * It fires when clicking the item with the pointer, as well as when pressing `Enter` with the keyboard if the item is highlighted when the `Input` or `List` element has focus.
   */
  onClick?: BaseUIComponentProps<'div', ComboboxItemState>['onClick'] | undefined;
  /**
   * The index of the item in the list. Improves performance when specified by avoiding the need to calculate the index automatically from the DOM.
   */
  index?: number | undefined;
  /**
   * A unique value that identifies this item.
   * @default null
   */
  value?: any;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
}

export namespace ComboboxItem {
  export type State = ComboboxItemState;
  export type Props = ComboboxItemProps;
}
