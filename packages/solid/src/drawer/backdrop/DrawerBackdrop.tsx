import { createMemo, omit, Show, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { useDialogRootContext } from '../../dialog/root/DialogRootContext';
import { useRenderElement } from '../../internals/useRenderElement';
import type { BaseUIComponentProps } from '../../internals/types';
import type { TransitionStatus } from '../../internals/useTransitionStatus';
import { popupTransitionStateMapping } from '../../utils/popups/popupStateMapping';
import * as DrawerBackdropCssVars from './DrawerBackdropCssVars';
import * as DrawerPopupCssVars from '../popup/DrawerPopupCssVars';
import { ownedProps } from '../../internals/ownedProps';

/**
 * An overlay displayed beneath the popup.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Drawer](https://base-ui.com/react/components/drawer)
 */
export function DrawerBackdrop(componentProps: DrawerBackdrop.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'style',
    'forceRender',
    'children',
    'ref',
  );

  const store = useDialogRootContext();

  const open = store.useState('open');
  const nested = store.useState('nested');
  const mounted = store.useState('mounted');
  const transitionStatus = store.useState('transitionStatus');

  const state = createMemo<DrawerBackdropState>(() => ({
    open: open(),
    transitionStatus: transitionStatus(),
  }));

  return (
    <Show when={(componentProps.forceRender ?? false) || !nested()}>
      {untrack(() =>
        useRenderElement('div', componentProps, {
          state,
          ref: (el: HTMLElement | null) => {
            store.context.backdropRef.current = el as HTMLDivElement | null;
          },
          stateAttributesMapping: popupTransitionStateMapping,
          props: [
            {
              role: 'presentation',
              get hidden() {
                return !mounted();
              },
              get style() {
                return {
                  'pointer-events': !open() ? 'none' : undefined,
                  'user-select': 'none',
                  '-webkit-user-select': 'none',
                  [DrawerBackdropCssVars.swipeProgress]: '0',
                  [DrawerPopupCssVars.swipeStrength]: '1',
                } as JSX.CSSProperties;
              },
            },
            elementProps,
          ],
        }),
      )}
    </Show>
  );
}

export interface DrawerBackdropProps extends BaseUIComponentProps<'div', DrawerBackdropState> {
  /**
   * Whether the backdrop is forced to render even when nested.
   * @default false
   */
  forceRender?: boolean | undefined;
}

export interface DrawerBackdropState {
  /**
   * Whether the drawer is currently open.
   */
  open: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export namespace DrawerBackdrop {
  export type Props = DrawerBackdropProps;
  export type State = DrawerBackdropState;
}
