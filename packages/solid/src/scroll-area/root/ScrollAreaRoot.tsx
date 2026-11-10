import { createMemo, omit, untrack } from 'solid-js';
import { useTimeout } from '@base-ui-solid/utils/useTimeout';
import { contains } from '@base-ui-solid/utils/shadowDom';
import { createSyncSignal } from '@base-ui-solid/utils/createSyncSignal';
import type { BaseUIComponentProps, HTMLProps } from '../../internals/types';
import { ScrollAreaRootContext } from './ScrollAreaRootContext';
import { useRenderElement } from '../../internals/useRenderElement';
import { SCROLL_TIMEOUT } from '../constants';
import { getOffset } from '../utils/getOffset';
import { styleDisableScrollbar } from '../../utils/styles';
import { useBaseUiId } from '../../internals/useBaseUiId';
import { scrollAreaStateAttributesMapping } from './stateAttributes';
import { useCSPContext } from '../../internals/csp-context/CSPContext';
import * as ScrollAreaRootCssVars from './ScrollAreaRootCssVars';
import * as ScrollAreaScrollbarDataAttributes from '../scrollbar/ScrollAreaScrollbarDataAttributes';
import { ownedProps } from '../../internals/ownedProps';

const DEFAULT_COORDS = { x: 0, y: 0 };
const DEFAULT_SIZE = { width: 0, height: 0 };
const DEFAULT_OVERFLOW_EDGES = { xStart: false, xEnd: false, yStart: false, yEnd: false };
const DEFAULT_HIDDEN_STATE = { x: true, y: true, corner: true };

export type HiddenState = typeof DEFAULT_HIDDEN_STATE;
export type OverflowEdges = typeof DEFAULT_OVERFLOW_EDGES;
export type Size = typeof DEFAULT_SIZE;
export type Coords = typeof DEFAULT_COORDS;

/**
 * Groups all parts of the scroll area.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Scroll Area](https://base-ui.com/react/components/scroll-area)
 */
