import { omit } from 'solid-js';
import { useComboboxPositionerContext } from '../positioner/ComboboxPositionerContext';
import { useComboboxRootContext } from '../root/ComboboxRootContext';
import { useRenderElement } from '../../internals/useRenderElement';
import type { Side, Align } from '../../internals/useAnchorPositioning';
import type { BaseUIComponentProps } from '../../internals/types';
import { popupStateMapping } from '../../utils/popups/popupStateMapping';
import { ownedProps } from '../../internals/ownedProps';

/**
 * Displays an element positioned against the anchor.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export function ComboboxArrow(componentProps: ComboboxArrow.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'children', 'ref');

  const store = useComboboxRootContext();
  const positioner = useComboboxPositionerContext();

  const open = store.useState('open');

  const state = (): ComboboxArrowState => ({
    open: open(),
    side: positioner.side,
    align: positioner.align,
    uncentered: positioner.arrowUncentered,
  });

  return useRenderElement('div', componentProps, {
    ref: positioner.arrowRef,
    stateAttributesMapping: popupStateMapping,
    state,
    props: [
      {
        get style() {
          return positioner.arrowStyles;
        },
        'aria-hidden': true,
      },
      elementProps,
    ],
  });
}

export interface ComboboxArrowState {
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

export interface ComboboxArrowProps extends BaseUIComponentProps<'div', ComboboxArrowState> {}

export namespace ComboboxArrow {
  export type State = ComboboxArrowState;
  export type Props = ComboboxArrowProps;
}
