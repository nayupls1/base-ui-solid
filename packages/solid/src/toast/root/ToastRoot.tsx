import { createEffect, createMemo, createSignal, omit, onCleanup, untrack } from 'solid-js';
import { addEventListener } from 'base-ui-solidjs-utils/addEventListener';
import { ownerDocument } from 'base-ui-solidjs-utils/owner';
import { inertValue } from 'base-ui-solidjs-utils/inertValue';
import { activeElement, closest, contains, getTarget } from 'base-ui-solidjs-utils/shadowDom';
import type { BaseUIComponentProps, HTMLProps } from '../../internals/types';
import type { ToastObject as ToastObjectType } from '../useToastManager';
import { ToastRootContext } from './ToastRootContext';
import { transitionStatusMapping } from '../../internals/stateAttributesMapping';
import type { TransitionStatus } from '../../internals/useTransitionStatus';
import { useToastProviderContext } from '../provider/ToastProviderContext';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import { useRenderElement } from '../../internals/useRenderElement';
import { useOpenChangeComplete } from '../../internals/useOpenChangeComplete';
import {
  BASE_UI_SWIPE_IGNORE_SELECTOR,
  LEGACY_SWIPE_IGNORE_SELECTOR,
} from '../../internals/constants';
import { getDisplacement } from '../../utils/useSwipeDismiss';
import { getElementTransform } from '../../utils/getElementTransform';
import * as ToastRootCssVars from './ToastRootCssVars';
import * as ToastRootDataAttributes from './ToastRootDataAttributes';
import { ownedProps } from '../../internals/ownedProps';

export const toastRootStateAttributesMapping: StateAttributesMapping<ToastRootState> = {
  ...transitionStatusMapping,
  swipeDirection(value) {
    return value ? { [ToastRootDataAttributes.swipeDirection]: value } : null;
  },
};

const SWIPE_THRESHOLD = 40;
const REVERSE_CANCEL_THRESHOLD = 10;
const OPPOSITE_DIRECTION_DAMPING_FACTOR = 0.5;
const MIN_DRAG_THRESHOLD = 1;
const TOAST_SWIPE_IGNORE_SELECTOR = `${BASE_UI_SWIPE_IGNORE_SELECTOR},${LEGACY_SWIPE_IGNORE_SELECTOR}`;

type Direction = 'up' | 'down' | 'left' | 'right';

/**
 * Groups all parts of an individual toast.
 * Renders a `<div>` element.
 *
 * When rendering a list of toasts, key the list by toast id so a toast keeps its root as the
 * store replaces the toast object: `<For each={toasts} keyed={(toast) => toast.id}>`.
 *
 * Documentation: [Base UI Toast](https://base-ui.com/react/components/toast)
 */
