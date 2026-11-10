import type { JSX } from '@solidjs/web';
import type { RefObject } from 'base-ui-solidjs-utils/types';
import { createEffect, createSignal, omit, onCleanup, untrack } from 'solid-js';
import { addEventListener } from 'base-ui-solidjs-utils/addEventListener';
import { mergeCleanups } from 'base-ui-solidjs-utils/mergeCleanups';
import { ownerWindow, ownerDocument } from 'base-ui-solidjs-utils/owner';
import { platform } from 'base-ui-solidjs-utils/platform';
import { useTimeout } from 'base-ui-solidjs-utils/useTimeout';
import { getTarget } from 'base-ui-solidjs-utils/shadowDom';
import { createSyncSignal } from 'base-ui-solidjs-utils/createSyncSignal';
import type { BaseUIComponentProps, HTMLProps } from '../../internals/types';
import { useNumberFieldRootContext } from '../root/NumberFieldRootContext';
import type { NumberFieldRootState } from '../root/NumberFieldRoot';
import { stateAttributesMapping } from '../utils/stateAttributesMapping';
import { NumberFieldScrubAreaContext } from './NumberFieldScrubAreaContext';
import { useRenderElement } from '../../internals/useRenderElement';
import { getViewportRect } from '../utils/getViewportRect';
import { createGenericEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { flushIfPossible } from '../../internals/flushIfPossible';
import { ownedProps } from '../../internals/ownedProps';

const SCRUB_AREA_STYLE: JSX.CSSProperties = {
  'touch-action': 'none',
  '-webkit-user-select': 'none',
  'user-select': 'none',
};

/**
 * An interactive area where the user can click and drag to change the field value.
 * Renders a `<span>` element.
 *
 * Documentation: [Base UI Number Field](https://base-ui.com/react/components/number-field)
 */
export function NumberFieldScrubArea(componentProps: NumberFieldScrubArea.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'direction',
    'pixelSensitivity',
    'teleportDistance',
    'style',
    'children',
    'ref',
  );
  const direction = () => componentProps.direction ?? 'horizontal';
  const pixelSensitivity = () => componentProps.pixelSensitivity ?? 2;

  const ctx = useNumberFieldRootContext();

  const [scrubArea, setScrubArea] = createSyncSignal<HTMLSpanElement | null>(null);
  let isScrubbingNow = false;
  let didMove = false;
  let pointerDownTarget: EventTarget | null = null;
  let nativeClickReceived = false;
  const scrubAreaCursorRef: RefObject<HTMLSpanElement | null> = { current: null };
  let virtualCursorCoords = { x: 0, y: 0 };

  const exitPointerLockTimeout = useTimeout();
  const syntheticClickTimeout = useTimeout();

  const [isTouchInput, setIsTouchInput] = createSignal(false, { ownedWrite: true });
  const [isPointerLockDenied, setIsPointerLockDenied] = createSignal(false, { ownedWrite: true });
  const [isScrubbing, setIsScrubbing] = createSignal(false, { ownedWrite: true });

  function updateCursorTransform(virtualCursor: HTMLSpanElement, x: number, y: number) {
    // Invert the visual viewport scale so the cursor matches the OS cursor, which doesn't
    // scale with the content on pinch-zoom.
    const scale = ownerWindow(virtualCursor).visualViewport?.scale ?? 1;
    virtualCursor.style.transform = `translate3d(${x}px,${y}px,0) scale(${1 / scale})`;
  }

  const onScrub = ({ movementX, movementY }: PointerEvent) => {
    const virtualCursor = scrubAreaCursorRef.current;
    const scrubAreaEl = scrubArea();
    if (!virtualCursor || !scrubAreaEl) {
      return;
    }

    const rect = getViewportRect(untrack(() => componentProps.teleportDistance), scrubAreaEl);
    const coords = virtualCursorCoords;

    // Wrap the cursor to the opposite edge when its center crosses a viewport bound.
    const wrap = (coord: number, halfSize: number, low: number, high: number) => {
      if (coord + halfSize < low) {
        return high - halfSize;
      }
      if (coord + halfSize > high) {
        return low - halfSize;
      }
      return coord;
    };

    const newCoords = {
      x: wrap(Math.round(coords.x + movementX), virtualCursor.offsetWidth / 2, rect.left, rect.right),
      y: wrap(Math.round(coords.y + movementY), virtualCursor.offsetHeight / 2, rect.top, rect.bottom),
    };

    virtualCursorCoords = newCoords;
    updateCursorTransform(virtualCursor, newCoords.x, newCoords.y);
  };

  const onScrubbingChange = (scrubbingValue: boolean, { clientX, clientY }: PointerEvent) => {
    setIsScrubbing(scrubbingValue);
    ctx.setIsScrubbing(scrubbingValue);
    // The virtual cursor must be mounted before it's positioned (`flushSync` upstream).
    flushIfPossible();

    const virtualCursor = scrubAreaCursorRef.current;
    if (!virtualCursor || !scrubbingValue) {
      return;
    }

    const initialCoords = {
      x: clientX - virtualCursor.offsetWidth / 2,
      y: clientY - virtualCursor.offsetHeight / 2,
    };

    virtualCursorCoords = initialCoords;
    updateCursorTransform(virtualCursor, initialCoords.x, initialCoords.y);
  };

  createEffect(
    () => [ctx.state.disabled, ctx.state.readOnly, isScrubbing()] as const,
    function registerGlobalScrubbingEventListeners([disabled, readOnly, scrubbing]) {
      // Only listen while actively scrubbing; avoids unrelated pointerup events committing.
      if (!ctx.inputRef.current || disabled || readOnly || !scrubbing) {
        return undefined;
      }

      let cumulativeDelta = 0;

      function handleScrubPointerUp(event: PointerEvent) {
        function handler() {
          try {
            ownerDocument(scrubArea()).exitPointerLock();
          } catch {
            // Ignore errors.
          } finally {
            isScrubbingNow = false;
            onScrubbingChange(false, event);
            ctx.onValueCommitted(
              ctx.lastChangedValueRef.current ?? ctx.valueRef.current,
              createGenericEventDetails(REASONS.scrub, event) as any,
            );

            // Dispatch a click if no movement happened. While the pointer is locked, the
            // browser targets its click at the lock element instead of the scrub area.
            const target = pointerDownTarget;
            const input = ctx.inputRef.current;
            if (!didMove && target != null && input) {
              const MouseEventConstructor = ownerWindow(input).MouseEvent;
              syntheticClickTimeout.start(0, () => {
                if (nativeClickReceived) {
                  return;
                }

                target.dispatchEvent(
                  new MouseEventConstructor('click', {
                    bubbles: true,
                    cancelable: true,
                  }),
                );
              });
            }

            didMove = false;
            pointerDownTarget = null;
          }
        }

        if (platform.engine.gecko) {
          // Firefox needs a small delay here when soft-clicking as the pointer
          // lock will not release otherwise.
          exitPointerLockTimeout.start(20, handler);
        } else {
          handler();
        }
      }

      function handleScrubPointerMove(event: PointerEvent) {
        if (!isScrubbingNow) {
          return;
        }

        // Prevent text selection.
        event.preventDefault();

        onScrub(event);

        const isVertical = untrack(direction) === 'vertical';
        const { movementX, movementY } = event;
        cumulativeDelta += isVertical ? movementY : movementX;

        if (Math.abs(cumulativeDelta) >= untrack(pixelSensitivity)) {
          cumulativeDelta = 0;
          didMove = true;
          const dValue = isVertical ? -movementY : movementX;
          const stepAmount = ctx.getStepAmount(event);
          const rawAmount = dValue * stepAmount;

          if (rawAmount !== 0) {
            ctx.allowInputSyncRef.current = true;
            ctx.incrementValue(Math.abs(rawAmount), {
              direction: rawAmount >= 0 ? 1 : -1,
              event,
              reason: REASONS.scrub,
            } as any);
          }
        }
      }

      const win = ownerWindow(ctx.inputRef.current);

      const unsubscribe = mergeCleanups(
        addEventListener(win, 'pointerup', handleScrubPointerUp, true),
        addEventListener(win, 'pointermove', handleScrubPointerMove, true),
      );

      return () => {
        exitPointerLockTimeout.clear();
        unsubscribe();
      };
    },
  );

  // If the scrub area unmounts mid-scrub, release pointer lock and clear the root's scrubbing
  // state so it doesn't stay locked or stuck. (No commit: there's no pointer release here.)
  onCleanup(() => {
    if (isScrubbingNow) {
      isScrubbingNow = false;
      ctx.setIsScrubbing(false);
      try {
        ownerDocument(scrubArea()).exitPointerLock();
      } catch {
        // Ignore errors.
      }
    }
  });

  // Prevent scrolling using touch input when scrubbing.
  createEffect(
    () => [scrubArea(), ctx.state.disabled, ctx.state.readOnly] as const,
    function registerScrubberTouchPreventListener([element, disabled, readOnly]) {
      if (!element || disabled || readOnly) {
        return undefined;
      }

      function handleTouchStart(event: TouchEvent) {
        if (event.touches.length === 1) {
          event.preventDefault();
        }
      }

      return addEventListener(element, 'touchstart', handleTouchStart);
    },
  );

  const defaultProps: HTMLProps = {
    role: 'presentation',
    style: SCRUB_AREA_STYLE,
    onClickCapture() {
      nativeClickReceived = true;
    },
    async onPointerDown(event: PointerEvent) {
      if (event.defaultPrevented || ctx.state.readOnly || event.button || ctx.state.disabled) {
        return;
      }

      const isTouch = event.pointerType === 'touch';
      setIsTouchInput(isTouch);

      if (event.pointerType === 'mouse') {
        event.preventDefault();
        ctx.focusInput();
      }

      isScrubbingNow = true;
      didMove = false;
      nativeClickReceived = false;
      syntheticClickTimeout.clear();
      pointerDownTarget = getTarget(event);
      onScrubbingChange(true, event);

      // WebKit causes significant layout shift with the native message, so we can't use it.
      if (!isTouch && !platform.engine.webkit) {
        try {
          // Avoid non-deterministic errors in testing environments.
          await ownerDocument(scrubArea()).body.requestPointerLock();
          setIsPointerLockDenied(false);
        } catch (error) {
          setIsPointerLockDenied(true);
        } finally {
          if (isScrubbingNow) {
            onScrubbingChange(true, event);
          }
        }
      }
    },
  } as any;

  const contextValue: NumberFieldScrubAreaContext = {
    get isScrubbing() {
      return isScrubbing();
    },
    get isTouchInput() {
      return isTouchInput();
    },
    get isPointerLockDenied() {
      return isPointerLockDenied();
    },
    scrubAreaCursorRef,
  };

  return (
    <NumberFieldScrubAreaContext value={contextValue}>
      {untrack(() =>
        useRenderElement('span', componentProps, {
          ref: (el: HTMLSpanElement | null) => {
            setScrubArea(el);
          },
          state: () => ctx.state,
          props: [defaultProps, elementProps],
          stateAttributesMapping,
        }),
      )}
    </NumberFieldScrubAreaContext>
  );
}


export interface NumberFieldScrubAreaState extends NumberFieldRootState {}

export interface NumberFieldScrubAreaProps extends BaseUIComponentProps<
  'span',
  NumberFieldScrubAreaState
> {
  /**
   * Cursor movement direction in the scrub area.
   * @default 'horizontal'
   */
  direction?: 'horizontal' | 'vertical' | undefined;
  /**
   * Determines how many pixels the cursor must move before the value changes.
   * A higher value will make scrubbing less sensitive.
   * @default 2
   */
  pixelSensitivity?: number | undefined;
  /**
   * If specified, determines the distance that the cursor may move from the center
   * of the scrub area before it will loop back around.
   */
  teleportDistance?: number | undefined;
}

export namespace NumberFieldScrubArea {
  export type State = NumberFieldScrubAreaState;
  export type Props = NumberFieldScrubAreaProps;
}
