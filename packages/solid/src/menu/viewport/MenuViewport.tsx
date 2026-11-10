import type { JSX } from '@solidjs/web';
import { omit } from 'solid-js';
import { useMenuRootContext } from '../root/MenuRootContext';
import { useMenuPositionerContext } from '../positioner/MenuPositionerContext';
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
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export function MenuViewport(componentProps: MenuViewport.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'children', 'ref');

  const { store } = useMenuRootContext();
  const positioner = useMenuPositionerContext();

  const instantType = store.useState('instantType');

  const viewport = usePopupViewport({
    store,
    get side() {
      return positioner.side;
    },
    children: () => componentProps.children,
  });

  const state = (): MenuViewportState => ({
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

export interface MenuViewportState {
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
  instant: 'dismiss' | 'click' | 'group' | 'trigger-change' | undefined;
}

export interface MenuViewportProps extends BaseUIComponentProps<'div', MenuViewportState> {
  /**
   * The content to render inside the transition container.
   */
  children?: JSX.Element;
}

export namespace MenuViewport {
  export type Props = MenuViewportProps;
  export type State = MenuViewportState;
}
