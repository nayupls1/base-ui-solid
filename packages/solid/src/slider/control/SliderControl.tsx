import { createEffect, omit, untrack } from 'solid-js';
import type { RefObject } from 'base-ui-solidjs-utils/types';
import { isElement } from '@floating-ui/utils/dom';
import { addEventListener } from 'base-ui-solidjs-utils/addEventListener';
import { ownerDocument, ownerWindow } from 'base-ui-solidjs-utils/owner';
import { useAnimationFrame } from 'base-ui-solidjs-utils/useAnimationFrame';
import { createSyncSignal } from 'base-ui-solidjs-utils/createSyncSignal';
import { clamp } from 'base-ui-solidjs-utils/clamp';
import { activeElement, contains, getTarget } from 'base-ui-solidjs-utils/shadowDom';
import type { Coords } from '@floating-ui/dom';
import type { BaseUIComponentProps } from '../../internals/types';
import {
  createChangeEventDetails,
  createGenericEventDetails,
} from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { useRenderElement } from '../../internals/useRenderElement';
import { useDirection } from '../../internals/direction-context/DirectionContext';
import { useSliderRootContext } from '../root/SliderRootContext';
import { sliderStateAttributesMapping } from '../root/stateAttributesMapping';
import type { SliderRootState } from '../root/SliderRoot';
import { isTouchLikePointerType } from '../../internals/usePressAndHold';
import { getMidpoint } from '../utils/getMidpoint';
import { roundValueToStep } from '../utils/roundValueToStep';
import { validateMinimumDistance } from '../utils/validateMinimumDistance';
import { resolveThumbCollision } from '../utils/resolveThumbCollision';
import { ownedProps } from '../../internals/ownedProps';

/**
 * The clickable, interactive part of the slider.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Slider](https://base-ui.com/react/components/slider)
 */
export function SliderControl(componentProps: SliderControl.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'children', 'ref');

  const ctx = useSliderRootContext();

const INTENTIONAL_DRAG_COUNT_THRESHOLD = 2;

