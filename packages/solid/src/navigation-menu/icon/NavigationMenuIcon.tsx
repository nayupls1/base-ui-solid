import { omit } from 'solid-js';
import type { BaseUIComponentProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useNavigationMenuRootContext } from '../root/NavigationMenuRootContext';
import { triggerOpenStateMapping } from '../../utils/popups/popupStateMapping';
import { useNavigationMenuItemContext } from '../item/NavigationMenuItemContext';
import { ownedProps } from '../../internals/ownedProps';

/**
 * An icon that indicates that the trigger button opens a menu.
 * Renders a `<span>` element.
 *
 * Documentation: [Base UI Navigation Menu](https://base-ui.com/react/components/navigation-menu)
 */
export function NavigationMenuIcon(componentProps: NavigationMenuIcon.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'children', 'ref');

  const item = useNavigationMenuItemContext();
  const root = useNavigationMenuRootContext();

  const state = (): NavigationMenuIconState => ({
    open: root.open && root.value === item.value,
  });

  return useRenderElement('span', componentProps, {
    state,
    props: [{ 'aria-hidden': true }, elementProps],
    children: () => componentProps.children ?? '▼',
    stateAttributesMapping: triggerOpenStateMapping,
  });
}

export interface NavigationMenuIconState {
  /**
   * Whether the navigation menu is open and the item is active.
   */
  open: boolean;
}

export interface NavigationMenuIconProps extends BaseUIComponentProps<
  'span',
  NavigationMenuIconState
> {}

export namespace NavigationMenuIcon {
  export type State = NavigationMenuIconState;
  export type Props = NavigationMenuIconProps;
}