export function ToastRoot(componentProps: ToastRoot.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(
    componentProps,
    'toast',
    'render',
    'class',
    'swipeDirection',
    'style',
    'children',
    'ref',
  );

  const toast = () => componentProps.toast;

  const isAnchored = () => toast().positionerProps?.anchor !== undefined;

  const swipeDirections = createMemo<Direction[]>(() => {
    if (isAnchored()) {
      return [];
    }
    const swipeDirection = componentProps.swipeDirection ?? ['down', 'right'];
    return Array.isArray(swipeDirection) ? swipeDirection : [swipeDirection];
  });

  const swipeEnabled = () => swipeDirections().length > 0;

  const store = useToastProviderContext();

  const [currentSwipeDirection, setCurrentSwipeDirection] = createSignal<Direction | undefined>(
    undefined,
    {
      ownedWrite: true,
    },
  );
  const [isSwiping, setIsSwiping] = createSignal(false);
  const [isRealSwipe, setIsRealSwipe] = createSignal(false);
  const [dragOffset, setDragOffset] = createSignal({ x: 0, y: 0 }, { ownedWrite: true });
  const [initialTransform, setInitialTransform] = createSignal(
    { x: 0, y: 0, scale: 1 },
    { ownedWrite: true },
  );
  const [titleId, setTitleId] = createSignal<string | undefined>(undefined, {
    ownedWrite: true,
  });
  const [descriptionId, setDescriptionId] = createSignal<string | undefined>(undefined, {
    ownedWrite: true,
  });
  const [lockedDirection, setLockedDirection] = createSignal<'horizontal' | 'vertical' | null>(
    null,
  );

  let rootRef: HTMLDivElement | null = null;
  const [rootElement, setRootElement] = createSignal<HTMLDivElement | null>(null, {
    ownedWrite: true,
  });
  const rootRefObject = {
    get current() {
      return rootRef;
    },
  };
  let lastToastId: string | undefined;
  let dragStartPos = { x: 0, y: 0 };
  let initialTransformValue = { x: 0, y: 0, scale: 1 };
  let intendedSwipeDirection: Direction | undefined;
  let maxSwipeDisplacement = 0;
  let cancelledSwipe = false;
  let swipeCancelBaseline = { x: 0, y: 0 };
  let isFirstPointerMove = false;
  let dragOffsetValue = { x: 0, y: 0 };
  let activePointerId: number | null = null;
  let dragAbortController: AbortController | null = null;

  const domIndex = store.useState('toastIndex', () => toast().id);
  const visibleIndex = store.useState('toastVisibleIndex', () => toast().id);
  const offsetY = store.useState('toastOffsetY', () => toast().id);
  const focused = store.useState('focused');
  const expanded = store.useState('expanded');

  useOpenChangeComplete({
    get open() {
      return toast().transitionStatus !== 'ending';
    },
    ref: () => rootRef,
    onComplete() {
      const current = untrack(toast);
      if (current.transitionStatus === 'ending') {
        store.removeToast(current.id);
      }
    },
  });

  // Recalculates the natural height of the toast and updates it in the toast manager.
  // The store ignores this write while the toast is transitioning out.
  // Solid updates synchronously, so the `flushSync` flag is accepted for parity but unused.
  function recalculateHeight(_flushSync: boolean = false) {
    const element = rootRef;
    if (!element) {
      return;
    }

    const previousHeight = element.style.height;
    element.style.height = 'auto';

    const height = element.offsetHeight;

    element.style.height = previousHeight;

    store.updateToastInternal(untrack(toast).id, {
      ref: rootRefObject as any,
      height,
      transitionStatus: undefined,
    });
  }

  function setResolvedDragOffset(nextDragOffset: { x: number; y: number }) {
    dragOffsetValue = nextDragOffset;
    setDragOffset(nextDragOffset);
  }

  // Initialize the toast on mount, and reinitialize when it begins a new lifecycle:
  // re-adding an ending toast retains the same root instance, and index-keyed lists can hand
  // an existing instance a different toast.
  createEffect(
    () => [toast().id, toast().transitionStatus, rootElement()] as const,
    ([id, transitionStatus, element]) => {
      if (!element) {
        return;
      }
      const previousToastId = lastToastId;
      // `recalculateHeight` clears the `starting` status itself, so bail out on the
      // resulting re-run and on the later `ending` one, which the store discards anyway.
      if (transitionStatus !== 'starting' && previousToastId === id) {
        return;
      }

      if (previousToastId !== undefined) {
        // A retained root keeps component-local swipe state from its previous lifecycle;
        // clear it so the toast doesn't stay offset or exit in the swiped direction.
        setCurrentSwipeDirection(undefined);
        setInitialTransform({ x: 0, y: 0, scale: 1 });
        setResolvedDragOffset({ x: 0, y: 0 });
      }

      lastToastId = id;
      recalculateHeight();
    },
  );

  onCleanup(() => {
    dragAbortController?.abort();
  });

  function applyDirectionalDamping(deltaX: number, deltaY: number) {
    const damp = (delta: number) =>
      delta > 0
        ? delta ** OPPOSITE_DIRECTION_DAMPING_FACTOR
        : -(Math.abs(delta) ** OPPOSITE_DIRECTION_DAMPING_FACTOR);

    const dampX =
      (deltaX > 0 && !swipeDirections().includes('right')) ||
      (deltaX < 0 && !swipeDirections().includes('left'));
    const dampY =
      (deltaY > 0 && !swipeDirections().includes('down')) ||
      (deltaY < 0 && !swipeDirections().includes('up'));

    return {
      x: dampX ? damp(deltaX) : deltaX,
      y: dampY ? damp(deltaY) : deltaY,
    };
  }

  const handleSwipeEnd = (event: PointerEvent) => {
    if (event.pointerId !== activePointerId) {
      return;
    }

    activePointerId = null;
    dragAbortController?.abort();
    dragAbortController = null;
    setIsSwiping(false);
    setIsRealSwipe(false);
    setLockedDirection(null);

    const resolvedInitialTransform = initialTransformValue;

    if (event.type === 'pointercancel' || cancelledSwipe) {
      setResolvedDragOffset({
        x: resolvedInitialTransform.x,
        y: resolvedInitialTransform.y,
      });
      setCurrentSwipeDirection(undefined);
      return;
    }

    const resolvedDragOffset = dragOffsetValue;
    const deltaX = resolvedDragOffset.x - resolvedInitialTransform.x;
    const deltaY = resolvedDragOffset.y - resolvedInitialTransform.y;
    let dismissDirection: 'up' | 'down' | 'left' | 'right' | undefined;

    for (const direction of swipeDirections()) {
      if (getDisplacement(direction, deltaX, deltaY) > SWIPE_THRESHOLD) {
        dismissDirection = direction;
        break;
      }
    }

    if (dismissDirection) {
      setCurrentSwipeDirection(dismissDirection);
      store.closeToast(toast().id);
    } else {
      setResolvedDragOffset({
        x: resolvedInitialTransform.x,
        y: resolvedInitialTransform.y,
      });
      setCurrentSwipeDirection(undefined);
    }
  };

  function handlePointerDown(event: PointerEvent & { currentTarget: HTMLDivElement }) {
    if (event.button !== 0) {
      return;
    }

    if (event.pointerType === 'touch') {
      store.pauseTimers();
    }

    const target = getTarget(event) as HTMLElement | null;

    const isInteractiveElement = closest(
      target,
      `button,a,input,textarea,[role="button"],${TOAST_SWIPE_IGNORE_SELECTOR}`,
    );

    if (isInteractiveElement) {
      return;
    }

    cancelledSwipe = false;
    intendedSwipeDirection = undefined;
    maxSwipeDisplacement = 0;
    activePointerId = event.pointerId;
    dragStartPos = { x: event.clientX, y: event.clientY };
    swipeCancelBaseline = dragStartPos;

    const element = event.currentTarget;

    const transform = getElementTransform(element);
    initialTransformValue = transform;
    setInitialTransform(transform);
    setResolvedDragOffset({
      x: transform.x,
      y: transform.y,
    });

    store.set('hovering', true);
    setIsSwiping(true);
    setIsRealSwipe(false);
    setLockedDirection(null);
    isFirstPointerMove = true;

    dragAbortController?.abort();
    const nextDragAbortController = new AbortController();
    dragAbortController = nextDragAbortController;

    const doc = ownerDocument(element);
    doc.addEventListener('pointerup', handleSwipeEnd, {
      signal: nextDragAbortController.signal,
    });
    doc.addEventListener('pointercancel', handleSwipeEnd, {
      signal: nextDragAbortController.signal,
    });

    element.setPointerCapture?.(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent) {
    if (event.pointerId !== activePointerId) {
      return;
    }

    // Prevent text selection on Safari
    event.preventDefault();

    if (isFirstPointerMove) {
      // Adjust the starting position to the current position on the first move
      // to account for the delay between pointerdown and the first pointermove on iOS.
      dragStartPos = { x: event.clientX, y: event.clientY };
      isFirstPointerMove = false;
    }

    const { clientY, clientX, movementX, movementY } = event;

    if (
      (movementY < 0 && clientY > swipeCancelBaseline.y) ||
      (movementY > 0 && clientY < swipeCancelBaseline.y)
    ) {
      swipeCancelBaseline = { x: swipeCancelBaseline.x, y: clientY };
    }

    if (
      (movementX < 0 && clientX > swipeCancelBaseline.x) ||
      (movementX > 0 && clientX < swipeCancelBaseline.x)
    ) {
      swipeCancelBaseline = { x: clientX, y: swipeCancelBaseline.y };
    }

    const deltaX = clientX - dragStartPos.x;
    const deltaY = clientY - dragStartPos.y;
    const cancelDeltaY = clientY - swipeCancelBaseline.y;
    const cancelDeltaX = clientX - swipeCancelBaseline.x;

    let resolvedLockedDirection = lockedDirection();

    if (!isRealSwipe()) {
      const movementDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      if (movementDistance >= MIN_DRAG_THRESHOLD) {
        setIsRealSwipe(true);
        // `lockedDirection` is always reset alongside `isRealSwipe`, so it is
        // still `null` here. Locking is only meaningful when both axes are
        // swipeable; otherwise the single axis already constrains the gesture.
        const hasHorizontal =
          swipeDirections().includes('left') || swipeDirections().includes('right');
        const hasVertical = swipeDirections().includes('up') || swipeDirections().includes('down');
        if (hasHorizontal && hasVertical) {
          const absX = Math.abs(deltaX);
          const absY = Math.abs(deltaY);
          resolvedLockedDirection = absX > absY ? 'horizontal' : 'vertical';
          setLockedDirection(resolvedLockedDirection);
        }
      }
    }

    let candidate: 'up' | 'down' | 'left' | 'right' | undefined;
    if (!intendedSwipeDirection) {
      if (resolvedLockedDirection === 'vertical') {
        if (deltaY > 0) {
          candidate = 'down';
        } else if (deltaY < 0) {
          candidate = 'up';
        }
      } else if (resolvedLockedDirection === 'horizontal') {
        if (deltaX > 0) {
          candidate = 'right';
        } else if (deltaX < 0) {
          candidate = 'left';
        }
      } else if (Math.abs(deltaX) >= Math.abs(deltaY)) {
        candidate = deltaX > 0 ? 'right' : 'left';
      } else {
        candidate = deltaY > 0 ? 'down' : 'up';
      }

      if (candidate && swipeDirections().includes(candidate)) {
        intendedSwipeDirection = candidate;
        maxSwipeDisplacement = getDisplacement(candidate, deltaX, deltaY);
        setCurrentSwipeDirection(candidate);
      }
    } else {
      const direction = intendedSwipeDirection;
      const currentDisplacement = getDisplacement(direction, cancelDeltaX, cancelDeltaY);

      if (currentDisplacement > SWIPE_THRESHOLD) {
        cancelledSwipe = false;
        setCurrentSwipeDirection(direction);
      } else if (
        !(swipeDirections().includes('left') && swipeDirections().includes('right')) &&
        !(swipeDirections().includes('up') && swipeDirections().includes('down')) &&
        maxSwipeDisplacement - currentDisplacement >= REVERSE_CANCEL_THRESHOLD
      ) {
        // Mark that a change-of-mind has occurred
        cancelledSwipe = true;
      }
    }

    const dampedDelta = applyDirectionalDamping(deltaX, deltaY);
    let newOffsetX = initialTransformValue.x;
    let newOffsetY = initialTransformValue.y;

    const hasHorizontalDir =
      swipeDirections().includes('left') || swipeDirections().includes('right');
    const hasVerticalDir = swipeDirections().includes('up') || swipeDirections().includes('down');

    if (resolvedLockedDirection !== 'vertical' && hasHorizontalDir) {
      newOffsetX += dampedDelta.x;
    }

    if (resolvedLockedDirection !== 'horizontal' && hasVerticalDir) {
      newOffsetY += dampedDelta.y;
    }

    setResolvedDragOffset({ x: newOffsetX, y: newOffsetY });
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      if (!rootRef || !contains(rootRef, activeElement(ownerDocument(rootRef)))) {
        return;
      }

      store.closeToast(toast().id);
    }
  }

  createEffect(
    () => [swipeEnabled(), rootElement()] as const,
    ([enabled, element]) => {
      if (!enabled || !element) {
        return undefined;
      }

      function preventDefaultTouchStart(event: TouchEvent) {
        if (
          activePointerId === null ||
          !contains(element, getTarget(event) as HTMLElement | null)
        ) {
          return;
        }

        // pointermove preventDefault is not enough on iOS; this
        // non-passive touchmove listener blocks native scrolling while dragging.
        event.preventDefault();
      }

      return addEventListener(element, 'touchmove', preventDefaultTouchStart, {
        passive: false,
      });
    },
  );

  function getDragStyles() {
    const offset = dragOffset();
    const initial = initialTransform();
    const deltaX = offset.x - initial.x;
    const deltaY = offset.y - initial.y;
    const swiping = isSwiping();

    return {
      transition: swiping ? 'none' : undefined,
      // While swiping, freeze the element at its current visual transform so it doesn't snap to the
      // end position.
      transform: swiping
        ? `translateX(${offset.x}px) translateY(${offset.y}px) scale(${initial.scale})`
        : undefined,
      [ToastRootCssVars.swipeMovementX]: `${deltaX}px`,
      [ToastRootCssVars.swipeMovementY]: `${deltaY}px`,
    };
  }

  const isHighPriority = () => toast().priority === 'high';

  const defaultProps: HTMLProps = {
    get role() {
      return isHighPriority() ? 'alertdialog' : 'dialog';
    },
    tabindex: 0,
    'aria-modal': false,
    get 'aria-labelledby'() {
      return titleId();
    },
    get 'aria-describedby'() {
      return descriptionId();
    },
    get 'aria-hidden'() {
      return isHighPriority() && !focused() ? true : undefined;
    },
    get onPointerDown() {
      return swipeEnabled() ? handlePointerDown : undefined;
    },
    get onPointerMove() {
      return swipeEnabled() ? handlePointerMove : undefined;
    },
    get onPointerUp() {
      return swipeEnabled() ? handleSwipeEnd : undefined;
    },
    get onPointerCancel() {
      return swipeEnabled() ? handleSwipeEnd : undefined;
    },
    onKeyDown: handleKeyDown,
    get inert() {
      return inertValue(toast().limited);
    },
    get style() {
      const current = toast();
      return {
        ...getDragStyles(),
        [ToastRootCssVars.index as string]:
          current.transitionStatus === 'ending' ? domIndex() : visibleIndex(),
        [ToastRootCssVars.offsetY as string]: `${offsetY()}px`,
        [ToastRootCssVars.height as string]: current.height ? `${current.height}px` : undefined,
      };
    },
  } as any;

  const toastRoot: ToastRootContext = {
    get toast() {
      return toast();
    },
    setTitleId,
    setDescriptionId,
    recalculateHeight,
    get visibleIndex() {
      return visibleIndex();
    },
    get expanded() {
      return expanded();
    },
  };

  const state = createMemo<ToastRootState>(() => ({
    transitionStatus: toast().transitionStatus,
    expanded: expanded(),
    limited: toast().limited || false,
    type: toast().type,
    swiping: isSwiping(),
    swipeDirection: currentSwipeDirection(),
  }));

  return (
    <ToastRootContext value={toastRoot}>
      {untrack(() =>
        useRenderElement('div', componentProps, {
          ref: (el: HTMLDivElement | null) => {
            rootRef = el;
            setRootElement(el);
          },
          state,
          stateAttributesMapping: toastRootStateAttributesMapping,
          props: [defaultProps, elementProps],
          children: () => componentProps.children,
        }),
      )}
    </ToastRootContext>
  );
}

export type ToastRootToastObject<Data extends object = any> = ToastObjectType<Data>;

export interface ToastRootState {
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
  /**
   * Whether the toasts in the viewport are expanded.
   */
  expanded: boolean;
  /**
   * Whether the toast was limited because the toast limit was exceeded.
   */
  limited: boolean;
  /**
   * The type of the toast.
   */
  type: string | undefined;
  /**
   * Whether the toast is being swiped.
   */
  swiping: boolean;
  /**
   * The direction the toast is being swiped.
   */
  swipeDirection: 'up' | 'down' | 'left' | 'right' | undefined;
}

export interface ToastRootProps extends BaseUIComponentProps<'div', ToastRootState> {
  /**
   * The toast to render.
   */
  toast: ToastRootToastObject<any>;
  /**
   * Direction(s) in which the toast can be swiped to dismiss.
   * @default ['down', 'right']
   */
  swipeDirection?:
    'up' | 'down' | 'left' | 'right' | ('up' | 'down' | 'left' | 'right')[] | undefined;
}

export namespace ToastRoot {
  export type ToastObject<Data extends object = any> = ToastRootToastObject<Data>;
  export type State = ToastRootState;
  export type Props = ToastRootProps;
}
