import { omit } from 'solid-js';
import { usePreviewCardPositionerContext } from '../positioner/PreviewCardPositionerContext';
import { usePreviewCardRootContext } from '../root/PreviewCardContext';
import type { Align, Side } from '../../internals/useAnchorPositioning';
import type { BaseUIComponentProps } from '../../internals/types';
import { popupStateMapping } from '../../utils/popups/popupStateMapping';
import { useRenderElement } from '../../internals/useRenderElement';
import { ownedProps } from '../../internals/ownedProps';

/**
 * Displays an element positioned against the previewCard anchor.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Preview Card](https://base-ui.com/react/components/preview-card)
 */
export function PreviewCardArrow(componentProps: PreviewCardArrow.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'children', 'ref');

  const store = usePreviewCardRootContext();
  const open = store.useState('open');
  const positioner = usePreviewCardPositionerContext();

  const state = (): PreviewCardArrowState => ({
    open: open(),
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
      elementProps,
    ],
    stateAttributesMapping: popupStateMapping,
  });
}

export interface PreviewCardArrowState {
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
   * Whether the arrow cannot be centered on the anchor.
   */
  uncentered: boolean;
}

export interface PreviewCardArrowProps extends BaseUIComponentProps<'div', PreviewCardArrowState> {}

export namespace PreviewCardArrow {
  export type State = PreviewCardArrowState;
  export type Props = PreviewCardArrowProps;
}
