import { createEffect, onCleanup, untrack } from 'solid-js';
import type { RefObject } from '@base-ui-solid/utils/types';
import { addEventListener } from '@base-ui-solid/utils/addEventListener';
import { NOOP } from '@base-ui-solid/utils/empty';
import { useTimeout } from '@base-ui-solid/utils/useTimeout';
import { useInterval } from '@base-ui-solid/utils/useInterval';
import { ownerWindow } from '@base-ui-solid/utils/owner';

const DEFAULT_TICK_DELAY = 60;
const DEFAULT_START_DELAY = 400;
const DEFAULT_SCROLL_DISTANCE = 8;
const TOUCH_TIMEOUT = 50;
const MAX_POINTER_MOVES_AFTER_TOUCH = 3;

// Treat pen as touch-like to avoid forcing the software keyboard on stylus taps.
// Linux Chrome may emit "pen" historically for mouse usage due to a bug, but the touch path
// still works with minor behavioral differences.
export function isTouchLikePointerType(pointerType: string) {
  return pointerType === 'touch' || pointerType === 'pen';
}

export interface UsePressAndHoldParameters {
  disabled: boolean;
  /**
   * Called on each tick during a hold. Return `false` to stop the auto-change sequence.
   */
  tick: (triggerEvent?: Event) => boolean;
  /**
   * Called when the hold ends via the global `pointerup` event.
   */
  onStop?: ((nativeEvent: PointerEvent) => void) | undefined;
  /**
   * Interval between ticks once the hold is active.
   * @default 60
   */
  tickDelay?: number | undefined;
  /**
   * Delay before the repeating ticks start after the initial hold.
   * @default 400
   */
  startDelay?: number | undefined;
  /**
   * Pointer movement distance (px) that cancels the hold and is treated as scrolling.
   * @default 8
   */
  scrollDistance?: number | undefined;
  /**
   * Ref to the anchor element used to resolve `ownerWindow`.
   */
  elementRef: RefObject<HTMLElement | null>;
}

export interface UsePressAndHoldReturnValue {
  pointerHandlers: {
    onTouchStart: (event: TouchEvent) => void;
    onTouchEnd: (event: TouchEvent) => void;
    onPointerDown: (event: PointerEvent) => void;
    onPointerUp: (event: PointerEvent) => void;
    onPointerMove: (event: PointerEvent) => void;
    onMouseEnter: (event: MouseEvent) => void;
    onMouseLeave: (event: MouseEvent) => void;
    onMouseUp: (event: MouseEvent) => void;
  };
  /**
   * Returns `true` if the `onClick` handler should be skipped.
   * Use this in the element's `onClick` to prevent double-firing on mouse clicks
   * (already handled by `onPointerDown`) and to suppress the synthesized click
   * that browsers fire after a touch hold.
   */
  shouldSkipClick: (event: MouseEvent) => boolean;
}

/**
 * Adds press-and-hold behavior to a button element.
 * On pointer down, performs one action immediately, then after a delay starts
 * continuous repeated actions at a fixed interval. Handles mouse, touch, and pen
 * inputs correctly, including Android-specific quirks.
 */
