import { createMemo, omit, Show } from 'solid-js';
import { useMenuFilterItem } from '../filter-root/MenuFilterContext';
import { REGULAR_ITEM, useMenuItem } from './useMenuItem';
import { useMenuRootContext } from '../root/MenuRootContext';
import { useRenderElement } from '../../internals/useRenderElement';
import { useBaseUiId } from '../../internals/useBaseUiId';
import type { BaseUIComponentProps, NonNativeButtonProps } from '../../internals/types';
import { useCompositeListItem } from '../../internals/composite/list/useCompositeListItem';
import { mergeProps } from '../../merge-props';
import { ownedProps } from '../../internals/ownedProps';

function MenuItemPlain(componentProps: MenuItem.Props) {
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
    'children',
    'ref',
  );

  const { store } = useMenuRootContext();

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

  const disabled = () => (componentProps.disabled ?? false) || rootDisabled();

  const { getItemProps, itemRef } = useMenuItem({
    get closeOnClick() {
      return componentProps.closeOnClick ?? true;
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

  const state = createMemo<MenuItemState>(() => ({
    disabled: disabled(),
    highlighted: highlighted(),
  }));

  return useRenderElement('div', componentProps, {
    state,
    props: [
      (merged: Record<string, any>) => mergeProps(merged, itemProps()),
      elementProps,
      getItemProps,
    ],
    ref: [itemRef, listItem.ref],
  });
}

/**
 * An individual interactive item in the menu.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export function MenuItem(props: MenuItem.Props) {
  const filterItem = useMenuFilterItem(props);

  return (
    <Show when={filterItem.visible()}>
      <MenuItemPlain {...props} ref={[props.ref, filterItem.ref] as any} />
    </Show>
  );
}

export interface MenuItemState {
  /**
   * Whether the item should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Whether the item is highlighted.
   */
  highlighted: boolean;
}

export interface MenuItemProps
  extends NonNativeButtonProps, BaseUIComponentProps<'div', MenuItemState> {
  /**
   * The click handler for the menu item.
   */
  onClick?: BaseUIComponentProps<'div', MenuItemState>['onClick'] | undefined;
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
   *
   * @default true
   */
  closeOnClick?: boolean | undefined;
}

export namespace MenuItem {
  export type State = MenuItemState;
  export type Props = MenuItemProps;
}
