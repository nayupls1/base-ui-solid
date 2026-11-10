import { createContext, useContext } from 'solid-js';
import type { RefObject } from 'base-ui-solidjs-utils/types';
import type { Coords, HiddenState, OverflowEdges, ScrollAreaRootState, Size } from './ScrollAreaRoot';

type SetStateAction<T> = T | ((prev: T) => T);

/** Reactive values are getters. */
export interface ScrollAreaRootContext {
  readonly cornerSize: Size;
  setCornerSize: (value: SetStateAction<Size>) => void;
  readonly thumbSize: Size;
  setThumbSize: (value: SetStateAction<Size>) => void;
  readonly hasMeasuredScrollbar: boolean;
  setHasMeasuredScrollbar: (value: SetStateAction<boolean>) => void;
  readonly touchModality: boolean;
  readonly hovering: boolean;
  setHovering: (value: SetStateAction<boolean>) => void;
  readonly scrollingX: boolean;
  readonly scrollingY: boolean;
  viewportRef: RefObject<HTMLDivElement | null>;
  scrollbarYRef: RefObject<HTMLDivElement | null>;
  thumbYRef: RefObject<HTMLDivElement | null>;
  scrollbarXRef: RefObject<HTMLDivElement | null>;
  thumbXRef: RefObject<HTMLDivElement | null>;
  cornerRef: RefObject<HTMLDivElement | null>;
  /** Reactive accessor of the viewport element. */
  viewportElement: () => HTMLDivElement | null;
  handlePointerDown: (event: PointerEvent) => void;
  handlePointerMove: (event: PointerEvent) => void;
  handlePointerUp: (event: PointerEvent) => void;
  handleScroll: (scrollPosition: Coords) => void;
  disableViewportSnap: () => void;
  rootId: string | undefined;
  readonly hiddenState: HiddenState;
  setHiddenState: (value: SetStateAction<HiddenState>) => void;
  readonly overflowEdges: OverflowEdges;
  setOverflowEdges: (value: SetStateAction<OverflowEdges>) => void;
  readonly viewportState: ScrollAreaRootState;
  readonly overflowEdgeThreshold: {
    xStart: number;
    xEnd: number;
    yStart: number;
    yEnd: number;
  };
}

export const ScrollAreaRootContext = createContext<ScrollAreaRootContext | null>(null);

export function useScrollAreaRootContext() {
  const context = useContext(ScrollAreaRootContext);
  if (context == null) {
    throw new Error(
      'Base UI: ScrollAreaRootContext is missing. ScrollArea parts must be placed within <ScrollArea.Root>.',
    );
  }
  return context;
}
