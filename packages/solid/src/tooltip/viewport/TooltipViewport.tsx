import type { JSX } from '@solidjs/web';
import { omit } from 'solid-js';
import { useTooltipRootContext } from '../root/TooltipRootContext';
import { useTooltipPositionerContext } from '../positioner/TooltipPositionerContext';
import type { BaseUIComponentProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import {
  popupViewportStateMapping,
  usePopupViewport,
} from '../../utils/popups/viewport/usePopupViewport';
import { ownedProps } from '../../internals/ownedProps';

/**
 * A viewport for displaying content transitions.
 * This component is only required if one popup can be opened by multiple triggers, its content change based on the trigger
 * and switching between them is animated.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Tooltip](https://base-ui.com/react/components/tooltip)
 */
export function TooltipViewport(componentProps: TooltipViewport.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'children', 'ref');

  const store = useTooltipRootContext();
  const positioner = useTooltipPositionerContext();

  const instantType = store.useState('instantType');

  const viewport = usePopupViewport({
    store,
    get side() {
      return positioner.side;
    },
    children: () => componentProps.children,
  });

  const state = (): TooltipViewportState => ({
    activationDirection: viewport.state().activationDirection,
    transitioning: viewport.state().transitioning,
    instant: instantType(),
  });

  return useRenderElement('div', componentProps, {
    state,
    props: [elementProps],
    children: viewport.children,
    stateAttributesMapping: popupViewportStateMapping,
  });
}

export interface TooltipViewportState {
  /**
   * The activation direction of the transitioned content.
   */
  activationDirection: string | undefined;
  /**
   * Whether the viewport is currently transitioning between contents.
   */
  transitioning: boolean;
  /**
   * Present if animations should be instant.
   */
  instant: 'delay' | 'dismiss' | 'focus' | undefined;
}

export interface TooltipViewportProps extends BaseUIComponentProps<'div', TooltipViewportState> {
  /**
   * The content to render inside the transition container.
   */
  children?: JSX.Element;
}

export namespace TooltipViewport {
  export type Props = TooltipViewportProps;
  export type State = TooltipViewportState;
}
