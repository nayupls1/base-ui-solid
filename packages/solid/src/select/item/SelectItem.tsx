import type { JSX } from '@solidjs/web';
import { createEffect, createMemo, omit, untrack } from 'solid-js';
import type { RefObject } from '@base-ui-solid/utils/types';
import { useSelectRootContext } from '../root/SelectRootContext';
import { useCompositeListItem } from '../../internals/composite/list/useCompositeListItem';
import type { BaseUIComponentProps, BaseUIEvent, HTMLProps, NonNativeButtonProps } from '../../internals/types';
import { SelectItemContext } from './SelectItemContext';
import { useRenderElement } from '../../internals/useRenderElement';
import { useButton } from '../../internals/use-button';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import {
  compareItemEquality,
  removeItem,
  resolveSelectedIndex,
} from '../../internals/itemEquality';
import { isVirtualClick } from '../../utils/popups/event';
import { mergeProps } from '../../merge-props';
import { ownedProps } from '../../internals/ownedProps';

/**
 * An individual option in the select popup.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Select](https://base-ui.com/react/components/select)
 */
export function SelectItem(componentProps: SelectItem.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'style',
    'value',
    'label',
    'disabled',
    'nativeButton',
    'children',
    'ref',
  );
  const itemValue = () => componentProps.value ?? null;

  const textRef: RefObject<HTMLElement | null> = { current: null };
  const listItem = useCompositeListItem({
    guess: true,
    get label() {
      return componentProps.label;
    },
    textRef,
  } as any);

  const store = useSelectRootContext();
  const itemRoot = store.useState('itemRoot');

  const disabled = () => itemRoot().disabled || (componentProps.disabled ?? false);

  const highlighted = store.useState('isActive', listItem.index);
  const activeWhileOpen = store.useState('isActiveWhileOpen', listItem.index);
  const selected = store.useState('isSelected', itemValue);
  const selectedByFocus = store.useState('isSelectedByFocus', listItem.index);
  const index = listItem.index;

  let itemElement: HTMLDivElement | null = null;

  createEffect(
    () => [index(), itemValue()] as const,
    ([currentIndex, value]) => {
      const values = store.context.valuesRef.current;
      values[currentIndex] = value;

      return () => {
        delete values[currentIndex];
      };
    },
  );

  createEffect(
    () => [index(), itemRoot().multiple, itemRoot().isItemEqualToValue, itemValue()] as const,
    ([currentIndex, multiple, isItemEqualToValue, value]) => {
      const selectedValue = store.state.selectedValue;
      const currentSelectedIndex = store.state.selectedIndex;
      let nextIndex = currentSelectedIndex;
      let claims: boolean;

      if (multiple && Array.isArray(selectedValue)) {
        // The claiming item also owns the text ref that aligns the popup.
        nextIndex = resolveSelectedIndex(
          currentIndex,
          value,
          store.context.valuesRef.current,
          selectedValue,
          isItemEqualToValue,
          currentSelectedIndex,
        );
        claims = nextIndex === currentIndex;
        if (currentIndex === currentSelectedIndex && !claims) {
          store.context.selectedItemTextRef.current = null;
        }
      } else {
        claims =
          selectedValue !== undefined &&
          compareItemEquality(value, selectedValue, isItemEqualToValue);
        if (claims) {
          nextIndex = currentIndex;
        }
      }

      store.set('selectedIndex', nextIndex);

      // Make sure SelectPopup can measure the selected item on first open.
      // SelectItemText can still update this ref later when focus moves.
      if (claims && textRef.current) {
        store.context.selectedItemTextRef.current = textRef.current;
      }
    },
  );

  let pointerType: string = 'mouse';
  let allowMouseSelection = false;

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

  const state = createMemo<SelectItemState>(() => ({
    disabled: disabled(),
    selected: selected(),
    highlighted: highlighted(),
  }));

  function commitSelection(event: MouseEvent | KeyboardEvent | PointerEvent) {
    const root = untrack(itemRoot);
    // A forced-open select (`open`/`defaultOpen`) can still receive item activations even
    // when the root is disabled or read-only, so guard the commit here too.
    if (root.disabled || root.readOnly) {
      return;
    }

    const selectedValue = store.state.selectedValue;
    const value = untrack(itemValue);

    if (root.multiple) {
      const currentValue = Array.isArray(selectedValue) ? selectedValue : [];
      const nextValue = untrack(selected)
        ? removeItem(currentValue, value, root.isItemEqualToValue)
        : [...currentValue, value];
      store.context.setValue(nextValue, createChangeEventDetails(REASONS.itemPress, event) as any);
    } else {
      store.context.setValue(value, createChangeEventDetails(REASONS.itemPress, event) as any);
      store.setOpen(false, createChangeEventDetails(REASONS.itemPress, event) as any);
    }
  }

  function resetDragMovement() {
    store.context.selectionRef.current.dragY = 0;
  }

  const defaultProps: HTMLProps = {
    role: 'option',
    get 'aria-selected'() {
      return selected();
    },
    get tabindex() {
      return activeWhileOpen() ? 0 : -1;
    },
    onKeyDown(event: BaseUIEvent<KeyboardEvent>) {
      store.set('activeIndex', untrack(index));

      if (event.key === ' ' && store.context.typingRef.current) {
        // `useButton` skips Space activation for `role="option"` items when the keydown
        // is `defaultPrevented`, keeping typeahead spaces from committing a selection.
        event.preventDefault();
      }
    },
    onClick(event: MouseEvent) {
      const isMouseClick = pointerType !== 'touch';
      const clickPointerType = (event as PointerEvent).pointerType;
      const isVirtualMouseClick =
        isMouseClick &&
        isVirtualClick(event) &&
        // Generic no-pointer `detail === 0` clicks stay tied to highlight state. Virtual
        // clicks that carry browser pointer data can activate unhighlighted items.
        (clickPointerType !== undefined || untrack(highlighted));

      // With alignItemWithTrigger, opening can place an item under the cursor. Real mouse
      // clicks must start on the item, while virtual clicks represent explicit keyboard or
      // assistive technology activation.
      const isInvalidMouseClick = isMouseClick && !isVirtualMouseClick && !allowMouseSelection;
      allowMouseSelection = false;

      if (untrack(disabled) || isInvalidMouseClick) {
        return;
      }

      commitSelection(event);
    },
    onPointerEnter(event: PointerEvent) {
      pointerType = event.pointerType;
    },
    onPointerMove(event: PointerEvent) {
      if (event.pointerType === 'mouse' && event.buttons === 1) {
        const selection = store.context.selectionRef.current;
        selection.dragY += event.movementY;
        if (selection.dragY ** 2 >= 64) {
          selection.allowUnselectedMouseUp = true;
        }
      }
    },
    onPointerDown(event: PointerEvent) {
      pointerType = event.pointerType;
      allowMouseSelection = true;
      resetDragMovement();
    },
    onMouseUp() {
      resetDragMovement();

      if (untrack(disabled) || pointerType === 'touch') {
        return;
      }

      // Regular clicks are committed by the click event.
      if (allowMouseSelection) {
        return;
      }

      const isSelected = untrack(selected);
      const disallowSelectedMouseUp =
        !store.context.selectionRef.current.allowSelectedMouseUp && isSelected;
      const disallowUnselectedMouseUp =
        !store.context.selectionRef.current.allowUnselectedMouseUp && !isSelected;

      if (disallowSelectedMouseUp || disallowUnselectedMouseUp) {
        return;
      }

      allowMouseSelection = true;
      // Drag selection has no mousedown on the item. Focus it before the synthetic click so
      // arrow-key navigation continues from the selected item.
      itemElement?.focus({ preventScroll: true });
      itemElement?.click();
      allowMouseSelection = false;
    },
  } as any;

  const contextValue: SelectItemContext = {
    get selected() {
      return selected();
    },
    get index() {
      return index();
    },
    textRef,
    get selectedByFocus() {
      return selectedByFocus();
    },
  };

  return (
    <SelectItemContext value={contextValue}>
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
        }),
      )}
    </SelectItemContext>
  );
}

export interface SelectItemState {
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

export interface SelectItemProps
  extends NonNativeButtonProps, Omit<BaseUIComponentProps<'div', SelectItemState>, 'id'> {
  children?: JSX.Element;
  /**
   * A unique value that identifies this select item.
   * @default null
   */
  value?: any;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Specifies the text label to use when the item is matched during keyboard text navigation.
   *
   * Defaults to the item text content if not provided.
   */
  label?: string | undefined;
}

export namespace SelectItem {
  export type State = SelectItemState;
  export type Props = SelectItemProps;
}