export function ScrollAreaRoot(componentProps: ScrollAreaRoot.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'overflowEdgeThreshold',
    'style',
    'children',
    'ref',
  );

  const overflowEdgeThreshold = createMemo(() =>
    normalizeOverflowEdgeThreshold(componentProps.overflowEdgeThreshold),
  );

  const rootId = useBaseUiId()();

  const scrollYTimeout = useTimeout();
  const scrollXTimeout = useTimeout();

  const csp = useCSPContext();

  const [hovering, setHovering] = createSyncSignal(false);
  const [scrollingX, setScrollingX] = createSyncSignal(false);
  const [scrollingY, setScrollingY] = createSyncSignal(false);
  const [touchModality, setTouchModality] = createSyncSignal(false);
  const [hasMeasuredScrollbar, setHasMeasuredScrollbar] = createSyncSignal(false);
  const [cornerSize, setCornerSize] = createSyncSignal<Size>(DEFAULT_SIZE);
  const [thumbSize, setThumbSize] = createSyncSignal<Size>(DEFAULT_SIZE);
  const [overflowEdges, setOverflowEdges] = createSyncSignal(DEFAULT_OVERFLOW_EDGES);
  const [hiddenState, setHiddenState] = createSyncSignal(DEFAULT_HIDDEN_STATE);
  const [viewportElement, setViewportElement] = createSyncSignal<HTMLDivElement | null>(null);

  let rootElement: HTMLDivElement | null = null;
  const viewportRef = {
    get current() {
      return viewportElement();
    },
    set current(value: HTMLDivElement | null) {
      setViewportElement(value);
    },
  };
  const scrollbarYRef = { current: null as HTMLDivElement | null };
  const scrollbarXRef = { current: null as HTMLDivElement | null };
  const thumbYRef = { current: null as HTMLDivElement | null };
  const thumbXRef = { current: null as HTMLDivElement | null };
  const cornerRef = { current: null as HTMLDivElement | null };

  let activePointerId: number | null = null;
  let startY = 0;
  let startX = 0;
  let startScrollTop = 0;
  let startScrollLeft = 0;
  let currentOrientation: 'vertical' | 'horizontal' = 'vertical';
  let scrollPosition = DEFAULT_COORDS;
  let savedSnapType: string | null = null;

  function startScrolling(vertical: boolean) {
    const setScrolling = vertical ? setScrollingY : setScrollingX;
    const timeout = vertical ? scrollYTimeout : scrollXTimeout;

    setScrolling(true);
    timeout.start(SCROLL_TIMEOUT, () => {
      setScrolling(false);
    });
  }

  const handleScroll = (nextScrollPosition: Coords) => {
    const offsetX = nextScrollPosition.x - scrollPosition.x;
    const offsetY = nextScrollPosition.y - scrollPosition.y;

    scrollPosition = nextScrollPosition;

    if (offsetY !== 0) {
      startScrolling(true);
    }

    if (offsetX !== 0) {
      startScrolling(false);
    }
  };

  const disableViewportSnap = () => {
    const viewportEl = viewportRef.current;
    if (viewportEl && savedSnapType === null) {
      savedSnapType = viewportEl.style.scrollSnapType;
      viewportEl.style.scrollSnapType = 'none';
    }
  };

  const handlePointerDown = (event: PointerEvent) => {
    if (event.button !== 0) {
      return;
    }

    if (activePointerId !== null) {
      const activeThumb = currentOrientation === 'vertical' ? thumbYRef.current : thumbXRef.current;
      if (activeThumb?.hasPointerCapture(activePointerId)) {
        return;
      }
    }

    activePointerId = event.pointerId;
    startY = event.clientY;
    startX = event.clientX;
    currentOrientation = (event.currentTarget as Element).getAttribute(
      ScrollAreaScrollbarDataAttributes.orientation,
    ) as 'vertical' | 'horizontal';

    const viewportEl = viewportRef.current;
    if (viewportEl) {
      startScrollTop = viewportEl.scrollTop;
      startScrollLeft = viewportEl.scrollLeft;
      disableViewportSnap();
    }

    const thumb = currentOrientation === 'vertical' ? thumbYRef.current : thumbXRef.current;
    thumb?.setPointerCapture(event.pointerId);
  };

  const handlePointerUp = (event: PointerEvent) => {
    if (event.pointerId !== activePointerId) {
      return;
    }

    activePointerId = null;
    (currentOrientation === 'vertical' ? setScrollingY : setScrollingX)(false);

    if (savedSnapType !== null) {
      if (viewportRef.current) {
        viewportRef.current.style.scrollSnapType = savedSnapType;
      }
      savedSnapType = null;
    }

    const thumb = currentOrientation === 'vertical' ? thumbYRef.current : thumbXRef.current;
    if (thumb?.hasPointerCapture(event.pointerId)) {
      thumb.releasePointerCapture(event.pointerId);
    }
  };

  const handlePointerMove = (event: PointerEvent) => {
    if (event.pointerId !== activePointerId) {
      return;
    }

    // Ending pointer interactions can fail to fire `pointerup` in some browsers.
    if (event.buttons % 2 === 0) {
      handlePointerUp(event);
      return;
    }

    const viewportEl = viewportRef.current;
    if (!viewportEl) {
      return;
    }

    const vertical = currentOrientation === 'vertical';
    const thumbEl = vertical ? thumbYRef.current : thumbXRef.current;
    const scrollbarEl = vertical ? scrollbarYRef.current : scrollbarXRef.current;
    if (!thumbEl || !scrollbarEl) {
      return;
    }

    const axis = vertical ? 'y' : 'x';
    const scrollbarOffset = getOffset(scrollbarEl, 'padding', axis);
    const thumbOffset = getOffset(thumbEl, 'margin', axis);
    const thumbSizePx = vertical ? thumbEl.offsetHeight : thumbEl.offsetWidth;
    const trackSize = vertical ? scrollbarEl.offsetHeight : scrollbarEl.offsetWidth;
    const maxThumbOffset = trackSize - thumbSizePx - scrollbarOffset - thumbOffset;
    const delta = vertical ? event.clientY - startY : event.clientX - startX;
    const scrollRatio = maxThumbOffset <= 0 ? 0 : delta / maxThumbOffset;

    const scrollableSize = vertical ? viewportEl.scrollHeight : viewportEl.scrollWidth;
    const viewportSize = vertical ? viewportEl.clientHeight : viewportEl.clientWidth;
    const startScroll = vertical ? startScrollTop : startScrollLeft;
    const nextScroll = startScroll + scrollRatio * (scrollableSize - viewportSize);

    if (vertical) {
      viewportEl.scrollTop = nextScroll;
    } else {
      viewportEl.scrollLeft = nextScroll;
    }
    event.preventDefault();

    startScrolling(vertical);
  };

  function handleTouchModalityChange(event: PointerEvent) {
    setTouchModality(event.pointerType === 'touch');
  }

  function handlePointerEnterOrMove(event: PointerEvent) {
    handleTouchModalityChange(event);

    if (event.pointerType !== 'touch') {
      const isTargetRootChild = contains(rootElement, event.target as Element);
      setHovering(isTargetRootChild);
    }
  }

  const state = createMemo<ScrollAreaRootState>(() => {
    const hidden = hiddenState();
    const edges = overflowEdges();
    return {
      scrolling: scrollingX() || scrollingY(),
      hasOverflowX: !hidden.x,
      hasOverflowY: !hidden.y,
      overflowXStart: edges.xStart,
      overflowXEnd: edges.xEnd,
      overflowYStart: edges.yStart,
      overflowYEnd: edges.yEnd,
      cornerHidden: hidden.corner,
    };
  });

  const props: HTMLProps = {
    role: 'presentation',
    onPointerEnter: handlePointerEnterOrMove,
    onPointerMove: handlePointerEnterOrMove,
    onPointerDown: handleTouchModalityChange,
    onPointerLeave() {
      setHovering(false);
    },
    get style() {
      const size = cornerSize();
      return {
        position: 'relative',
        [ScrollAreaRootCssVars.scrollAreaCornerHeight]: `${size.height}px`,
        [ScrollAreaRootCssVars.scrollAreaCornerWidth]: `${size.width}px`,
      };
    },
  };

  const contextValue: ScrollAreaRootContext = {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleScroll,
    disableViewportSnap,
    get cornerSize() {
      return cornerSize();
    },
    setCornerSize: (value) => {
      setCornerSize(value);
    },
    get thumbSize() {
      return thumbSize();
    },
    setThumbSize: (value) => {
      setThumbSize(value);
    },
    get hasMeasuredScrollbar() {
      return hasMeasuredScrollbar();
    },
    setHasMeasuredScrollbar: (value) => {
      setHasMeasuredScrollbar(value);
    },
    get touchModality() {
      return touchModality();
    },
    cornerRef,
    get scrollingX() {
      return scrollingX();
    },
    get scrollingY() {
      return scrollingY();
    },
    get hovering() {
      return hovering();
    },
    setHovering: (value) => {
      setHovering(value);
    },
    viewportRef,
    viewportElement,
    scrollbarYRef,
    scrollbarXRef,
    thumbYRef,
    thumbXRef,
    rootId,
    get hiddenState() {
      return hiddenState();
    },
    setHiddenState: (value) => {
      setHiddenState(value);
    },
    get overflowEdges() {
      return overflowEdges();
    },
    setOverflowEdges: (value) => {
      setOverflowEdges(value);
    },
    get viewportState() {
      return state();
    },
    get overflowEdgeThreshold() {
      return overflowEdgeThreshold();
    },
  };

  if (!untrack(() => csp.disableStyleElements)) {
    styleDisableScrollbar.inject(untrack(() => csp.nonce));
  }

  return (
    <ScrollAreaRootContext value={contextValue}>
      {untrack(() =>
        useRenderElement('div', componentProps, {
          state,
          ref: (el: HTMLDivElement | null) => {
            rootElement = el;
          },
          props: [props, elementProps],
          stateAttributesMapping: scrollAreaStateAttributesMapping,
        }),
      )}
    </ScrollAreaRootContext>
  );
}


