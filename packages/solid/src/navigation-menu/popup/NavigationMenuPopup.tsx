import { omit } from 'solid-js';
import type { BaseUIComponentProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useNavigationMenuRootContext } from '../root/NavigationMenuRootContext';
import type { TransitionStatus } from '../../internals/useTransitionStatus';
import { useBaseUiId } from '../../internals/useBaseUiId';
import { useNavigationMenuPositionerContext } from '../positioner/NavigationMenuPositionerContext';
import { useDirection } from '../../internals/direction-context/DirectionContext';
import { popupTransitionStateMapping } from '../../utils/popups/popupStateMapping';
import type { Align, Side } from '../../internals/useAnchorPositioning';
import { getDisabledMountTransitionStyles } from '../../internals/getDisabledMountTransitionStyles';
import { ownedProps } from '../../internals/ownedProps';

/**
 * A container for the navigation menu contents.
 * Renders a `<nav>` element.
 *
 * Documentation: [Base UI Navigation Menu](https://base-ui.com/react/components/navigation-menu)
 */
export function NavigationMenuPopup(componentProps: NavigationMenuPopup.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'id', 'children', 'ref');

  const root = useNavigationMenuRootContext();
  const positioning = useNavigationMenuPositionerContext();
  const direction = useDirection();

  const id = useBaseUiId(() => componentProps.id as string | undefined);

  const state = (): NavigationMenuPopupState => ({
    open: root.open,
    transitionStatus: root.transitionStatus,
    side: positioning.side,
    align: positioning.align,
    anchorHidden: positioning.anchorHidden,
  });

  const originStyle = () => {
    // Ensure popup size transitions correctly when anchored to `bottom` (side=top) or `right` (side=left).
    let isPhysicalLeft = positioning.side === 'left';
    if (direction() === 'rtl') {
      isPhysicalLeft = isPhysicalLeft || positioning.side === 'inline-end';
    } else {
      isPhysicalLeft = isPhysicalLeft || positioning.side === 'inline-start';
    }
    const isOriginSide = positioning.side === 'top' || isPhysicalLeft;

    return isOriginSide
      ? {
          position: 'absolute',
          [positioning.side === 'top' ? 'bottom' : 'top']: '0',
          [isPhysicalLeft ? 'right' : 'left']: '0',
        }
      : {};
  };

  return useRenderElement('nav', componentProps, {
    state,
    ref: (el: HTMLElement | null) => root.setPopupElement(el),
    props: [
      {
        get id() {
          return id();
        },
        tabindex: -1,
        get style() {
          return originStyle();
        },
      },
      {
        get style() {
          return getDisabledMountTransitionStyles(root.transitionStatus).style;
        },
      },
      elementProps,
    ],
    stateAttributesMapping: popupTransitionStateMapping,
  });
}

export interface NavigationMenuPopupState {
  /**
   * If `true`, the popup is open.
   */
  open: boolean;
  /**
   * The transition status of the popup.
   */
  transitionStatus: TransitionStatus;
  /**
   * The side of the anchor the popup is positioned on.
   */
  side: Side;
  /**
   * The alignment of the popup relative to the anchor.
   */
  align: Align;
  /**
   * Whether the anchor element is hidden.
   */
  anchorHidden: boolean;
}

export interface NavigationMenuPopupProps extends BaseUIComponentProps<
  'nav',
  NavigationMenuPopupState
> {}

export namespace NavigationMenuPopup {
  export type State = NavigationMenuPopupState;
  export type Props = NavigationMenuPopupProps;
}
