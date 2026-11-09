import { omit, untrack } from 'solid-js';
import type { BaseUIComponentProps } from '../../internals/types';
import { useScrollAreaRootContext } from '../root/ScrollAreaRootContext';
import { useScrollAreaScrollbarContext } from '../scrollbar/ScrollAreaScrollbarContext';
import { useRenderElement } from '../../internals/useRenderElement';
import { ownedProps } from '../../internals/ownedProps';

/**
 * The draggable part of the scrollbar that indicates the current scroll position.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Scroll Area](https://base-ui.com/react/components/scroll-area)
 */
export function ScrollAreaThumb(componentProps: ScrollAreaThumb.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'children', 'ref');

  const root = useScrollAreaRootContext();

  const orientation = useScrollAreaScrollbarContext();
  const vertical = () => orientation() === 'vertical';

  const state = (): ScrollAreaThumbState => ({
    scrolling: vertical() ? root.scrollingY : root.scrollingX,
    orientation: orientation(),
  });

  return useRenderElement('div', componentProps, {
    ref: (el: HTMLDivElement | null) => {
      if (untrack(vertical)) {
        root.thumbYRef.current = el;
      } else {
        root.thumbXRef.current = el;
      }
    },
    state,
    props: [
      {
        onPointerDown: root.handlePointerDown,
        onPointerMove: root.handlePointerMove,
        onPointerUp: root.handlePointerUp,
        onPointerCancel: root.handlePointerUp,
        get style() {
          return {
            visibility: root.hasMeasuredScrollbar ? undefined : 'hidden',
            ...(vertical()
              ? { height: 'var(--scroll-area-thumb-height)' }
              : { width: 'var(--scroll-area-thumb-width)' }),
          };
        },
      },
      elementProps,
    ],
  });
}

export interface ScrollAreaThumbState {
  /**
   * Whether the scroll area is being scrolled.
   */
  scrolling: boolean;
  /**
   * The component orientation.
   */
  orientation: 'horizontal' | 'vertical';
}

export interface ScrollAreaThumbProps extends BaseUIComponentProps<'div', ScrollAreaThumbState> {}

export namespace ScrollAreaThumb {
  export type State = ScrollAreaThumbState;
  export type Props = ScrollAreaThumbProps;
}
