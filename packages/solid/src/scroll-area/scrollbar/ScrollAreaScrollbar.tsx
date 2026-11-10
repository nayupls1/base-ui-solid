import { createEffect, omit, untrack } from 'solid-js';
import { addEventListener } from 'base-ui-solidjs-utils/addEventListener';
import { contains, getTarget } from 'base-ui-solidjs-utils/shadowDom';
import { createSyncSignal } from 'base-ui-solidjs-utils/createSyncSignal';
import type { BaseUIComponentProps, HTMLProps } from '../../internals/types';
import { useScrollAreaRootContext } from '../root/ScrollAreaRootContext';
import { ScrollAreaScrollbarContext } from './ScrollAreaScrollbarContext';
import { useRenderElement } from '../../internals/useRenderElement';
import { getOffset } from '../utils/getOffset';
import { useDirection } from '../../internals/direction-context/DirectionContext';
import { scrollAreaStateAttributesMapping } from '../root/stateAttributes';
import type { ScrollAreaRootState } from '../root/ScrollAreaRoot';
import * as ScrollAreaRootCssVars from '../root/ScrollAreaRootCssVars';
import * as ScrollAreaScrollbarCssVars from './ScrollAreaScrollbarCssVars';
import { ownedProps } from '../../internals/ownedProps';

/**
 * A vertical or horizontal scrollbar for the scroll area.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Scroll Area](https://base-ui.com/react/components/scroll-area)
 */
