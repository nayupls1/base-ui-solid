import type { RefObject } from '@base-ui-solid/utils/types';
import { useButton } from '../../internals/use-button';
import { mergeProps } from '../../merge-props';
import type { HTMLProps } from '../../internals/types';
import type { MenuStore } from '../store/MenuStore';
import { useMenuItemCommonProps } from './useMenuItemCommonProps';

export const REGULAR_ITEM = {
  type: 'regular-item' as const,
};

/**
 * Parameters are read lazily, so they can be getters.
 */
export function useMenuItem(params: UseMenuItemParameters): UseMenuItemReturnValue {
  const itemRef: RefObject<HTMLElement | null> = { current: null };

  const { getButtonProps, buttonRef } = useButton({
    get disabled() {
      return params.disabled;
    },
    focusableWhenDisabled: true,
    get native() {
      return params.nativeButton;
    },
    composite: true,
  });

  const commonProps = useMenuItemCommonProps({
    get closeOnClick() {
      return params.closeOnClick;
    },
    get highlighted() {
      return params.highlighted;
    },
    get id() {
      return params.id;
    },
    get nodeId() {
      return params.nodeId;
    },
    store: params.store,
    get typingRef() {
      return params.typingRef ?? params.store.context.typingRef;
    },
    itemRef,
    get itemMetadata() {
      return params.itemMetadata;
    },
  });

  const getItemProps = (externalProps?: HTMLProps): HTMLProps => {
    return mergeProps(
      commonProps,
      {
        onMouseEnter(event: MouseEvent) {
          const itemMetadata = params.itemMetadata;
          if (itemMetadata.type !== 'submenu-trigger') {
            return;
          }

          itemMetadata.setActive(event);
        },
      } as any,
      externalProps,
      getButtonProps,
    );
  };

  return {
    getItemProps,
    itemRef: (element: HTMLElement | null) => {
      itemRef.current = element;
      (buttonRef as (element: HTMLElement | null) => void)(element);
    },
  };
}

export interface UseMenuItemParameters {
  /**
   * Whether to close the menu when the item is clicked.
   */
  closeOnClick: boolean;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Determines if the menu item is highlighted.
   */
  highlighted: boolean;
  /**
   * The id of the menu item.
   */
  id: string | undefined;
  /**
   * Whether the component renders a native `<button>` element when replacing it
   * via the `render` prop.
   * Set to `false` if the rendered element is not a button (for example, `<div>`).
   * @default false
   */
  nativeButton: boolean;
  /**
   * Additional data specific to the item type.
   */
  itemMetadata: UseMenuItemMetadata;
  /**
   * The node id of the menu positioner.
   */
  nodeId: string | undefined;
  /**
   * The menu store.
   */
  store: MenuStore<any>;
  /**
   * Whether a typeahead session is in progress.
   * @default store.context.typingRef
   */
  typingRef?: RefObject<boolean> | undefined;
}

export type UseMenuItemMetadata =
  | typeof REGULAR_ITEM
  | {
      type: 'submenu-trigger';
      setActive: (event: MouseEvent) => void;
    };

export interface UseMenuItemReturnValue {
  /**
   * Resolver for the root slot's props.
   * @param externalProps event handlers for the root slot
   * @returns props that should be spread on the root slot
   */
  getItemProps: (externalProps?: HTMLProps) => HTMLProps;
  /**
   * The ref to the component's root DOM element.
   */
  itemRef: (element: HTMLElement | null) => void | null;
}

export interface UseMenuItemState {}
