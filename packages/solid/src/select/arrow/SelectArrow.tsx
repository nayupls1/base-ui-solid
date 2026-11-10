import { createMemo, omit } from 'solid-js';
import { useSelectRootContext } from '../root/SelectRootContext';
import { useSelectPositionerContext } from '../positioner/SelectPositionerContext';
import type { BaseUIComponentProps } from '../../internals/types';
import type { Align, Side } from '../../internals/useAnchorPositioning';
import { popupTransitionStateMapping } from '../../utils/popups/popupStateMapping';
import { useRenderElement } from '../../internals/useRenderElement';
import { ownedProps } from '../../internals/ownedProps';

/**
 * Displays an element positioned against the select popup anchor.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Select](https://base-ui.com/react/components/select)
 */
export function SelectArrow(componentProps: SelectArrow.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'children', 'ref');

  const store = useSelectRootContext();
  const positioner = useSelectPositionerContext();
  const open = store.useState('open');

  const state = createMemo<SelectArrowState>(() => ({
    open: open(),
    side: positioner.side as any,
    align: positioner.align,
    uncentered: positioner.arrowUncentered,
  }));

  return useRenderElement('div', componentProps, {
    state,
    ref: positioner.arrowRef as any,
    props: [
      {
        get style() {
          return positioner.arrowStyles;
        },
        'aria-hidden': true,
      },
      elementProps,
    ],
    stateAttributesMapping: popupTransitionStateMapping,
    enabled: () => !positioner.alignItemWithTriggerActive,
  });
}

export interface SelectArrowState {
  /**
   * Whether the select popup is currently open.
   */
  open: boolean;
  /**
   * The side of the anchor the component is placed on.
   */
  side: Side | 'none';
  /**
   * The alignment of the component relative to the anchor.
   */
  align: Align;
  /**
   * Whether the arrow cannot be centered on the anchor.
   */
  uncentered: boolean;
}

export interface SelectArrowProps extends BaseUIComponentProps<'div', SelectArrowState> {}

export namespace SelectArrow {
  export type State = SelectArrowState;
  export type Props = SelectArrowProps;
}