export function ScrollAreaScrollbar(componentProps: ScrollAreaScrollbar.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'orientation',
    'keepMounted',
    'style',
    'children',
    'ref',
  );

  const root = useScrollAreaRootContext();

  const orientation = () => componentProps.orientation ?? 'vertical';
  const keepMounted = () => componentProps.keepMounted ?? false;
  const vertical = () => orientation() === 'vertical';

  const state = (): ScrollAreaScrollbarState => ({
    ...root.viewportState,
    hovering: root.hovering,
    scrolling: vertical() ? root.scrollingY : root.scrollingX,
    orientation: orientation(),
  });

  const direction = useDirection();
  const hideTrackUntilMeasured = () => !root.hasMeasuredScrollbar && !keepMounted();
  const isHidden = () => (vertical() ? root.hiddenState.y : root.hiddenState.x);
  const shouldRender = () => keepMounted() || !isHidden();

  const [scrollbarElement, setScrollbarElement] = createSyncSignal<HTMLDivElement | null>(null);

  createEffect(
    () => [scrollbarElement(), root.viewportElement(), vertical(), direction()] as const,
    ([scrollbarEl, viewportEl, isVertical, currentDirection]) => {
      if (!scrollbarEl) {
        return undefined;
      }

      function handleWheel(event: WheelEvent) {
        if (!viewportEl || event.ctrlKey) {
          return;
        }

        const horizontal = !isVertical;
        const scrollProperty = horizontal ? 'scrollLeft' : 'scrollTop';
        const delta = horizontal ? event.deltaX : event.deltaY;
        if (delta === 0) {
          return;
        }

        const maxScroll = horizontal
          ? viewportEl.scrollWidth - viewportEl.clientWidth
          : viewportEl.scrollHeight - viewportEl.clientHeight;
        const minScroll = horizontal && currentDirection === 'rtl' ? -maxScroll : 0;
        const maxScrollValue = horizontal && currentDirection === 'rtl' ? 0 : maxScroll;
        const scrollValue = viewportEl[scrollProperty];

        if (
          (scrollValue <= minScroll && delta < 0) ||
          (scrollValue >= maxScrollValue && delta > 0)
        ) {
          return;
        }

        event.preventDefault();

        viewportEl[scrollProperty] = Math.min(
          maxScrollValue,
          Math.max(minScroll, scrollValue + delta),
        );

        root.handleScroll({ x: viewportEl.scrollLeft, y: viewportEl.scrollTop });
      }

      return addEventListener(scrollbarEl, 'wheel', handleWheel, { passive: false });
    },
  );

  const props: HTMLProps = {
    get 'data-id'() {
      return root.rootId ? `${root.rootId}-scrollbar` : undefined;
    },
    'aria-hidden': true,
    onPointerDown(event: PointerEvent) {
      if (event.button !== 0) {
        return;
      }

      const isVertical = vertical();
      const target = getTarget(event) as Element | null;
      const thumbEl = isVertical ? root.thumbYRef.current : root.thumbXRef.current;

      // Ignore clicks on the thumb itself.
      if (thumbEl && contains(thumbEl, target)) {
        return;
      }

      const viewportEl = root.viewportRef.current;
      if (!viewportEl) {
        return;
      }

      const scrollbarEl = isVertical ? root.scrollbarYRef.current : root.scrollbarXRef.current;

      if (!thumbEl || !scrollbarEl) {
        return;
      }

      const axis = isVertical ? 'y' : 'x';
      const thumbOffset = getOffset(thumbEl, 'margin', axis);
      const scrollbarOffset = getOffset(scrollbarEl, 'padding', axis);
      const thumbSizePx = isVertical ? thumbEl.offsetHeight : thumbEl.offsetWidth;
      const trackRect = scrollbarEl.getBoundingClientRect();
      const clickPosition = isVertical
        ? event.clientY - trackRect.top - thumbSizePx / 2 - scrollbarOffset + thumbOffset / 2
        : event.clientX - trackRect.left - thumbSizePx / 2 - scrollbarOffset + thumbOffset / 2;

      const scrollableSize = isVertical ? viewportEl.scrollHeight : viewportEl.scrollWidth;
      const viewportSize = isVertical ? viewportEl.clientHeight : viewportEl.clientWidth;
      const trackSize = isVertical ? scrollbarEl.offsetHeight : scrollbarEl.offsetWidth;

      const maxThumbOffset = trackSize - thumbSizePx - scrollbarOffset - thumbOffset;
      if (maxThumbOffset <= 0) {
        return;
      }

      const scrollRatio = clickPosition / maxThumbOffset;
      const maxScrollDistance = scrollableSize - viewportSize;

      root.disableViewportSnap();

      if (isVertical) {
        viewportEl.scrollTop = scrollRatio * maxScrollDistance;
      } else if (direction() === 'rtl') {
        viewportEl.scrollLeft = -(1 - scrollRatio) * maxScrollDistance;
      } else {
        viewportEl.scrollLeft = scrollRatio * maxScrollDistance;
      }

      root.handleScroll({ x: viewportEl.scrollLeft, y: viewportEl.scrollTop });

      root.handlePointerDown(event);
    },
    onMouseDown(event: MouseEvent) {
      event.preventDefault();
    },
    onPointerUp: root.handlePointerUp,
    onPointerCancel: root.handlePointerUp,
    get style() {
      return {
        position: 'absolute',
        'touch-action': 'none',
        '-webkit-user-select': 'none',
        'user-select': 'none',
        visibility: hideTrackUntilMeasured() ? 'hidden' : undefined,
        ...(vertical()
          ? {
              top: '0',
              bottom: `var(${ScrollAreaRootCssVars.scrollAreaCornerHeight})`,
              'inset-inline-end': '0',
              [ScrollAreaScrollbarCssVars.scrollAreaThumbHeight]: `${root.thumbSize.height}px`,
            }
          : {
              'inset-inline-start': '0',
              'inset-inline-end': `var(${ScrollAreaRootCssVars.scrollAreaCornerWidth})`,
              bottom: '0',
              [ScrollAreaScrollbarCssVars.scrollAreaThumbWidth]: `${root.thumbSize.width}px`,
            }),
      };
    },
  };

  return (
    <ScrollAreaScrollbarContext value={orientation}>
      {untrack(() =>
        useRenderElement('div', componentProps, {
          enabled: shouldRender,
          ref: (el: HTMLDivElement | null) => {
            setScrollbarElement(el);
            if (untrack(vertical)) {
              root.scrollbarYRef.current = el;
            } else {
              root.scrollbarXRef.current = el;
            }
          },
          state,
          props: [props, elementProps],
          stateAttributesMapping: scrollAreaStateAttributesMapping,
        }),
      )}
    </ScrollAreaScrollbarContext>
  );
}

export interface ScrollAreaScrollbarState extends ScrollAreaRootState {
  /**
   * Whether the scroll area is being hovered.
   */
  hovering: boolean;
  /**
   * Whether the scroll area is being scrolled.
   */
  scrolling: boolean;
  /**
   * The orientation of the scrollbar.
   */
  orientation: 'vertical' | 'horizontal';
}

export interface ScrollAreaScrollbarProps extends BaseUIComponentProps<
  'div',
  ScrollAreaScrollbarState
> {
  /**
   * Whether the scrollbar controls vertical or horizontal scroll.
   * @default 'vertical'
   */
  orientation?: 'vertical' | 'horizontal' | undefined;
  /**
   * Whether to keep the HTML element in the DOM when the viewport isn't scrollable.
   * @default false
   */
  keepMounted?: boolean | undefined;
}

export namespace ScrollAreaScrollbar {
  export type State = ScrollAreaScrollbarState;
  export type Props = ScrollAreaScrollbarProps;
}
