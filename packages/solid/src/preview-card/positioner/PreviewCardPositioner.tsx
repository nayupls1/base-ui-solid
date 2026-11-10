import { createEffect, untrack } from 'solid-js';
import { usePreviewCardRootContext } from '../root/PreviewCardContext';
import { PreviewCardPositionerContext } from './PreviewCardPositionerContext';
import { FloatingNode, useFloatingNodeId } from '../../utils/popups/tree/FloatingTree';
import type {
  Side,
  Align,
  UseAnchorPositioningSharedParameters,
} from '../../internals/useAnchorPositioning';
import type { BaseUIComponentProps } from '../../internals/types';
import { usePreviewCardPortalContext } from '../portal/PreviewCardPortalContext';
import { usePopupPositioner } from '../../utils/popups/popupPositioner';
import { createInlineMiddleware } from '../../utils/popups/inlineRect';
import { ownedProps } from '../../internals/ownedProps';

/**
 * Positions the popup against the trigger.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Preview Card](https://base-ui.com/react/components/preview-card)
 */
export function PreviewCardPositioner(componentProps: PreviewCardPositioner.Props) {
  componentProps = ownedProps(componentProps);
  const store = usePreviewCardRootContext();
  const keepMounted = usePreviewCardPortalContext();
  const nodeId = useFloatingNodeId();

  const inlineRectCoordsRef = store.context.inlineRectCoordsRef;

  const { element, positioning, open, mounted } = usePopupPositioner(store as any, componentProps as any, {
    keepMounted,
    positioning: {
      nodeId,
      inline: createInlineMiddleware(inlineRectCoordsRef),
    },
  } as any);

  createEffect(
    () => open() && mounted(),
    (shouldUpdate) => {
      if (shouldUpdate) {
        positioning.update();
      }
    },
  );

  const positionerContext: PreviewCardPositionerContext = {
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
    <PreviewCardPositionerContext value={positionerContext}>
      <FloatingNode id={nodeId}>{untrack(element)}</FloatingNode>
    </PreviewCardPositionerContext>
  );
}


export interface PreviewCardPositionerState {
  /**
   * Whether the preview card is currently open.
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
   * Whether transitions should be skipped.
   */
  instant: 'dismiss' | 'focus' | undefined;
}

export interface PreviewCardPositionerProps
  extends
    UseAnchorPositioningSharedParameters,
    BaseUIComponentProps<'div', PreviewCardPositionerState> {}

export namespace PreviewCardPositioner {
  export type State = PreviewCardPositionerState;
  export type Props = PreviewCardPositionerProps;
}
