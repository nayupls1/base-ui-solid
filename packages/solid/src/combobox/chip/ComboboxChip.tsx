import { flush, omit, untrack } from 'solid-js';
import type { BaseUIComponentProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useComboboxRootContext } from '../root/ComboboxRootContext';
import { useComboboxChipsContext } from '../chips/ComboboxChipsContext';
import { ComboboxChipContext } from './ComboboxChipContext';
import { useCompositeListItem } from '../../internals/composite/list/useCompositeListItem';
import { stopEvent } from '../../utils/popups/event';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { useDirection } from '../../internals/direction-context/DirectionContext';
import { getChipNavigationKeys, getIndexAfterChipRemoval } from '../utils/parts';
import { ownedProps } from '../../internals/ownedProps';

/**
 * An individual chip that represents a value in a multiselectable input.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export function ComboboxChip(componentProps: ComboboxChip.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'children', 'ref');

  const store = useComboboxRootContext();
  const { chipsRef } = useComboboxChipsContext()!;
  const direction = useDirection();

  const disabled = store.useState('disabled');
  const readOnly = store.useState('readOnly');

  const listItem = useCompositeListItem();
  const index = () => listItem.index() as number;

  function handleKeyDown(event: KeyboardEvent) {
    const currentIndex = untrack(index);
    const selectedValue = store.state.selectedValue as any[];
    let nextIndex: number | undefined = currentIndex;
    const [previousChipKey, nextChipKey] = getChipNavigationKeys(untrack(direction));

    if (event.key === previousChipKey) {
      event.preventDefault();
      if (currentIndex > 0) {
        nextIndex = currentIndex - 1;
      } else {
        nextIndex = undefined;
      }
    } else if (event.key === nextChipKey) {
      event.preventDefault();
      if (currentIndex < chipsRef.current.length - 1) {
        nextIndex = currentIndex + 1;
      } else {
        nextIndex = undefined;
      }
    } else if (event.key === 'Backspace' || event.key === 'Delete') {
      nextIndex = getIndexAfterChipRemoval(currentIndex, selectedValue.length);

      stopEvent(event);

      // Commit the removal before focusing so `chipsRef` reflects the remaining chips.
      store.context.setIndices({
        activeIndex: null,
        selectedIndex: null,
        type: REASONS.keyboard,
        event,
      });
      store.context.setSelectedValue(
        selectedValue.filter((_: any, i: number) => i !== currentIndex),
        createChangeEventDetails(REASONS.none, event),
      );
      flush();
    } else if (event.key === 'Enter' || event.key === ' ') {
      stopEvent(event);
      nextIndex = undefined;
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      stopEvent(event);
      // The input may mount when opening.
      store.setOpen(true, createChangeEventDetails(REASONS.listNavigation, event) as any);
      flush();
      nextIndex = undefined;
    } else if (
      // Check for printable characters (letters, numbers, symbols)
      event.key.length === 1 &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      nextIndex = undefined;
    }

    return nextIndex;
  }

  const state = (): ComboboxChipState => ({
    disabled: disabled(),
  });

  const contextValue = {
    get index() {
      return index();
    },
  };

  return (
    <ComboboxChipContext value={contextValue as any}>
      {untrack(() =>
        useRenderElement('div', componentProps, {
          ref: listItem.ref,
          state,
          props: [
            {
              tabindex: -1,
              get 'aria-disabled'() {
                return disabled() || undefined;
              },
              get 'aria-readonly'() {
                return readOnly() || undefined;
              },
              onKeyDown(event: KeyboardEvent) {
                if (store.state.disabled || store.state.readOnly) {
                  return;
                }

                const nextIndex = handleKeyDown(event);

                if (nextIndex === undefined) {
                  store.context.inputRef.current?.focus();
                } else {
                  chipsRef.current[nextIndex]?.focus();
                }
              },
            } as any,
            elementProps,
          ],
        }),
      )}
    </ComboboxChipContext>
  );
}

export interface ComboboxChipState {
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
}

export interface ComboboxChipProps extends BaseUIComponentProps<'div', ComboboxChipState> {}

export namespace ComboboxChip {
  export type State = ComboboxChipState;
  export type Props = ComboboxChipProps;
}
