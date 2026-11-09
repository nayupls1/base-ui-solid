import { untrack } from 'solid-js';
import { useTooltipRootContext } from '../root/TooltipRootContext';
import { TooltipPositionerContext } from './TooltipPositionerContext';
import type {
  Side,
  Align,
  UseAnchorPositioningSharedParameters,
} from '../../internals/useAnchorPositioning';
import type { BaseUIComponentProps } from '../../internals/types';
import { useTooltipPortalContext } from '../portal/TooltipPortalContext';
import { usePopupPositioner } from '../../utils/popups/popupPositioner';
import { ownedProps } from '../../internals/ownedProps';

/**
 * Positions the tooltip against the trigger.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Tooltip](https://base-ui.com/react/components/tooltip)
 */
export function TooltipPositioner(componentProps: TooltipPositioner.Props) {
  componentProps = ownedProps(componentProps);
  const store = useTooltipRootContext();
  const keepMounted = useTooltipPortalContext();

  const open = store.useState('open');
  const trackCursorAxis = store.useState('trackCursorAxis');
  const disableHoverablePopup = store.useState('disableHoverablePopup');
  const instantType = store.useState('instantType');

  const { element, positioning } = usePopupPositioner(store as any, componentProps as any, {
    keepMounted,
    positioning: {
      get side() {
        return componentProps.side ?? 'top';
      },
    },
    get state() {
      return { instant: trackCursorAxis() !== 'none' ? 'tracking-cursor' : instantType() };
    },
    get inert() {
      return !open() || trackCursorAxis() === 'both' || disableHoverablePopup();
    },
  } as any);

  const positionerContext: TooltipPositionerContext = {
    get side() {
      return positioning.side;
    },
    get align() {
      return positioning.align;
    },
    arrowRef: positioning.arrowRef,
    get arrowUncentered() {
      return positioning.arrowUncentered;
    },
    get arrowStyles() {
      return positioning.arrowStyles;
    },
  };

  return (
    <TooltipPositionerContext value={positionerContext}>{untrack(element)}</TooltipPositionerContext>
  );
}

type TooltipPositionerContext = import('./TooltipPositionerContext').TooltipPositionerContext;

export interface TooltipPositionerState {
  /**
   * Whether the tooltip is currently open.
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
   * Whether the anchor element is hidden.
   */
  anchorHidden: boolean;
  /**
   * Whether CSS transitions should be disabled.
   */
  instant: string | undefined;
}

export interface TooltipPositionerProps
  extends
    BaseUIComponentProps<'div', TooltipPositionerState>,
    Omit<UseAnchorPositioningSharedParameters, 'side'> {
  /**
   * Which side of the anchor element to align the popup against.
   * May automatically change to avoid collisions.
   * @default 'top'
   */
  side?: Side | undefined;
}

export namespace TooltipPositioner {
  export type State = TooltipPositionerState;
  export type Props = TooltipPositionerProps;
}
