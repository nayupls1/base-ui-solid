import { omit } from 'solid-js';
import { useNavigationMenuPositionerContext } from '../positioner/NavigationMenuPositionerContext';
import { useNavigationMenuRootContext } from '../root/NavigationMenuRootContext';
import type { Align, Side } from '../../internals/useAnchorPositioning';
import type { BaseUIComponentProps } from '../../internals/types';
import { popupStateMapping } from '../../utils/popups/popupStateMapping';
import { useRenderElement } from '../../internals/useRenderElement';
import { getDisabledMountTransitionStyles } from '../../internals/getDisabledMountTransitionStyles';
import { ownedProps } from '../../internals/ownedProps';

/**
 * Displays an element pointing toward the navigation menu's current anchor.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Navigation Menu](https://base-ui.com/react/components/navigation-menu)
 */
export function NavigationMenuArrow(componentProps: NavigationMenuArrow.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'children', 'ref');

  const root = useNavigationMenuRootContext();
  const positioner = useNavigationMenuPositionerContext();

  const state = (): NavigationMenuArrowState => ({
    open: root.open,
    side: positioner.side,
    align: positioner.align,
    uncentered: positioner.arrowUncentered,
  });

  return useRenderElement('div', componentProps, {
    state,
    ref: positioner.arrowRef,
    props: [
      {
        get style() {
          return positioner.arrowStyles;
        },
        'aria-hidden': true,
      },
      {
        get style() {
          return getDisabledMountTransitionStyles(root.transitionStatus).style;
        },
      },
      elementProps,
    ],
    stateAttributesMapping: popupStateMapping,
  });
}

export interface NavigationMenuArrowState {
  /**
   * Whether the popup is currently open.
   */
  open: boolean;
  /**
   * The side of the anchor the component is placed on.
   */
  side: Side;
  /**
   * The alignment of the component relative to the anchor.
   */
  align: Align;
  /**
   * Whether the arrow cannot be centered on the anchor.
   */
  uncentered: boolean;
}

export interface NavigationMenuArrowProps extends BaseUIComponentProps<
  'div',
  NavigationMenuArrowState
> {}

export namespace NavigationMenuArrow {
  export type State = NavigationMenuArrowState;
  export type Props = NavigationMenuArrowProps;
}
