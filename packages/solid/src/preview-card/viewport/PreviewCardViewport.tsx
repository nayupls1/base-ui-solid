import type { JSX } from '@solidjs/web';
import { omit } from 'solid-js';
import { usePreviewCardRootContext } from '../root/PreviewCardContext';
import { usePreviewCardPositionerContext } from '../positioner/PreviewCardPositionerContext';
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
 * Documentation: [Base UI Preview Card](https://base-ui.com/react/components/preview-card)
 */
export function PreviewCardViewport(componentProps: PreviewCardViewport.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'children', 'ref');

  const store = usePreviewCardRootContext();
  const positioner = usePreviewCardPositionerContext();

  const instantType = store.useState('instantType');

  const viewport = usePopupViewport({
    store,
    get side() {
      return positioner.side;
    },
    children: () => componentProps.children,
  });

  const state = (): PreviewCardViewportState => ({
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

export interface PreviewCardViewportState {
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
  instant: 'dismiss' | 'focus' | undefined;
}

export interface PreviewCardViewportProps extends BaseUIComponentProps<
  'div',
  PreviewCardViewportState
> {
  /**
   * The content to render inside the transition container.
   */
  children?: JSX.Element;
}

export namespace PreviewCardViewport {
  export type Props = PreviewCardViewportProps;
  export type State = PreviewCardViewportState;
}
