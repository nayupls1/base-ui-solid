import { createEffect, omit, untrack } from 'solid-js';
import type { BaseUIComponentProps } from '../../internals/types';
import { useScrollAreaViewportContext } from '../viewport/ScrollAreaViewportContext';
import { useRenderElement } from '../../internals/useRenderElement';
import { useScrollAreaRootContext } from '../root/ScrollAreaRootContext';
import { scrollAreaStateAttributesMapping } from '../root/stateAttributes';
import type { ScrollAreaRootState } from '../root/ScrollAreaRoot';
import { createSyncSignal } from 'base-ui-solidjs-utils/createSyncSignal';
import { ownedProps } from '../../internals/ownedProps';

/**
 * A container for the content of the scroll area.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Scroll Area](https://base-ui.com/react/components/scroll-area)
 */
export function ScrollAreaContent(componentProps: ScrollAreaContent.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'children', 'ref');

  const { computeThumbPosition } = useScrollAreaViewportContext();
  const root = useScrollAreaRootContext();

  const [contentWrapper, setContentWrapper] = createSyncSignal<HTMLDivElement | null>(null);
  const computeOnInitialResize = untrack(() => root.hasMeasuredScrollbar);

  createEffect(contentWrapper, (element) => {
    if (typeof ResizeObserver === 'undefined') {
      return undefined;
    }

    let hasInitialized = false;
    const resizeObserver = new ResizeObserver(() => {
      // ResizeObserver fires once upon observing, so we skip the initial call
      // to avoid double-calculating the thumb position on mount.
      if (!hasInitialized) {
        hasInitialized = true;

        if (!computeOnInitialResize) {
          return;
        }
      }

      computeThumbPosition();
    });

    if (element) {
      resizeObserver.observe(element);
    }

    return () => {
      resizeObserver.disconnect();
    };
  });

  return useRenderElement('div', componentProps, {
    ref: (el: HTMLDivElement | null) => {
      setContentWrapper(el);
    },
    state: () => root.viewportState,
    stateAttributesMapping: scrollAreaStateAttributesMapping,
    props: [
      {
        role: 'presentation',
        style: {
          'min-width': 'fit-content',
        },
      },
      elementProps,
    ],
  });
}

export interface ScrollAreaContentState extends ScrollAreaRootState {}

export interface ScrollAreaContentProps extends BaseUIComponentProps<
  'div',
  ScrollAreaContentState
> {}

export namespace ScrollAreaContent {
  export type State = ScrollAreaContentState;
  export type Props = ScrollAreaContentProps;
}
