import { createEffect, onCleanup, untrack, type Accessor } from 'solid-js';
import { addEventListener } from '@base-ui-solid/utils/addEventListener';
import { mergeCleanups } from '@base-ui-solid/utils/mergeCleanups';
import { contains } from '@base-ui-solid/utils/shadowDom';
import { isElement } from '@floating-ui/utils/dom';
import { REASONS } from '../../../internals/reasons';
import type { FloatingUIOpenChangeDetails, HTMLProps } from '../../../internals/types';
import { useFloatingTree } from '../tree/FloatingTree';
import type { FloatingTreeStore } from '../tree/FloatingTreeStore';
import type { Delay, PopupInteractionStore } from '../types';
import { getHoverIntent } from './hoverIntent';
import type { HoverIntentTriggerOptions } from './hoverIntent';
import type { HandleClose, HandleCloseContextBase } from './useHoverShared';

export interface UseHoverTriggerInteractionProps {
  /**
   * Whether the Hook is enabled, including all internal Effects and event
   * handlers.
   * @default true
   */
  enabled?: boolean | undefined;
  /**
   * Accepts an event handler that runs on `mousemove` to control when the
   * floating element closes once the cursor leaves the reference element.
   * @default null
   */
  handleClose?: HandleClose | null | undefined;
  /**
   * Waits until the user's cursor is at "rest" over the reference element
   * before changing the `open` state.
   * @default 0
   */
  restMs?: number | (() => number) | undefined;
  /**
   * Waits for the specified time when the event listener runs before changing
   * the `open` state.
   * @default 0
   */
  delay?: Delay | (() => Delay) | undefined;
  /**
   * Whether moving the cursor over the floating element will open it, without a
   * regular hover event required.
   * @default true
   */
  move?: boolean | undefined;
  /**
   * Whether the logic only runs for mouse input, ignoring touch input.
   * Note: due to a bug with Linux Chrome, "pen" inputs are considered "mouse".
   * @default false
   */
  mouseOnly?: boolean | undefined;
  /**
   * External FloatingTree to use when the one provided by context can't be used.
   */
  externalTree?: FloatingTreeStore | undefined;
  /**
   * Whether the hook controls the active trigger. When false, the props are
   * returned under the `trigger` key so they can be applied to inactive
   * triggers via `getTriggerProps`.
   * @default true
   */
  isActiveTrigger?: boolean | undefined;
  /**
   * The trigger element (an accessor) to attach the hover listeners to.
   */
  triggerElement?: Accessor<Element | null> | undefined;
  getHandleCloseContext?: (() => HandleCloseContextBase | null) | undefined;
  /**
   * Called before each hover-driven open attempt (immediate, delayed, and rest-ms
   * paths). Return `false` to veto; any other return value permits the open.
   */
  shouldOpen?: (() => boolean) | undefined;
  /**
   * Regression workaround (#5152): also cancels a pending hover-open from the
   * trigger's `mouseout`, backing up a `mouseleave` that Chrome can drop during
   * a fast pointer sweep and leave a submenu stuck open.
   *
   * WARNING: only enable on single-trigger, hover-driven roots (e.g.
   * `Menu.SubmenuTrigger`).
   * @default false
   */
  guardStaleOpen?: boolean | undefined;
}

const EMPTY_ELEMENT: Accessor<Element | null> = () => null;

/**
 * Provides hover interactions that should be attached to trigger elements.
 * Props are read lazily, so they can be getters.
 */
