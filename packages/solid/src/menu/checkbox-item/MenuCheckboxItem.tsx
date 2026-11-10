import { createMemo, omit, Show, untrack } from 'solid-js';
import { NOOP } from '@base-ui-solid/utils/empty';
import { useControlled } from '@base-ui-solid/utils/useControlled';
import { useMenuFilterItem } from '../filter-root/MenuFilterContext';
import { MenuCheckboxItemContext } from './MenuCheckboxItemContext';
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

function MenuCheckboxItemPlain(componentProps: MenuCheckboxItem.Props) {
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
    'checked',
    'onCheckedChange',
    'defaultChecked',
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
  const checked = () => componentProps.checked ?? false;

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

  const state = createMemo<MenuCheckboxItemState>(() => ({
    disabled: disabled(),
    highlighted: highlighted(),
    checked: checked(),
  }));

  function handleClick(event: MouseEvent) {
    const details = createChangeEventDetails(REASONS.itemPress, event, undefined, {
      preventUnmountOnClose: NOOP,
    });

    componentProps.onCheckedChange?.(!checked(), details as any);
  }

  const contextValue: MenuCheckboxItemContext = {
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
    <MenuCheckboxItemContext value={contextValue}>
      {untrack(() =>
        useRenderElement('div', componentProps, {
          state,
          stateAttributesMapping: itemMapping,
          props: [
            (merged: Record<string, any>) => mergeProps(merged, itemProps()),
            {
              role: 'menuitemcheckbox',
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
    </MenuCheckboxItemContext>
  );
}

/**
 * A menu item that toggles a setting on or off.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export function MenuCheckboxItem(props: MenuCheckboxItem.Props) {
  props = ownedProps(props);
  const plainProps = omit(props, 'checked', 'defaultChecked', 'onCheckedChange');

  // Owned above the element so an uncontrolled item keeps its state while a filter hides it.
  const [checked, setChecked] = useControlled({
    controlled: () => props.checked,
    default: untrack(() => props.defaultChecked ?? false),
    name: 'MenuCheckboxItem',
    state: 'checked',
  });

  const filterItem = useMenuFilterItem(props);

  function handleCheckedChange(
    nextChecked: boolean,
    eventDetails: MenuCheckboxItem.ChangeEventDetails,
  ) {
    props.onCheckedChange?.(nextChecked, eventDetails);
    if (!eventDetails.isCanceled) {
      setChecked(nextChecked);
    }
  }

  return (
    <Show when={filterItem.visible()}>
      <MenuCheckboxItemPlain
        {...plainProps}
        checked={checked()}
        onCheckedChange={handleCheckedChange}
        ref={[props.ref, filterItem.ref] as any}
      />
    </Show>
  );
}

export interface MenuCheckboxItemState {
  /**
   * Whether the checkbox item should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Whether the checkbox item is currently highlighted.
   */
  highlighted: boolean;
  /**
   * Whether the checkbox item is currently ticked.
   */
  checked: boolean;
}

export interface MenuCheckboxItemProps
  extends NonNativeButtonProps, BaseUIComponentProps<'div', MenuCheckboxItemState> {
  /**
   * Whether the checkbox item is currently ticked.
   *
   * To render an uncontrolled checkbox item, use the `defaultChecked` prop instead.
   */
  checked?: boolean | undefined;
  /**
   * Whether the checkbox item is initially ticked.
   *
   * To render a controlled checkbox item, use the `checked` prop instead.
   * @default false
   */
  defaultChecked?: boolean | undefined;
  /**
   * Event handler called when the checkbox item is ticked or unticked.
   */
  onCheckedChange?:
    ((checked: boolean, eventDetails: MenuCheckboxItem.ChangeEventDetails) => void) | undefined;
  /**
   * The click handler for the menu item.
   */
  onClick?: BaseUIComponentProps<'div', MenuCheckboxItemState>['onClick'] | undefined;
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

export type MenuCheckboxItemChangeEventReason = MenuRoot.ChangeEventReason;
export type MenuCheckboxItemChangeEventDetails = MenuRoot.ChangeEventDetails;

export namespace MenuCheckboxItem {
  export type State = MenuCheckboxItemState;
  export type Props = MenuCheckboxItemProps;
  export type ChangeEventReason = MenuCheckboxItemChangeEventReason;
  export type ChangeEventDetails = MenuCheckboxItemChangeEventDetails;
}
