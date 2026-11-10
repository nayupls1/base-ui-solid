import type { JSX } from '@solidjs/web';
import { createMemo, omit, Show } from 'solid-js';
import type { RefObject } from '@base-ui-solid/utils/types';
import { useMenuFilterItem } from '../filter-root/MenuFilterContext';
import { useMenuRootContext } from '../root/MenuRootContext';
import { useRenderElement } from '../../internals/useRenderElement';
import { useBaseUiId } from '../../internals/useBaseUiId';
import type { BaseUIComponentProps, HTMLProps } from '../../internals/types';
import { useCompositeListItem } from '../../internals/composite/list/useCompositeListItem';
import { useMenuItemCommonProps } from '../item/useMenuItemCommonProps';
import { REGULAR_ITEM } from '../item/useMenuItem';
import { useButton } from '../../internals/use-button';
import { mergeProps } from '../../merge-props';
import { ownedProps } from '../../internals/ownedProps';

function MenuLinkItemPlain(componentProps: MenuLinkItem.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'style',
    'id',
    'label',
    'closeOnClick',
    'children',
    'ref',
  );

  const { store } = useMenuRootContext();
  const linkRef: RefObject<HTMLElement | null> = { current: null };

  const listItem = useCompositeListItem({
    guess: true,
    get label() {
      return componentProps.label;
    },
  });
  const id = useBaseUiId(() => componentProps.id);

  const highlighted = store.useState('isActive', listItem.index);
  const nodeId = store.useState('floatingNodeId');
  const itemProps = store.useState('itemProps');
  const typingRef = store.context.typingRef;

  const { getButtonProps, buttonRef } = useButton({
    native: false,
    composite: true,
  });

  const commonProps = useMenuItemCommonProps({
    get closeOnClick() {
      return componentProps.closeOnClick ?? false;
    },
    get highlighted() {
      return highlighted();
    },
    get id() {
      return id();
    },
    get nodeId() {
      return nodeId();
    },
    store,
    typingRef,
    itemRef: linkRef,
    itemMetadata: REGULAR_ITEM,
  });

  function getItemProps(externalProps?: HTMLProps): HTMLProps {
    return mergeProps(commonProps, externalProps, getButtonProps);
  }

  const state = createMemo<MenuLinkItemState>(() => ({ highlighted: highlighted() }));

  return useRenderElement('a', componentProps, {
    state,
    props: [
      (merged: Record<string, any>) => mergeProps(merged, itemProps()),
      elementProps,
      getItemProps,
    ],
    ref: [
      (element: HTMLElement | null) => {
        linkRef.current = element;
      },
      buttonRef,
      listItem.ref,
    ],
  });
}

/**
 * A link in the menu that can be used to navigate to a different page or section.
 * Renders an `<a>` element.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export function MenuLinkItem(props: MenuLinkItem.Props) {
  const filterItem = useMenuFilterItem(props);

  return (
    <Show when={filterItem.visible()}>
      <MenuLinkItemPlain {...props} ref={[props.ref, filterItem.ref] as any} />
    </Show>
  );
}

export interface MenuLinkItemState {
  /**
   * Whether the item is highlighted.
   */
  highlighted: boolean;
}

export interface MenuLinkItemProps extends BaseUIComponentProps<
  'a',
  MenuLinkItemState,
  JSX.IntrinsicElements['a']
> {
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

export namespace MenuLinkItem {
  export type State = MenuLinkItemState;
  export type Props = MenuLinkItemProps;
}
