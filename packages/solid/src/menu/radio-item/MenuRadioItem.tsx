import { createMemo, omit, Show, untrack } from 'solid-js';
import { NOOP } from '@base-ui-solid/utils/empty';
import { useMenuFilterItem } from '../filter-root/MenuFilterContext';
import { MenuRadioItemContext } from './MenuRadioItemContext';
import { REGULAR_ITEM, useMenuItem } from '../item/useMenuItem';
import { useCompositeListItem } from '../../internals/composite/list/useCompositeListItem';
import { useMenuRootContext } from '../root/MenuRootContext';
import { useRenderElement } from '../../internals/useRenderElement';
import { useBaseUiId } from '../../internals/useBaseUiId';
import type { BaseUIComponentProps, NonNativeButtonProps } from '../../internals/types';
import { itemMapping } from '../utils/stateAttributesMapping';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import type { MenuRoot } from '../root/MenuRoot';
import { mergeProps } from '../../merge-props';
import { ownedProps } from '../../internals/ownedProps';
import { useMenuRadioGroupContext } from '../radio-group/MenuRadioGroupContext';

function MenuRadioItemPlain(componentProps: MenuRadioItem.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'style',
    'id',
    'label',
    'nativeButton',
    'disabled',
    'closeOnClick',
    'value',
    'children',
    'ref',
  );

  const { store } = useMenuRootContext();
  const group = useMenuRadioGroupContext();

  const listItem = useCompositeListItem({
    guess: true,
    get label() {
      return componentProps.label;
    },
  });
  const id = useBaseUiId(() => componentProps.id);

  const rootDisabled = store.useState('disabled');
  const highlighted = store.useState('isActive', listItem.index);
  const nodeId = store.useState('floatingNodeId');
  const itemProps = store.useState('itemProps');

  const disabled = () => (componentProps.disabled ?? false) || group.disabled || rootDisabled();
  const checked = () => group.value === componentProps.value;

  const { getItemProps, itemRef } = useMenuItem({
    get closeOnClick() {
      return componentProps.closeOnClick ?? false;
    },
    get disabled() {
      return disabled();
    },
    get highlighted() {
      return highlighted();
    },
    get id() {
      return id();
    },
    store,
    get nativeButton() {
      return componentProps.nativeButton ?? false;
    },
    get nodeId() {
      return nodeId();
    },
    itemMetadata: REGULAR_ITEM,
  });

  const state = createMemo<MenuRadioItemState>(() => ({
    disabled: disabled(),
    highlighted: highlighted(),
    checked: checked(),
  }));

  function handleClick(event: MouseEvent) {
    const details = createChangeEventDetails(REASONS.itemPress, event, undefined, {
      preventUnmountOnClose: NOOP,
    });

    group.setValue(componentProps.value, details as any);
  }

  const contextValue: MenuRadioItemContext = {
    get checked() {
      return checked();
    },
    get highlighted() {
      return highlighted();
    },
    get disabled() {
      return disabled();
    },
  };

  return (
    <MenuRadioItemContext value={contextValue}>
      {untrack(() =>
        useRenderElement('div', componentProps, {
          state,
          stateAttributesMapping: itemMapping,
          props: [
            (merged: Record<string, any>) => mergeProps(merged, itemProps()),
            {
              role: 'menuitemradio',
              get 'aria-checked'() {
                return checked();
              },
              onClick: handleClick,
            },
            elementProps,
            getItemProps,
          ],
          ref: [itemRef, listItem.ref],
        }),
      )}
    </MenuRadioItemContext>
  );
}

/**
 * A menu item that works like a radio button in a given group.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export function MenuRadioItem(props: MenuRadioItem.Props) {
  const filterItem = useMenuFilterItem(props);

  return (
    <Show when={filterItem.visible()}>
      <MenuRadioItemPlain {...props} ref={[props.ref, filterItem.ref] as any} />
    </Show>
  );
}

export interface MenuRadioItemState {
  /**
   * Whether the radio item should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Whether the radio item is currently highlighted.
   */
  highlighted: boolean;
  /**
   * Whether the radio item is currently selected.
   */
  checked: boolean;
}

export interface MenuRadioItemProps
  extends NonNativeButtonProps, BaseUIComponentProps<'div', MenuRadioItemState> {
  /**
   * Value of the radio item.
   * This is the value that will be set in the MenuRadioGroup when the item is selected.
   */
  value: any;
  /**
   * The click handler for the menu item.
   */
  onClick?: BaseUIComponentProps<'div', MenuRadioItemState>['onClick'] | undefined;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Overrides the text used for keyboard text navigation and filtering.
   * Falls back to the rendered text when not provided.
   */
  label?: string | undefined;
  /**
   * @ignore
   */
  id?: string | undefined;
  /**
   * Whether to close the menu when the item is clicked.
   * @default false
   */
  closeOnClick?: boolean | undefined;
}

export namespace MenuRadioItem {
  export type State = MenuRadioItemState;
  export type Props = MenuRadioItemProps;
}
