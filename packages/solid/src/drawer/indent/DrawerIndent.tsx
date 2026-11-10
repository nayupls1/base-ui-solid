import { createSignal, createEffect, omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { BaseUIComponentProps } from '../../internals/types';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import { useRenderElement } from '../../internals/useRenderElement';
import { useDrawerProviderContext } from '../provider/DrawerProviderContext';
import * as DrawerBackdropCssVars from '../backdrop/DrawerBackdropCssVars';
import * as DrawerPopupCssVars from '../popup/DrawerPopupCssVars';
import { ownedProps } from '../../internals/ownedProps';

const stateAttributesMapping: StateAttributesMapping<DrawerIndentState> = {
  active(value): Record<string, string> | null {
    if (value) {
      return { 'data-active': '' };
    }
    return { 'data-inactive': '' };
  },
};

/**
 * A wrapper element intended to contain your app's main UI.
 * Applies `data-active` when any drawer within the nearest `<Drawer.Provider>` is open.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Drawer](https://base-ui.com/react/components/drawer)
 */
export function DrawerIndent(componentProps: DrawerIndent.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'children', 'ref');

  const providerContext = useDrawerProviderContext();

  const visualStateStore = providerContext?.visualStateStore;

  const [indentElement, setIndentElement] = createSignal<HTMLDivElement | null>(null, {
    ownedWrite: true,
  });

  createEffect(indentElement, (element) => {
    if (!element || !visualStateStore) {
      return undefined;
    }

    const syncVisualState = () => {
      const { swipeProgress, frontmostHeight } = visualStateStore.getSnapshot();
      if (swipeProgress <= 0) {
        element.style.setProperty(DrawerBackdropCssVars.swipeProgress, '0');
      } else {
        element.style.setProperty(DrawerBackdropCssVars.swipeProgress, `${swipeProgress}`);
      }

      if (frontmostHeight <= 0) {
        element.style.removeProperty(DrawerPopupCssVars.height);
      } else {
        element.style.setProperty(DrawerPopupCssVars.height, `${frontmostHeight}px`);
      }
    };

    syncVisualState();

    const unsubscribe = visualStateStore.subscribe(syncVisualState);
    return () => {
      unsubscribe();
      element.style.setProperty(DrawerBackdropCssVars.swipeProgress, '0');
      element.style.removeProperty(DrawerPopupCssVars.height);
    };
  });

  const state = (): DrawerIndentState => ({
    active: providerContext?.active ?? false,
  });

  return useRenderElement('div', componentProps, {
    ref: (el: HTMLDivElement | null) => setIndentElement(() => el),
    state,
    props: [
      {
        style: {
          [DrawerBackdropCssVars.swipeProgress]: '0',
        } as JSX.CSSProperties,
      },
      elementProps,
    ],
    stateAttributesMapping,
  });
}

export interface DrawerIndentState {
  /**
   * Whether any drawer within the nearest <Drawer.Provider> is open.
   */
  active: boolean;
}

export interface DrawerIndentProps extends BaseUIComponentProps<'div', DrawerIndentState> {}

export namespace DrawerIndent {
  export type State = DrawerIndentState;
  export type Props = DrawerIndentProps;
}
