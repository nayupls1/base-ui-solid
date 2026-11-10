import { omit } from 'solid-js';
import { useMenuRootContext } from '../root/MenuRootContext';
import { useContextMenuRootContext } from '../../context-menu/root/ContextMenuRootContext';
import type { BaseUIComponentProps } from '../../internals/types';
import { popupTransitionStateMapping } from '../../utils/popups/popupStateMapping';
import type { TransitionStatus } from '../../internals/useTransitionStatus';
import { useRenderElement } from '../../internals/useRenderElement';
import { REASONS } from '../../internals/reasons';
import { ownedProps } from '../../internals/ownedProps';

/**
 * An overlay displayed beneath the menu popup.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export function MenuBackdrop(props: MenuBackdrop.Props) {
  props = ownedProps(props);
  const elementProps = omit(props, 'render', 'class', 'style', 'children', 'ref');

  const { store } = useMenuRootContext();

  const open = store.useState('open');
  const mounted = store.useState('mounted');
  const transitionStatus = store.useState('transitionStatus');
  const lastOpenChangeReason = store.useState('lastOpenChangeReason');

  const contextMenuContext = useContextMenuRootContext();

  const state = (): MenuBackdropState => ({
    open: open(),
    transitionStatus: transitionStatus(),
  });

  return useRenderElement('div', props, {
    state,
    ref: (el: HTMLDivElement | null) => {
      if (contextMenuContext?.backdropRef) {
        contextMenuContext.backdropRef.current = el;
      }
    },
    props: [
      {
        role: 'presentation',
        get hidden() {
          return !mounted();
        },
        get style() {
          return {
            'pointer-events': lastOpenChangeReason() === REASONS.triggerHover ? 'none' : undefined,
            'user-select': 'none',
            '-webkit-user-select': 'none',
          };
        },
      },
      elementProps,
    ],
    stateAttributesMapping: popupTransitionStateMapping,
  });
}

export interface MenuBackdropState {
  /**
   * Whether the menu is currently open.
   */
  open: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export interface MenuBackdropProps extends BaseUIComponentProps<'div', MenuBackdropState> {}

export namespace MenuBackdrop {
  export type State = MenuBackdropState;
  export type Props = MenuBackdropProps;
}
