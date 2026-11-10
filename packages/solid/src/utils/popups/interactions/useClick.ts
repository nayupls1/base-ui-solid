import { useAnimationFrame } from 'base-ui-solidjs-utils/useAnimationFrame';
import { useTimeout } from 'base-ui-solidjs-utils/useTimeout';
import { getTarget } from 'base-ui-solidjs-utils/shadowDom';
import type { ElementProps, PopupInteractionStore } from '../types';
import { isTypeableElement } from '../element';
import { isMouseLikePointerType, isVirtualPointerEvent } from '../event';
import { createChangeEventDetails } from '../../../internals/createBaseUIEventDetails';
import { REASONS } from '../../../internals/reasons';

export interface UseClickProps {
  /**
   * Whether the Hook is enabled, including all internal Effects and event
   * handlers.
   * @default true
   */
  enabled?: boolean | undefined;
  /**
   * The type of event to use to determine a “click” with mouse input.
   * Keyboard clicks work as normal.
   * @default 'click'
   */
  event?: 'click' | 'mousedown' | 'mousedown-only' | undefined;
  /**
   * Whether to toggle the open state with repeated clicks.
   * @default true
   */
  toggle?: boolean | undefined;
  /**
   * Whether to ignore the logic for mouse input (for example, if `useHover()`
   * is also being used).
   * @default false
   */
  ignoreMouse?: boolean | undefined;
  /**
   * If already open from another event such as the `useHover()` Hook,
   * determines whether to keep the floating element open when clicking the
   * reference element for the first time. A getter is read when the press is handled.
   * @default true
   */
  stickIfOpen?: boolean | (() => boolean) | undefined;
  /**
   * Touch-only delay (ms) before opening. Useful to allow mobile viewport/keyboard to settle.
   * @default 0
   */
  touchOpenDelay?: number | undefined;
  /**
   * The reason for the click.
   * @default REASONS.triggerPress
   */
  reason?: typeof REASONS.triggerPress | typeof REASONS.inputPress | undefined;
}

/**
 * Opens or closes the floating element when clicking the reference element.
 * Props are read lazily, so they can be getters.
 * @see https://floating-ui.com/docs/useClick
 */
export function useClick(store: PopupInteractionStore, props: UseClickProps = {}): ElementProps {
  const storeContext = store.context;

  let pointerType: 'mouse' | 'pen' | 'touch' | 'virtual' | undefined;
  const frame = useAnimationFrame();
  const touchOpenTimeout = useTimeout();

  function setOpenWithTouchDelay(
    nextOpen: boolean,
    nativeEvent: MouseEvent,
    target: HTMLElement,
    currentPointerType: 'mouse' | 'pen' | 'touch' | 'virtual' | undefined,
  ) {
    const details = createChangeEventDetails(
      props.reason ?? REASONS.triggerPress,
      nativeEvent,
      target,
    );
    const touchOpenDelay = props.touchOpenDelay ?? 0;

    if (nextOpen && currentPointerType === 'touch' && touchOpenDelay > 0) {
      touchOpenTimeout.start(touchOpenDelay, () => {
        store.setOpen(true, details);
      });
    } else {
      store.setOpen(nextOpen, details);
    }
  }

  function getNextOpen(
    open: boolean,
    currentTarget: EventTarget | null,
    isClickLikeOpenEvent: (eventType: string | undefined) => boolean,
  ) {
    const openEvent = storeContext.openEvent;
    const hasClickedOnInactiveTrigger = store.select('anchorElement') !== currentTarget;
    const stickIfOpen = props.stickIfOpen ?? true;

    if (open && hasClickedOnInactiveTrigger) {
      return true;
    }

    if (!open) {
      return true;
    }

    if (!(props.toggle ?? true)) {
      return true;
    }

    if (openEvent && (typeof stickIfOpen === 'function' ? stickIfOpen() : stickIfOpen)) {
      return !isClickLikeOpenEvent(openEvent.type);
    }

    return false;
  }

  const reference: ElementProps['reference'] = {
    onPointerDown(event: PointerEvent) {
      pointerType =
        isMouseLikePointerType(event.pointerType, true) && isVirtualPointerEvent(event)
          ? 'virtual'
          : (event.pointerType as typeof pointerType);
    },
    onMouseDown(event: MouseEvent) {
      const currentPointerType = pointerType;
      const eventOption = props.event ?? 'click';
      const open = store.select('open');

      if (
        event.button !== 0 ||
        eventOption === 'click' ||
        (isMouseLikePointerType(currentPointerType, true) && (props.ignoreMouse ?? false))
      ) {
        return;
      }

      const nextOpen = getNextOpen(
        open,
        event.currentTarget,
        (openEventType) => openEventType === 'click' || openEventType === 'mousedown',
      );

      const target = getTarget(event);
      const isTypeable = isTypeableElement(target);

      if (isTypeable || currentPointerType === 'virtual') {
        const pressedElement = (isTypeable ? target : event.currentTarget) as HTMLElement;

        if (!open && !isTypeable && !event.defaultPrevented) {
          pressedElement.focus({ preventScroll: true });
        }

        setOpenWithTouchDelay(nextOpen, event, pressedElement, currentPointerType);
        return;
      }

      const eventCurrentTarget = event.currentTarget as HTMLElement;

      // Wait until focus is set on the element. This is an alternative to
      // `event.preventDefault()` to avoid :focus-visible from appearing when using a pointer.
      frame.request(() => {
        setOpenWithTouchDelay(nextOpen, event, eventCurrentTarget, currentPointerType);
      });
    },
    onClick(event: MouseEvent) {
      const eventOption = props.event ?? 'click';
      if (eventOption === 'mousedown-only') {
        return;
      }

      const currentPointerType = pointerType;

      if (eventOption === 'mousedown' && currentPointerType) {
        pointerType = undefined;
        return;
      }

      if (isMouseLikePointerType(currentPointerType, true) && (props.ignoreMouse ?? false)) {
        return;
      }

      const open = store.select('open');
      const nextOpen = getNextOpen(
        open,
        event.currentTarget,
        (openEventType) =>
          openEventType === 'click' ||
          openEventType === 'mousedown' ||
          openEventType === 'keydown' ||
          openEventType === 'keyup',
      );
      setOpenWithTouchDelay(
        nextOpen,
        event,
        event.currentTarget as HTMLElement,
        currentPointerType,
      );
    },
    onKeyDown() {
      pointerType = undefined;
    },
  };

  return {
    get reference() {
      return (props.enabled ?? true) ? reference : undefined;
    },
  };
}
