import { omit } from 'solid-js';
import type { BaseUIComponentProps, NativeButtonProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useButton } from '../../internals/use-button';
import { useComboboxRootContext } from '../root/ComboboxRootContext';
import { useComboboxChipContext } from '../chip/ComboboxChipContext';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { getHighlightReason } from '../../utils/getHighlightReason';
import { findItemIndex } from '../../internals/itemEquality';
import { stopEvent } from '../../utils/popups/event';
import { ownedProps } from '../../internals/ownedProps';

/**
 * A button to remove a chip.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export function ComboboxChipRemove(componentProps: ComboboxChipRemove.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'disabled',
    'nativeButton',
    'style',
    'children',
    'ref',
  );

  const store = useComboboxRootContext();
  const chip = useComboboxChipContext();

  const comboboxDisabled = store.useState('disabled');
  const readOnly = store.useState('readOnly');

  const disabled = () => Boolean(comboboxDisabled() || (componentProps.disabled ?? false));

  const { buttonRef, getButtonProps } = useButton({
    get native() {
      return componentProps.nativeButton ?? true;
    },
    get disabled() {
      return Boolean(disabled() || readOnly());
    },
    focusableWhenDisabled: true,
  });

  const state = (): ComboboxChipRemoveState => ({
    disabled: disabled(),
  });

  function clearActiveIndexForRemovedItem(removedItem: any, event: Event) {
    const activeIndex = store.state.activeIndex;

    if (activeIndex == null) {
      return;
    }

    // Try current visible list first; if not found, it's filtered out.
    // No need to clear highlight in that case since it can't equal activeIndex.
    const removedIndex = findItemIndex(
      store.context.valuesRef.current,
      removedItem,
      store.state.isItemEqualToValue,
    );
    if (removedIndex !== -1 && activeIndex === removedIndex) {
      store.context.setIndices({
        activeIndex: null,
        type: getHighlightReason(event as any),
        event,
      });
    }
  }

  function removeChip(event: MouseEvent | KeyboardEvent) {
    const eventDetails = createChangeEventDetails(REASONS.chipRemovePress, event);
    const selectedValue = store.state.selectedValue as any[];
    const index = chip.index;
    const removedItem = selectedValue[index];

    clearActiveIndexForRemovedItem(removedItem, event);

    store.context.setSelectedValue(
      selectedValue.filter((_: any, i: number) => i !== index),
      eventDetails,
    );

    store.context.inputRef.current?.focus();
    return eventDetails;
  }

  return useRenderElement('button', componentProps, {
    ref: buttonRef,
    state,
    props: [
      {
        tabindex: -1,
        onMouseDown(event: MouseEvent) {
          event.preventDefault();
        },
        onClick(event: MouseEvent) {
          const eventDetails = removeChip(event);
          if (!eventDetails.isPropagationAllowed) {
            event.stopPropagation();
          }
        },
        onKeyDown(event: KeyboardEvent) {
          if (event.key === 'Enter' || event.key === ' ') {
            const eventDetails = removeChip(event);
            if (!eventDetails.isPropagationAllowed) {
              stopEvent(event);
            }
          }
        },
      } as any,
      elementProps,
      getButtonProps,
    ],
  });
}

export interface ComboboxChipRemoveState {
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
}

export interface ComboboxChipRemoveProps
  extends NativeButtonProps, BaseUIComponentProps<'button', ComboboxChipRemoveState> {}

export namespace ComboboxChipRemove {
  export type State = ComboboxChipRemoveState;
  export type Props = ComboboxChipRemoveProps;
}