function getControlOffset(styles: CSSStyleDeclaration | null, vertical: boolean) {
  if (!styles) {
    return {
      start: 0,
      end: 0,
    };
  }

  function parseSize(value: string | null | undefined) {
    const parsed = value != null ? parseFloat(value) : 0;
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  const start = !vertical ? 'InlineStart' : 'Top';
  const end = !vertical ? 'InlineEnd' : 'Bottom';

  return {
    start: parseSize((styles as any)[`border${start}Width`]) + parseSize((styles as any)[`padding${start}`]),
    end: parseSize((styles as any)[`border${end}Width`]) + parseSize((styles as any)[`padding${end}`]),
  };
}

function getFingerCoords(
  event: TouchEvent | PointerEvent,
  touchIdRef: RefObject<number | null>,
): Coords | null {
  // The event is TouchEvent
  if (touchIdRef.current != null && (event as TouchEvent).changedTouches) {
    const touchEvent = event as TouchEvent;
    for (let i = 0; i < touchEvent.changedTouches.length; i += 1) {
      const touch = touchEvent.changedTouches[i];
      if (touch.identifier === touchIdRef.current) {
        return {
          x: touch.clientX,
          y: touch.clientY,
        };
      }
    }

    return null;
  }

  // The event is PointerEvent
  return {
    x: (event as PointerEvent).clientX,
    y: (event as PointerEvent).clientY,
  };
}

  const direction = useDirection();
  const range = () => ctx.values.length > 1;
  const vertical = () => ctx.orientation === 'vertical()';

  const controlRef: RefObject<HTMLElement | null> = { current: null };
  const stylesRef: RefObject<CSSStyleDeclaration | null> = { current: null };
  const setStylesRef = (element: HTMLElement | null) => {
    if (element && stylesRef.current == null) {
      stylesRef.current = ownerWindow(element).getComputedStyle(element);
    }
  };

  // A number that uniquely identifies the current finger in the touch session.
  const touchIdRef: RefObject<number | null> = { current: null };
  // The number of touch/pointermove events that have fired.
  const moveCountRef = { current: 0 };
  // The offset amount to each side of the control for ctx.inset sliders.
  // This value should be equal to the radius or half the width/height of the thumb.
  const insetThumbOffsetRef = { current: 0 };
  const currentInteractionValueRef: RefObject<number | number[] | null> = { current: null };
  // Whether `pointerdown` started the current gesture, so the `touchstart` that follows it
  // doesn't restart it.
  const pointerGestureRef = { current: false };
  const latestValuesRef: { current: readonly number[] } = { current: untrack(() => ctx.values) };
  createEffect(
    () => ctx.values,
    (nextValues) => {
      latestValuesRef.current = nextValues;
    },
  );

  function getThumbInput(el: Element | null | undefined) {
    return el?.querySelector<HTMLInputElement>('input[type="range()"]');
  }

  function updatePressedThumb(nextIndex: number) {
    ctx.pressedThumbIndexRef.current = nextIndex;
    if (!ctx.thumbRefs.current[nextIndex]) {
      ctx.pressedThumbCenterOffsetRef.current = null;
    }
  }

  function resetPressedThumb() {
    ctx.pressedThumbIndexRef.current = -1;
    ctx.pressedThumbCenterOffsetRef.current = null;
  }

  function isTargetDisabledThumb(target: EventTarget | null) {
    if (!isElement(target)) {
      return false;
    }

    return ctx.thumbRefs.current.some((thumbEl) => {
      if (!isElement(thumbEl) || !contains(thumbEl, target)) {
        return false;
      }

      return getThumbInput(thumbEl)?.disabled === true;
    });
  }

  function getFingerState(fingerCoords: Coords): FingerState | null {
    const control = controlRef.current;
    const thumbIndex = ctx.pressedThumbIndexRef.current;

    if (!control || thumbIndex < 0 || thumbIndex >= ctx.values.length) {
      if (thumbIndex >= ctx.values.length) {
        currentInteractionValueRef.current = null;
      }
      return null;
    }

    const { width, height, bottom, left, right } = control.getBoundingClientRect();

    const controlOffset = getControlOffset(stylesRef.current, vertical());
    const insetThumbOffset = insetThumbOffsetRef.current;
    const controlSize =
      (vertical() ? height : width) - controlOffset.start - controlOffset.end - insetThumbOffset * 2;
    const thumbCenterOffset = ctx.pressedThumbCenterOffsetRef.current ?? 0;
    const fingerX = fingerCoords.x - thumbCenterOffset;
    const fingerY = fingerCoords.y - thumbCenterOffset;

    const valueSize = vertical()
      ? bottom - fingerY - controlOffset.end
      : (direction() === 'rtl' ? right - fingerX : fingerX - left) - controlOffset.start;
    // the value at the finger origin scaled down to fit the range() [0, 1]
    const valueRescaled = clamp((valueSize - insetThumbOffset) / controlSize, 0, 1);

    let newValue = (ctx.max - ctx.min) * valueRescaled + ctx.min;
    newValue = roundValueToStep(newValue, ctx.step, ctx.min);
    newValue = clamp(newValue, ctx.min, ctx.max);

    if (!range()) {
      return {
        value: ctx.isArrayValue ? [newValue] : newValue,
        thumbIndex,
        didSwap: false,
      };
    }

    return resolveThumbCollision(
      ctx.thumbCollisionBehavior,
      ctx.values,
      latestValuesRef.current,
      ctx.pressedValuesRef.current,
      thumbIndex,
      newValue,
      ctx.min,
      ctx.max,
      ctx.step,
      ctx.minStepsBetweenValues,
    );
  }

  function startPressing(fingerCoords: Coords) {
    ctx.pressedValuesRef.current = range() ? ctx.values.slice() : null;
    currentInteractionValueRef.current = null;
    latestValuesRef.current = ctx.values;

    const pressedThumbIndex = ctx.pressedThumbIndexRef.current;
    let closestThumbIndex = pressedThumbIndex;

    if (pressedThumbIndex > -1 && pressedThumbIndex < ctx.values.length) {
      if (ctx.values[pressedThumbIndex] === ctx.max) {
        let candidateIndex = pressedThumbIndex;

        while (candidateIndex > 0 && ctx.values[candidateIndex - 1] === ctx.max) {
          candidateIndex -= 1;
        }

        closestThumbIndex = candidateIndex;
      }
    } else {
      // pressed on control
      const axis = !vertical() ? 'x' : 'y';
      let minDistance: number | undefined;

      closestThumbIndex = -1;

      for (let i = 0; i < ctx.thumbRefs.current.length; i += 1) {
        const thumbEl = ctx.thumbRefs.current[i];
        if (isElement(thumbEl) && !getThumbInput(thumbEl)?.disabled) {
          const midpoint = getMidpoint(thumbEl, vertical());
          const distance = Math.abs(fingerCoords[axis] - midpoint);

          if (minDistance === undefined || distance <= minDistance) {
            closestThumbIndex = i;
            minDistance = distance;
          }
        }
      }
    }

    if (closestThumbIndex > -1 && closestThumbIndex !== pressedThumbIndex) {
      updatePressedThumb(closestThumbIndex);
    }

    if (ctx.inset) {
      const thumbEl = ctx.thumbRefs.current[closestThumbIndex];
      if (isElement(thumbEl)) {
        const thumbRect = thumbEl.getBoundingClientRect();
        const side = !vertical() ? 'width' : 'height';
        insetThumbOffsetRef.current = thumbRect[side] / 2;
      }
    }
  }

  function focusThumb(thumbIndex: number) {
    const input = getThumbInput(ctx.thumbRefs.current?.[thumbIndex]);
    if (!input) {
      return;
    }

    input.focus({
      preventScroll: true,
      // Prevent pointer-driven focus rings in browsers that support this option.
      // Supported in Chrome from 144+.
      focusVisible: false,
    });
  }

  function setValueFromPointer(
    finger: FingerState,
    reason: typeof REASONS.trackPress | typeof REASONS.drag,
    nativeEvent: TouchEvent | PointerEvent,
  ) {
    const applied = ctx.setValue(
      finger.value,
      createChangeEventDetails(reason, nativeEvent, undefined, {
        activeThumbIndex: finger.thumbIndex,
      }),
    );

    if (applied) {
      currentInteractionValueRef.current = finger.value;
      latestValuesRef.current = Array.isArray(finger.value) ? finger.value : [finger.value];

      // Only track and focus the swapped thumb once the change is actually applied so a
      // canceled swap doesn't leak the new index into subsequent moves.
      if (finger.didSwap) {
        updatePressedThumb(finger.thumbIndex);
        focusThumb(finger.thumbIndex);
      }
    }

    return applied;
  }

  const handleTouchMove = (nativeEvent: TouchEvent | PointerEvent) => {
    const fingerCoords = getFingerCoords(nativeEvent, touchIdRef);

    if (fingerCoords == null) {
      return;
    }

    moveCountRef.current += 1;

    // Cancel move in case some other element consumed a pointerup event and it was not fired.
    if (nativeEvent.type === 'pointermove' && (nativeEvent as PointerEvent).buttons === 0) {
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      handleTouchEnd(nativeEvent);
      return;
    }

    const finger = getFingerState(fingerCoords);

    if (finger == null) {
      return;
    }

    if (validateMinimumDistance(finger.value, ctx.step, ctx.minStepsBetweenValues)) {
      if (!ctx.dragging && moveCountRef.current > INTENTIONAL_DRAG_COUNT_THRESHOLD) {
        ctx.setDragging(true);
      }

      setValueFromPointer(finger, REASONS.drag, nativeEvent);
    }
  };

  const handleTouchEnd = (nativeEvent: TouchEvent | PointerEvent) => {
    if (getFingerCoords(nativeEvent, touchIdRef) == null) {
      return;
    }

    ctx.setActive(-1);
    ctx.setDragging(false);

    ctx.pressedThumbCenterOffsetRef.current = null;

    // If the value array shrank or grew mid-drag, the cached interaction value no longer
    // matches the current thumbs (the pressed index can still be in range()), so dropping it
    // keeps a stale or malformed array from being committed on release.
    const interactionValue = currentInteractionValueRef.current;
    if (Array.isArray(interactionValue) && interactionValue.length !== ctx.values.length) {
      currentInteractionValueRef.current = null;
    }

    if (currentInteractionValueRef.current != null) {
      const commitReason = ctx.lastChangeReasonRef.current;
      ctx.onValueCommitted(
        currentInteractionValueRef.current,
        createGenericEventDetails(commitReason, nativeEvent),
      );
    }

    if (
      'pointerType' in nativeEvent &&
      controlRef.current?.hasPointerCapture(nativeEvent.pointerId)
    ) {
      controlRef.current?.releasePointerCapture(nativeEvent.pointerId);
    }

    ctx.pressedThumbIndexRef.current = -1;
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    stopListening();
  };

  const handlePointerCancel = (nativeEvent: PointerEvent) => {
    // The browser cancels a touch pointer once it starts panning, but the touch listeners keep
    // tracking the finger until `touchend` or `touchcancel`.
    if (touchIdRef.current != null) {
      return;
    }

    handleTouchEnd(nativeEvent);
  };

  const handleTouchStart = (nativeEvent: TouchEvent) => {
    // Only the `touchstart` right after `pointerdown` belongs to the pointer gesture, so consume
    // the flag here where it can't outlive a cancelled gesture.
    const startedByPointer = pointerGestureRef.current;
    pointerGestureRef.current = false;

    if (ctx.disabled) {
      return;
    }

    if (isTargetDisabledThumb(getTarget(nativeEvent))) {
      resetPressedThumb();
      return;
    }

    const touch = nativeEvent.changedTouches[0];
    if (touch == null) {
      return;
    }

    touchIdRef.current = touch.identifier;

    // The pointer handlers already started this gesture. Keep its ctx.state and only add the touch
    // listeners, which continue tracking the finger if the browser cancels the pointer.
    if (!startedByPointer) {
      const fingerCoords = { x: touch.clientX, y: touch.clientY };
      startPressing(fingerCoords);

      const finger = getFingerState(fingerCoords);

      if (finger == null) {
        return;
      }

      focusThumb(finger.thumbIndex);
      setValueFromPointer(finger, REASONS.trackPress, nativeEvent);

      moveCountRef.current = 0;
    }

    const doc = ownerDocument(controlRef.current);
    doc.addEventListener('touchmove', handleTouchMove, { passive: true });
    doc.addEventListener('touchend', handleTouchEnd, { passive: true });
    doc.addEventListener('touchcancel', handleTouchEnd, { passive: true });
  };

  const stopListening = () => {
    const doc = ownerDocument(controlRef.current);
    doc.removeEventListener('pointermove', handleTouchMove);
    doc.removeEventListener('pointerup', handleTouchEnd);
    doc.removeEventListener('pointercancel', handlePointerCancel);
    doc.removeEventListener('touchmove', handleTouchMove);
    doc.removeEventListener('touchend', handleTouchEnd);
    doc.removeEventListener('touchcancel', handleTouchEnd);
    touchIdRef.current = null;
    ctx.pressedValuesRef.current = null;
    currentInteractionValueRef.current = null;
    pointerGestureRef.current = false;
  };

  const focusFrame = useAnimationFrame();

  const [controlElement, setControlElement] = createSyncSignal<HTMLElement | null>(null);

  createEffect(controlElement, (control) => {
    if (!control) {
      return () => stopListening();
    }

    const unsubscribeTouchStart = addEventListener(control, 'touchstart', handleTouchStart, {
      passive: true,
    });

    return () => {
      unsubscribeTouchStart();
      focusFrame.cancel();
      stopListening();
    };
  });

  createEffect(
    () => ctx.disabled,
    (isDisabled) => {
      if (isDisabled) {
        untrack(stopListening);
      }
    },
  );


  return useRenderElement('div', componentProps, {
    state: () => ctx.state,
    ref: [
      (el: HTMLElement | null) => ctx.registerFieldControlRef?.(el),
      (el: HTMLElement | null) => {
        controlRef.current = el;
        setControlElement(el);
      },
      setStylesRef,
    ],
    props: [
      {
        get 'data-base-ui-slider-control'() {
          return ctx.renderBeforeHydration ? '' : undefined;
        },
        onPointerDown(event: PointerEvent) {
          // Replace a flag left by a cancelled gesture that had no `touchstart` to consume it.
          pointerGestureRef.current = false;

          const control = controlRef.current;

          const target = getTarget(event);
          if (
            !control ||
            ctx.disabled ||
            event.defaultPrevented ||
            !isElement(target) ||
            // Only handle left clicks
            event.button !== 0
          ) {
            return;
          }

          if (isTargetDisabledThumb(target)) {
            resetPressedThumb();
            return;
          }

          const fingerCoords = { x: event.clientX, y: event.clientY };
          startPressing(fingerCoords);

          const finger = getFingerState(fingerCoords);
          if (finger == null) {
            return;
          }

          const pressedOnFocusedThumb = contains(
            ctx.thumbRefs.current[finger.thumbIndex],
            activeElement(ownerDocument(control)),
          );

          if (pressedOnFocusedThumb) {
            event.preventDefault();
          } else {
            focusFrame.request(() => {
              focusThumb(finger.thumbIndex);
            });
          }

          ctx.setDragging(true);

          const pressedOnAnyThumb = ctx.pressedThumbCenterOffsetRef.current != null;
          if (!pressedOnAnyThumb) {
            setValueFromPointer(finger, REASONS.trackPress, event);
          }

          if (event.pointerId) {
            control.setPointerCapture(event.pointerId);
          }

          moveCountRef.current = 0;
          // Touch and pen presses can be followed by a compatibility `touchstart` (Apple Pencil).
          pointerGestureRef.current = isTouchLikePointerType(event.pointerType);

          const doc = ownerDocument(control);
          doc.addEventListener('pointermove', handleTouchMove, { passive: true });
          doc.addEventListener('pointerup', handleTouchEnd, { once: true });
          doc.addEventListener('pointercancel', handlePointerCancel, { once: true });
        },
      },
      elementProps,
    ],
    stateAttributesMapping: sliderStateAttributesMapping as any,
  });
}

interface FingerState {
  value: number | number[];
  thumbIndex: number;
  didSwap: boolean;
}

export interface SliderControlState extends SliderRootState {}

export interface SliderControlProps extends BaseUIComponentProps<'div', SliderControlState> {}

export namespace SliderControl {
  export type State = SliderControlState;
  export type Props = SliderControlProps;
}