export function usePressAndHold(params: UsePressAndHoldParameters): UsePressAndHoldReturnValue {
  // Parameters are read lazily, so they can be getters.
  const elementRef = params.elementRef;
  const disabledValue = () => untrack(() => params.disabled);
  const tick = (triggerEvent?: Event) => params.tick(triggerEvent);
  const onStop = (event: PointerEvent) => params.onStop?.(event);

  const startTickTimeout = useTimeout();
  const tickInterval = useInterval();
  const intentionalTouchCheckTimeout = useTimeout();

  const isPressedRef = { current: false };
  const movesAfterTouchRef = { current: 0 };
  const downCoordsRef = { current: { x: 0, y: 0 } };
  const isTouchingButtonRef = { current: false };
  const ignoreClickRef = { current: false };
  const pointerTypeRef = { current: '' };
  const unsubscribeFromGlobalContextMenuRef: { current: () => void } = { current: NOOP };
  const unsubscribeFromGlobalPointerUpRef: { current: () => void } = { current: NOOP };

  const stopAutoChange = () => {
    intentionalTouchCheckTimeout.clear();
    startTickTimeout.clear();
    tickInterval.clear();
    unsubscribeFromGlobalContextMenuRef.current();
    movesAfterTouchRef.current = 0;
  };

  function startAutoChange(triggerNativeEvent?: Event) {
    stopAutoChange();

    const element = elementRef.current;
    if (!element) {
      return;
    }

    const win = ownerWindow(element);

    function handleContextMenu(event: Event) {
      event.preventDefault();
    }

    // A global context menu listener is necessary to prevent the context menu from
    // appearing when the touch is slightly outside of the element's hit area.
    unsubscribeFromGlobalContextMenuRef.current = addEventListener(
      win,
      'contextmenu',
      handleContextMenu,
    );

    // The release listener stays registered through `stopAutoChange` so a hold that auto-stops at
    // a boundary (a repeat tick returning `false`) still fires `onStop` on release. Replace any
    // existing one first so a mouseleave/mouseenter cycle during a hold doesn't stack listeners
    // (which would otherwise fire `onStop` more than once on release).
    unsubscribeFromGlobalPointerUpRef.current();
    unsubscribeFromGlobalPointerUpRef.current = addEventListener(
      win,
      'pointerup',
      (event) => {
        isPressedRef.current = false;
        stopAutoChange();
        onStop(event);
      },
      { once: true },
    );

    if (!tick(triggerNativeEvent)) {
      stopAutoChange();
      return;
    }

    startTickTimeout.start(untrack(() => params.startDelay ?? DEFAULT_START_DELAY), () => {
      tickInterval.start(untrack(() => params.tickDelay ?? DEFAULT_TICK_DELAY), () => {
        if (!tick(triggerNativeEvent)) {
          stopAutoChange();
        }
      });
    });
  }

  onCleanup(() => {
    stopAutoChange();
    unsubscribeFromGlobalPointerUpRef.current();
  });

  createEffect(
    () => params.disabled,
    (disabled) => {
      if (disabled) {
        isPressedRef.current = false;
        isTouchingButtonRef.current = false;
        pointerTypeRef.current = '';
        stopAutoChange();
      }
    },
  );

  const pointerHandlers: UsePressAndHoldReturnValue['pointerHandlers'] = {
    onTouchStart() {
      isTouchingButtonRef.current = true;
    },
    onTouchEnd() {
      isTouchingButtonRef.current = false;
    },
    onPointerDown(event) {
      if (event.defaultPrevented || event.button || disabledValue()) {
        return;
      }

      pointerTypeRef.current = event.pointerType;
      ignoreClickRef.current = false;
      isPressedRef.current = true;
      downCoordsRef.current = { x: event.clientX, y: event.clientY };

      const isTouchPointer = isTouchLikePointerType(event.pointerType);

      if (!isTouchPointer) {
        event.preventDefault();
        startAutoChange(event);
      } else {
        // Check if the pointerdown was intentional and not the result of a scroll or
        // pinch-zoom. In that case, we don't want to start the auto-change sequence.
        intentionalTouchCheckTimeout.start(TOUCH_TIMEOUT, () => {
          const moves = movesAfterTouchRef.current;
          movesAfterTouchRef.current = 0;
          // Only start auto-change if the touch is still pressed (prevents races
          // with pointerup occurring before the timeout fires on quick taps).
          const stillPressed = isPressedRef.current;
          if (stillPressed && moves < MAX_POINTER_MOVES_AFTER_TOUCH) {
            startAutoChange(event);
            ignoreClickRef.current = true; // synthesized click after hold should be ignored
          } else {
            // No auto-change (simple tap or scroll gesture), allow the click handler
            // to perform a single action.
            ignoreClickRef.current = false;
            stopAutoChange();
          }
        });
      }
    },
    onPointerUp(event) {
      // Ensure we mark the press as released for touch flows even if auto-change never
      // started, so the delayed auto-change check won't start after a quick tap.
      if (isTouchLikePointerType(event.pointerType)) {
        isPressedRef.current = false;
      }
    },
    onPointerMove(event) {
      if (disabledValue() || !isTouchLikePointerType(event.pointerType) || !isPressedRef.current) {
        return;
      }

      movesAfterTouchRef.current += 1;

      const { x, y } = downCoordsRef.current;
      const dx = x - event.clientX;
      const dy = y - event.clientY;

      const scrollDistance = untrack(() => params.scrollDistance ?? DEFAULT_SCROLL_DISTANCE);
      if (dx ** 2 + dy ** 2 > scrollDistance ** 2) {
        stopAutoChange();
      }
    },
    onMouseEnter(event) {
      if (
        event.defaultPrevented ||
        disabledValue() ||
        !isPressedRef.current ||
        isTouchingButtonRef.current ||
        isTouchLikePointerType(pointerTypeRef.current)
      ) {
        return;
      }

      startAutoChange(event);
    },
    onMouseLeave() {
      if (isTouchingButtonRef.current) {
        return;
      }

      stopAutoChange();
    },
    // Local fallback for the window `pointerup` listener, which an ancestor can stop from
    // reaching the window by calling `stopPropagation`.
    onMouseUp() {
      if (isTouchingButtonRef.current) {
        return;
      }

      stopAutoChange();
    },
  };

  const shouldSkipClick = (event: MouseEvent): boolean => {
    if (event.defaultPrevented) {
      return true;
    }
    if (isTouchLikePointerType(pointerTypeRef.current)) {
      return ignoreClickRef.current;
    }
    return event.detail !== 0;
  };

  return { pointerHandlers, shouldSkipClick };
}