function normalizeOverflowEdgeThreshold(
  threshold: ScrollAreaRoot.Props['overflowEdgeThreshold'] | undefined,
) {
  const thresholds =
    typeof threshold === 'number'
      ? { xStart: threshold, xEnd: threshold, yStart: threshold, yEnd: threshold }
      : threshold;

  return {
    xStart: Math.max(0, thresholds?.xStart || 0),
    xEnd: Math.max(0, thresholds?.xEnd || 0),
    yStart: Math.max(0, thresholds?.yStart || 0),
    yEnd: Math.max(0, thresholds?.yEnd || 0),
  };
}

export interface ScrollAreaRootState {
  /**
   * Whether the scroll area is being scrolled.
   */
  scrolling: boolean;
  /**
   * Whether horizontal overflow is present.
   */
  hasOverflowX: boolean;
  /**
   * Whether vertical overflow is present.
   */
  hasOverflowY: boolean;
  /**
   * Whether there is overflow on the inline start side for the horizontal axis.
   */
  overflowXStart: boolean;
  /**
   * Whether there is overflow on the inline end side for the horizontal axis.
   */
  overflowXEnd: boolean;
  /**
   * Whether there is overflow on the block start side.
   */
  overflowYStart: boolean;
  /**
   * Whether there is overflow on the block end side.
   */
  overflowYEnd: boolean;
  /**
   * Whether the scrollbar corner is hidden.
   */
  cornerHidden: boolean;
}

export interface ScrollAreaRootProps extends BaseUIComponentProps<'div', ScrollAreaRootState> {
  /**
   * The threshold in pixels that must be passed before the overflow edge attributes are applied.
   * Accepts a single number for all edges or an object to configure them individually.
   * @default 0
   */
  overflowEdgeThreshold?:
    | number
    | Partial<{
        xStart: number;
        xEnd: number;
        yStart: number;
        yEnd: number;
      }>
    | undefined;
}

export namespace ScrollAreaRoot {
  export type State = ScrollAreaRootState;
  export type Props = ScrollAreaRootProps;
}