export function useHoverTriggerInteraction(
  store: PopupInteractionStore,
  props: UseHoverTriggerInteractionProps = {},
): HTMLProps {
  const { events } = store.context;

  const tree = useFloatingTree(untrack(() => props.externalTree));

  const intent = getHoverIntent(store);
  const isHoverCloseActiveRef = { current: false };

  const enabled = () => props.enabled ?? true;
  const triggerElement = () => (props.triggerElement ?? EMPTY_ELEMENT)();

  const handleCloseRef = {
    get current() {
      return props.handleClose ?? null;
    },
  };
  const delayRef = {
    get current() {
      return props.delay ?? 0;
    },
  };
  const restMsRef = {
    get current() {
      return props.restMs ?? 0;
    },
  };
  const enabledRef = {
    get current() {
      return enabled();
    },
  };
  const triggerElementRef = {
    get current() {
      return untrack(triggerElement);
    },
  };

  const checkShouldOpen = () => props.shouldOpen?.() !== false;

  createEffect(
    () => [props.isActiveTrigger ?? true, props.handleClose] as const,
    ([isActiveTrigger, handleClose]) => {
      if (isActiveTrigger) {
        intent.handleCloseOptions = handleClose?.__options;
      }
    },
  );

  onCleanup(() => {
    intent.cancelPendingOpen();
    intent.stopSafePolygon();
  });

  createEffect(enabled, (isEnabled) => {
    if (!isEnabled) {
      return undefined;
    }

    function onOpenChangeLocal(details: FloatingUIOpenChangeDetails) {
      if (!details.open) {
        isHoverCloseActiveRef.current = details.reason === REASONS.triggerHover;
        intent.cancel();
      } else {
        isHoverCloseActiveRef.current = false;
      }
    }

    events.on('openchange', onOpenChangeLocal);
    return () => {
      events.off('openchange', onOpenChangeLocal);
    };
  });

  createEffect(
    () =>
      [
        enabled(),
        triggerElement(),
        props.isActiveTrigger ?? true,
        props.mouseOnly ?? false,
        props.move ?? true,
        props.guardStaleOpen ?? false,
      ] as const,
    ([isEnabled, element, isActiveTrigger, mouseOnly, move, guardStaleOpen]) => {
      if (!isEnabled) {
        return undefined;
      }

      const trigger =
        (element as HTMLElement | null) ??
        (isActiveTrigger ? (store.select('anchorElement') as HTMLElement | null) : null);

      if (!isElement(trigger)) {
        return undefined;
      }

      const options: HoverIntentTriggerOptions = {
        delay: delayRef,
        restMs: restMsRef,
        handleClose: handleCloseRef,
        enabled: enabledRef,
        isHoverCloseActive: isHoverCloseActiveRef,
        triggerElementRef,
        mouseOnly,
        tree,
        shouldOpen: checkShouldOpen,
        getHandleCloseContext: props.getHandleCloseContext,
      };

      function onMouseEnter(event: MouseEvent) {
        intent.onTriggerMouseEnter(event, options);
      }

      function onMouseLeave(event: MouseEvent) {
        intent.onTriggerMouseLeave(event, options);
      }

      function onMouseOut(event: MouseEvent) {
        if (contains(trigger, event.relatedTarget as Element | null)) {
          return; // moved within the trigger's own subtree
        }
        intent.cancelPendingOpen();
      }

      const staleOpenGuard = guardStaleOpen
        ? addEventListener(trigger, 'mouseout', onMouseOut)
        : undefined;

      return mergeCleanups(
        move && addEventListener(trigger, 'mousemove', onMouseEnter, { once: true }),
        addEventListener(trigger, 'mouseenter', onMouseEnter),
        addEventListener(trigger, 'mouseleave', onMouseLeave),
        staleOpenGuard,
      );
    },
  );

  function setPointerRef(event: PointerEvent) {
    intent.pointerType = event.pointerType;
  }

  return {
    onPointerDown(event: PointerEvent) {
      if (enabled()) {
        setPointerRef(event);
      }
    },
    onPointerEnter(event: PointerEvent) {
      if (enabled()) {
        setPointerRef(event);
      }
    },
    onMouseMove(event: MouseEvent) {
      if (!enabled()) {
        return;
      }
      intent.onTriggerMouseMove(event, {
        restMs: restMsRef,
        mouseOnly: props.mouseOnly ?? false,
        shouldOpen: checkShouldOpen,
      });
    },
  };
}
