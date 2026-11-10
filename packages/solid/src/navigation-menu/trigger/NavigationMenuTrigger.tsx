import { createEffect, createMemo, createSignal, flush, omit, Show, untrack } from 'solid-js';
import { addEventListener } from 'base-ui-solidjs-utils/addEventListener';
import { ownerWindow } from 'base-ui-solidjs-utils/owner';
import { useTimeout } from 'base-ui-solidjs-utils/useTimeout';
import { useAnimationFrame } from 'base-ui-solidjs-utils/useAnimationFrame';
import { EMPTY_OBJECT } from 'base-ui-solidjs-utils/empty';
import { closest, contains } from 'base-ui-solidjs-utils/shadowDom';
import { safePolygon } from '../../utils/popups/interactions/safePolygon';
import { useClick } from '../../utils/popups/interactions/useClick';
import { useFloatingRootStore } from '../../utils/popups/floating-root/useFloatingRootStore';
import { useFloatingTree } from '../../utils/popups/tree/FloatingTree';
import { useHoverTriggerInteraction } from '../../utils/popups/interactions/useHoverTriggerInteraction';
import { getHoverIntent } from '../../utils/popups/interactions/hoverIntent';
import {
  getTabbableNearElement,
  getNextTabbable,
  getPreviousTabbable,
  isOutsideEvent,
} from '../../utils/popups/focus/tabbable';
import { stopEvent } from '../../utils/popups/event';
import type { HandleCloseContextBase } from '../../utils/popups/interactions/useHoverShared';
import type { BaseUIComponentProps, NativeButtonProps, HTMLProps } from '../../internals/types';
import { useNavigationMenuItemContext } from '../item/NavigationMenuItemContext';
import {
  useNavigationMenuRootContext,
  useNavigationMenuTreeContext,
} from '../root/NavigationMenuRootContext';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { ownerVisuallyHidden, PATIENT_CLICK_THRESHOLD } from '../../internals/constants';
import { FocusGuard } from '../../utils/popups/focus/FocusGuard';
import { pressableTriggerOpenStateMapping } from '../../utils/popups/popupStateMapping';
import { TransitionStatusDataAttributes } from '../../internals/stateAttributesMapping';
import { isOutsideMenuEvent } from '../utils/isOutsideMenuEvent';
import { CompositeItem } from '../../internals/composite/item/CompositeItem';
import { useButton } from '../../internals/use-button';
import { useAnimationsFinished } from '../../internals/useAnimationsFinished';
import { getCssDimensions } from '../../utils/getCssDimensions';
import type { NavigationMenuRoot } from '../root/NavigationMenuRoot';
import { NAVIGATION_MENU_TRIGGER_IDENTIFIER } from '../utils/constants';
import { setSharedFixedSize } from '../utils/setSharedFixedSize';
import { useNavigationMenuDismissContext } from '../list/NavigationMenuDismissContext';
import * as NavigationMenuPopupCssVars from '../popup/NavigationMenuPopupCssVars';
import * as NavigationMenuPositionerCssVars from '../positioner/NavigationMenuPositionerCssVars';
import { mergeProps } from '../../merge-props';
import { useDirection } from '../../internals/direction-context/DirectionContext';
import { ownedProps } from '../../internals/ownedProps';

const DEFAULT_SIZE = { width: 0, height: 0 };

/**
 * Opens the navigation menu popup when hovered or clicked, revealing the
 * associated content.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Navigation Menu](https://base-ui.com/react/components/navigation-menu)
 */
export function NavigationMenuTrigger(componentProps: NavigationMenuTrigger.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'style',
    'nativeButton',
    'disabled',
    'children',
    'ref',
  );

  const disabled = () => componentProps.disabled ?? false;

  const root = useNavigationMenuRootContext();
  const {
    setValue,
    setActivationDirection,
    setFloatingRootStore,
    rootRef,
    beforeOutsideRef,
    afterOutsideRef,
    afterInsideRef,
    beforeInsideRef,
    prevTriggerElementRef,
    popupAutoSizeResetRef,
    currentContentRef,
    setViewportInert,
    nested,
  } = root;
  const item = useNavigationMenuItemContext();
  const itemValue = () => item.value;
  const nodeId = useNavigationMenuTreeContext() ?? undefined;
  const tree = useFloatingTree();
  const dismissProps = useNavigationMenuDismissContext();
  const direction = useDirection();

  const stickIfOpenTimeout = useTimeout();
  const mutationFrame = useAnimationFrame();
  const resizeFrame = useAnimationFrame();
  const sizeFrame = useAnimationFrame();

  const [triggerElement, setTriggerElement] = createSignal<HTMLElement | null>(null, {
    ownedWrite: true,
  });
  const [stickIfOpen, setStickIfOpen] = createSignal(true, { ownedWrite: true });
  const [pointerType, setPointerType] = createSignal<'mouse' | 'touch' | 'pen' | ''>('', {
    ownedWrite: true,
  });

  const triggerElementRef: { current: HTMLElement | null } = { current: null };
  let prevSize = DEFAULT_SIZE;
  let skipAutoSizeSync = false;
  let toggleSnapshot: boolean | undefined;

  const isActiveItem = createMemo(() => root.open && root.value === itemValue());
  const interactionsEnabled = () =>
    (root.positionerElement != null || root.value == null) && !disabled();
  const hoverPopupElement = () => root.positionerElement || root.viewportElement;
  const hoverInteractionsEnabled = () =>
    (hoverPopupElement() != null || root.value == null) && !disabled();

  const runOnceAnimationsFinish = useAnimationsFinished(() => root.popupElement);

  const handleTriggerElement = (element: HTMLElement | null) => {
    triggerElementRef.current = element;
    setTriggerElement(element);
  };

  const cancelAutoSizeReset = (force = false) => {
    if (!force && popupAutoSizeResetRef.current.owner !== untrack(itemValue)) {
      return;
    }

    popupAutoSizeResetRef.current.abortController?.abort();
    popupAutoSizeResetRef.current.abortController = null;
    popupAutoSizeResetRef.current.owner = null;
  };

  createEffect(isActiveItem, (active) => {
    if (active) {
      return;
    }

    mutationFrame.cancel();
    sizeFrame.cancel();
    cancelAutoSizeReset();
  });

  function setAutoSizes(element: HTMLElement) {
    element.style.setProperty(NavigationMenuPopupCssVars.popupWidth, 'auto');
    element.style.setProperty(NavigationMenuPopupCssVars.popupHeight, 'auto');
  }

  function clearFixedSizes(popup: HTMLElement, positioner: HTMLElement) {
    popup.style.removeProperty(NavigationMenuPopupCssVars.popupWidth);
    popup.style.removeProperty(NavigationMenuPopupCssVars.popupHeight);
    positioner.style.removeProperty(NavigationMenuPositionerCssVars.positionerWidth);
    positioner.style.removeProperty(NavigationMenuPositionerCssVars.positionerHeight);
  }

  function scheduleAutoSizeReset(popup: HTMLElement) {
    cancelAutoSizeReset(true);

    const abortController = new AbortController();
    popupAutoSizeResetRef.current.abortController = abortController;
    popupAutoSizeResetRef.current.owner = untrack(itemValue);

    runOnceAnimationsFinish(() => {
      popupAutoSizeResetRef.current.abortController = null;
      popupAutoSizeResetRef.current.owner = null;
      setAutoSizes(popup);
    }, abortController.signal);
  }

  const handleValueChange = (
    popup: HTMLElement,
    positioner: HTMLElement,
    currentWidth: number,
    currentHeight: number,
  ) => {
    cancelAutoSizeReset(true);

    clearFixedSizes(popup, positioner);

    const { width, height } = getCssDimensions(popup);
    const measuredWidth = width || prevSize.width;
    const measuredHeight = height || prevSize.height;

    if (currentHeight === 0 || currentWidth === 0) {
      currentWidth = measuredWidth;
      currentHeight = measuredHeight;
    }

    popup.style.setProperty(NavigationMenuPopupCssVars.popupWidth, `${currentWidth}px`);
    popup.style.setProperty(NavigationMenuPopupCssVars.popupHeight, `${currentHeight}px`);
    positioner.style.setProperty(
      NavigationMenuPositionerCssVars.positionerWidth,
      `${measuredWidth}px`,
    );
    positioner.style.setProperty(
      NavigationMenuPositionerCssVars.positionerHeight,
      `${measuredHeight}px`,
    );

    sizeFrame.request(() => {
      if (!untrack(isActiveItem)) {
        return;
      }

      popup.style.setProperty(NavigationMenuPopupCssVars.popupWidth, `${measuredWidth}px`);
      popup.style.setProperty(NavigationMenuPopupCssVars.popupHeight, `${measuredHeight}px`);

      scheduleAutoSizeReset(popup);
    });
  };

  const handleInterruptedMutationResize = (
    popup: HTMLElement,
    positioner: HTMLElement,
    currentWidth: number,
    currentHeight: number,
  ) => {
    sizeFrame.cancel();
    mutationFrame.cancel();
    cancelAutoSizeReset(true);

    if (currentWidth === 0 || currentHeight === 0) {
      return;
    }

    setSharedFixedSize(popup, positioner, currentWidth, currentHeight);

    mutationFrame.request(() => {
      mutationFrame.request(() => {
        clearFixedSizes(popup, positioner);

        const { width, height } = getCssDimensions(popup);
        const measuredWidth = width || currentWidth;
        const measuredHeight = height || currentHeight;

        setSharedFixedSize(popup, positioner, currentWidth, currentHeight);

        sizeFrame.request(() => {
          if (!untrack(isActiveItem)) {
            return;
          }

          setSharedFixedSize(popup, positioner, measuredWidth, measuredHeight);
          scheduleAutoSizeReset(popup);
        });
      });
    });
  };

  const syncCurrentSize = (popup: HTMLElement, positioner: HTMLElement) => {
    sizeFrame.cancel();
    cancelAutoSizeReset(true);

    clearFixedSizes(popup, positioner);

    const { width, height } = getCssDimensions(popup);

    if (width === 0 || height === 0) {
      return;
    }

    prevSize = { width, height };
    setAutoSizes(popup);
    positioner.style.setProperty(NavigationMenuPositionerCssVars.positionerWidth, `${width}px`);
    positioner.style.setProperty(NavigationMenuPositionerCssVars.positionerHeight, `${height}px`);
  };

  const getMutationBaseline = (popup: HTMLElement) => {
    const popupWidth = popup.style.getPropertyValue(NavigationMenuPopupCssVars.popupWidth);
    const popupHeight = popup.style.getPropertyValue(NavigationMenuPopupCssVars.popupHeight);
    const isResizing =
      popupWidth !== '' && popupWidth !== 'auto' && popupHeight !== '' && popupHeight !== 'auto';

    if (!isResizing) {
      return { size: prevSize, syncPositioner: false };
    }

    return {
      size: {
        width: popup.offsetWidth || prevSize.width,
        height: popup.offsetHeight || prevSize.height,
      },
      syncPositioner: true,
    };
  };

  createEffect(
    () => root.open,
    (open) => {
      if (!open) {
        stickIfOpenTimeout.clear();
        mutationFrame.cancel();
        resizeFrame.cancel();
        sizeFrame.cancel();
        cancelAutoSizeReset(true);
        skipAutoSizeSync = false;
        setPointerType('');
      }
    },
  );

  createEffect(
    () => root.mounted,
    (mounted) => {
      if (!mounted) {
        prevSize = DEFAULT_SIZE;
      }
    },
  );

  createEffect(
    () => root.popupElement,
    (popupElement) => {
      if (!popupElement || typeof ResizeObserver !== 'function') {
        return undefined;
      }

      const resizeObserver = new ResizeObserver(() => {
        prevSize = {
          width: popupElement.offsetWidth,
          height: popupElement.offsetHeight,
        };
      });

      resizeObserver.observe(popupElement);

      return () => {
        resizeObserver.disconnect();
      };
    },
  );

  createEffect(
    () => [root.open, isActiveItem(), root.popupElement, root.positionerElement] as const,
    ([open, active, popup, positioner]) => {
      if (!open || !active || !popup || !positioner) {
        return undefined;
      }

      const win = ownerWindow(positioner);
      function handleResize() {
        resizeFrame.cancel();
        resizeFrame.request(() => syncCurrentSize(popup!, positioner!));
      }

      const unsubscribe = addEventListener(win, 'resize', handleResize);

      return () => {
        resizeFrame.cancel();
        unsubscribe();
      };
    },
  );

  createEffect(
    () =>
      [root.popupElement, root.positionerElement, isActiveItem(), root.transitionStatus] as const,
    ([popupElement, positionerElement, active, transitionStatus]) => {
      const observedElement = currentContentRef.current;

      if (
        !observedElement ||
        !popupElement ||
        !positionerElement ||
        !active ||
        typeof MutationObserver !== 'function'
      ) {
        return undefined;
      }

      const mutationObserver = new MutationObserver(() => {
        if (
          transitionStatus === 'starting' ||
          popupElement.hasAttribute(TransitionStatusDataAttributes.startingStyle)
        ) {
          syncCurrentSize(popupElement, positionerElement);
          return;
        }

        const { size, syncPositioner } = getMutationBaseline(popupElement);

        if (syncPositioner) {
          handleInterruptedMutationResize(popupElement, positionerElement, size.width, size.height);
          return;
        }

        handleValueChange(popupElement, positionerElement, size.width, size.height);
      });

      mutationObserver.observe(observedElement, {
        childList: true,
        subtree: true,
        characterData: true,
        // `keepMounted` submenu switches update dimensions by toggling hidden
        // content rather than inserting or removing content nodes.
        attributes: true,
        attributeFilter: ['hidden'],
      });

      return () => {
        mutationObserver.disconnect();
      };
    },
  );

  createEffect(
    () => [root.open, root.popupElement, root.positionerElement, root.transitionStatus] as const,
    ([open, popupElement, positionerElement]) => {
      if (untrack(isActiveItem) && open && popupElement && positionerElement) {
        if (skipAutoSizeSync) {
          skipAutoSizeSync = false;
          return undefined;
        }

        const { width, height } = getCssDimensions(popupElement);
        handleValueChange(popupElement, positionerElement, width, height);
      }
      return undefined;
    },
  );

  function handleOpenChange(
    nextOpen: boolean,
    eventDetails: Omit<NavigationMenuRoot.ChangeEventDetails, 'preventUnmountOnClose'>,
  ) {
    const isHover = eventDetails.reason === REASONS.triggerHover;

    if (!untrack(interactionsEnabled)) {
      return;
    }

    if (untrack(pointerType) === 'touch' && isHover) {
      return;
    }

    if (!nextOpen && untrack(() => root.value) !== untrack(itemValue)) {
      return;
    }

    function changeState() {
      if (isHover) {
        // Only allow "patient" clicks to close the popup if it's open.
        // If they clicked within 500ms of the popup opening, keep it open.
        setStickIfOpen(true);
        stickIfOpenTimeout.clear();
        stickIfOpenTimeout.start(PATIENT_CLICK_THRESHOLD, () => {
          setStickIfOpen(false);
        });
      }

      if (nextOpen) {
        setValue(untrack(itemValue), eventDetails);
      } else {
        setValue(null, eventDetails);
        setPointerType('');
      }
    }

    changeState();
    if (isHover) {
      flush();
    }
  }

  const floatingRootStore = useFloatingRootStore({
    get open() {
      return root.open;
    },
    onOpenChange: handleOpenChange as any,
    elements: {
      get anchor() {
        return triggerElement();
      },
      get positionerElement() {
        return hoverPopupElement();
      },
    },
  });

  const hoverIntent = getHoverIntent(floatingRootStore as any);
  const shouldBlockSafePolygonPointerEvents = () => pointerType() !== 'touch';

  createEffect(
    () => root.open,
    (open) => {
      if (!open) {
        (floatingRootStore.context as any).openEvent = undefined;
        hoverIntent.reset();
        hoverIntent.cancelPendingOpen();
      }

      return hoverIntent.restoreOutsidePointerEvents;
    },
  );

  const getInlineHandleCloseContext = () => {
    const hoverPopup = untrack(hoverPopupElement);
    if (
      !nested ||
      untrack(() => root.positionerElement) ||
      !triggerElementRef.current ||
      !hoverPopup
    ) {
      return null;
    }

    return getHandleCloseContext(triggerElementRef.current, hoverPopup, nodeId);
  };

  function getScope() {
    if (nested && untrack(() => root.positionerElement)) {
      return null;
    }

    return closest(triggerElementRef.current, 'ul');
  }

  const handleClose = createMemo(() =>
    safePolygon({
      blockPointerEvents: shouldBlockSafePolygonPointerEvents(),
      getScope,
    }),
  );

  const hoverProps = useHoverTriggerInteraction(floatingRootStore as any, {
    get enabled() {
      return hoverInteractionsEnabled();
    },
    move: false,
    get handleClose() {
      return handleClose();
    },
    restMs: () => (root.mounted && root.positionerElement ? 0 : root.delay),
    delay: () => ({ close: root.closeDelay }),
    triggerElement,
    getHandleCloseContext: getInlineHandleCloseContext,
  });

  const click = useClick(floatingRootStore as any, {
    get enabled() {
      return interactionsEnabled();
    },
    stickIfOpen,
    get toggle() {
      // React's `useClick` sees the value from the render that dispatched the event, not the
      // one `handleOpenEvent` just activated.
      return toggleSnapshot ?? isActiveItem();
    },
  });

  createEffect(
    () => [isActiveItem(), triggerElement()] as const,
    ([active, trigger]) => {
      if (active) {
        setFloatingRootStore(floatingRootStore);
        prevTriggerElementRef.current = trigger;
      }
    },
  );

  function handleActivation(event: MouseEvent | KeyboardEvent) {
    const currentTarget = event.currentTarget as HTMLElement;
    const prevTriggerRect = prevTriggerElementRef.current?.getBoundingClientRect();
    const trigger = untrack(triggerElement);
    const value = untrack(() => root.value);
    const orientation = untrack(() => root.orientation);
    const positionerElement = untrack(() => root.positionerElement);
    const hoverPopup = untrack(hoverPopupElement);

    if (untrack(() => root.mounted) && prevTriggerRect && trigger) {
      const nextTriggerRect = trigger.getBoundingClientRect();
      const isMovingRight = nextTriggerRect.left > prevTriggerRect.left;
      const isMovingDown = nextTriggerRect.top > prevTriggerRect.top;

      if (orientation === 'horizontal' && nextTriggerRect.left !== prevTriggerRect.left) {
        setActivationDirection(isMovingRight ? 'right' : 'left');
      } else if (orientation === 'vertical' && nextTriggerRect.top !== prevTriggerRect.top) {
        setActivationDirection(isMovingDown ? 'down' : 'up');
      }
    }

    // Reset the `openEvent` to `undefined` when the active item changes so that a
    // `click` -> `hover` on new trigger -> `hover` back to old trigger doesn't unexpectedly
    // cause the popup to remain stuck open when leaving the old trigger.
    if (event.type !== 'click' && value != null) {
      (floatingRootStore.context as any).openEvent = undefined;
    }

    if (untrack(pointerType) === 'touch' && event.type !== 'click') {
      flush();
      return;
    }

    // Keyboard open events reach this activation path after `onKeyDown` has already set
    // the value with the `listNavigation` reason.
    if (value != null && event.type !== 'keydown') {
      setValue(
        untrack(itemValue),
        createChangeEventDetails(
          event.type === 'mouseenter' ? REASONS.triggerHover : REASONS.triggerPress,
          event,
        ),
      );
    }

    if (
      event.type === 'mouseenter' &&
      untrack(shouldBlockSafePolygonPointerEvents) &&
      (!nested || !positionerElement) &&
      hoverPopup
    ) {
      const applyPointerEventsMutation = () => {
        const scopeElement = getScope() ?? currentTarget.ownerDocument.body;

        hoverIntent.blockOutsidePointerEvents({
          scopeElement,
          triggerElement: currentTarget,
          positionerElement: hoverPopup,
        });
      };

      if (value != null && value !== untrack(itemValue)) {
        queueMicrotask(applyPointerEventsMutation);
      } else {
        applyPointerEventsMutation();
      }
    }

    flush();
  }

  const handleOpenEvent = (event: MouseEvent | KeyboardEvent) => {
    if (untrack(disabled)) {
      return;
    }

    toggleSnapshot = untrack(isActiveItem);
    queueMicrotask(() => {
      toggleSnapshot = undefined;
    });

    const popupElement = untrack(() => root.popupElement);
    const positionerElement = untrack(() => root.positionerElement);

    if (!popupElement || !positionerElement) {
      handleActivation(event);
      return;
    }

    const { width, height } = getCssDimensions(popupElement);
    const value = untrack(() => root.value);
    const shouldSkipAutoSizeSync =
      value != null &&
      value !== untrack(itemValue) &&
      (event.type === 'click' || untrack(pointerType) !== 'touch');

    handleActivation(event);

    if (shouldSkipAutoSizeSync) {
      skipAutoSizeSync = true;
    }

    handleValueChange(popupElement, positionerElement, width, height);
  };

  const state = createMemo<NavigationMenuTriggerState>(() => ({
    open: isActiveItem(),
    disabled: disabled(),
  }));

  function handleSetPointerType(event: PointerEvent) {
    setPointerType(event.pointerType as any);
  }

  function handleTriggerPointerDown(event: PointerEvent) {
    handleSetPointerType(event);
    hoverIntent.restoreOutsidePointerEvents();
  }

  const defaultProps: HTMLProps = {
    tabindex: 0,
    onMouseEnter: handleOpenEvent,
    onClick: handleOpenEvent,
    onPointerEnter: handleSetPointerType,
    onPointerDown: handleTriggerPointerDown,
    get 'aria-expanded'() {
      return isActiveItem();
    },
    get 'aria-controls'() {
      return isActiveItem() ? root.popupElement?.id : undefined;
    },
    [NAVIGATION_MENU_TRIGGER_IDENTIFIER as string]: '',
    onFocus() {
      if (!untrack(isActiveItem)) {
        return;
      }
      setViewportInert(false);
    },
    onMouseLeave() {
      if (untrack(() => root.value) == null) {
        hoverIntent.restoreOutsidePointerEvents();
      }
    },
    onKeyDown(event: KeyboardEvent) {
      // For nested (submenu) triggers, don't intercept arrow keys that are used for
      // navigation in the parent content. The arrow keys should be handled by the
      // parent's CompositeRoot for navigating between items.
      if (nested) {
        return;
      }

      const orientation = untrack(() => root.orientation);
      const verticalOpenKey = untrack(direction) === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
      const openHorizontal = orientation === 'horizontal' && event.key === 'ArrowDown';
      const openVertical = orientation === 'vertical' && event.key === verticalOpenKey;

      if (openHorizontal || openVertical) {
        setValue(untrack(itemValue), createChangeEventDetails(REASONS.listNavigation, event));
        handleOpenEvent(event);
        stopEvent(event);
      }
    },
    onBlur(event: FocusEvent) {
      const positionerElement = untrack(() => root.positionerElement);
      const popupElement = untrack(() => root.popupElement);
      if (
        positionerElement &&
        popupElement &&
        isOutsideMenuEvent(
          {
            currentTarget: event.currentTarget as HTMLElement | null,
            relatedTarget: event.relatedTarget as HTMLElement | null,
          },
          { popupElement, rootRef, tree, nodeId },
        )
      ) {
        setValue(null, createChangeEventDetails(REASONS.focusOut, event));
      }
    },
  } as any;

  const { getButtonProps, buttonRef } = useButton({
    get disabled() {
      return disabled();
    },
    focusableWhenDisabled: true,
    get native() {
      return componentProps.nativeButton ?? true;
    },
  });

  const referenceElement = hoverPopupElement;

  return (
    <>
      <CompositeItem
        tag="button"
        render={componentProps.render as any}
        class={componentProps.class as any}
        style={componentProps.style as any}
        state={state()}
        stateAttributesMapping={pressableTriggerOpenStateMapping as any}
        refs={[componentProps.ref as any, handleTriggerElement, buttonRef] as any}
        props={
          [
            (merged: Record<string, any>) => mergeProps(merged, click.reference),
            hoverProps ?? EMPTY_OBJECT,
            (merged: Record<string, any>) =>
              mergeProps(merged, dismissProps?.reference ?? EMPTY_OBJECT),
            defaultProps,
            elementProps,
            getButtonProps,
          ] as any
        }
      >
        {componentProps.children}
      </CompositeItem>
      <Show when={isActiveItem()}>
        <FocusGuard
          ref={(el: HTMLSpanElement) => {
            beforeOutsideRef.current = el;
          }}
          onFocus={(event: FocusEvent) => {
            const reference = referenceElement();
            if (reference && isOutsideEvent(event, reference)) {
              beforeInsideRef.current?.focus();
            } else {
              const prevTabbable = getPreviousTabbable(triggerElement());
              prevTabbable?.focus();
            }
          }}
        />
        <span aria-owns={root.viewportElement?.id} style={ownerVisuallyHidden} />
        <FocusGuard
          ref={(el: HTMLSpanElement) => {
            afterOutsideRef.current = el;
          }}
          onFocus={(event: FocusEvent) => {
            const reference = referenceElement();
            const trigger = triggerElement();
            if (reference && isOutsideEvent(event, reference)) {
              setViewportInert(false);
              flush();
              const elementToFocus = afterInsideRef.current || trigger;
              elementToFocus?.focus();
            } else {
              let nextTabbable = getNextTabbable(trigger);

              if (
                nested &&
                !root.positionerElement &&
                reference &&
                nextTabbable &&
                contains(reference, nextTabbable)
              ) {
                nextTabbable = getTabbableNearElement(afterInsideRef.current, 1);
              }

              nextTabbable?.focus();

              if ((!nested || root.positionerElement) && !contains(rootRef.current, nextTabbable)) {
                setValue(null, createChangeEventDetails(REASONS.focusOut, event));
              }
            }
          }}
        />
      </Show>
    </>
  );
}

export interface NavigationMenuTriggerState {
  /**
   * If `true`, the popup is open and the item is active.
   */
  open: boolean;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
}

export interface NavigationMenuTriggerProps
  extends NativeButtonProps, BaseUIComponentProps<'button', NavigationMenuTriggerState> {
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
}

export namespace NavigationMenuTrigger {
  export type State = NavigationMenuTriggerState;
  export type Props = NavigationMenuTriggerProps;
}

function getPlacementFromElements(
  anchorElement: Element,
  positionerElement: HTMLElement,
): HandleCloseContextBase['placement'] {
  const referenceRect = anchorElement.getBoundingClientRect();
  const floatingRect = positionerElement.getBoundingClientRect();
  const referenceCenterX = referenceRect.left + referenceRect.width / 2;
  const referenceCenterY = referenceRect.top + referenceRect.height / 2;
  const floatingCenterX = floatingRect.left + floatingRect.width / 2;
  const floatingCenterY = floatingRect.top + floatingRect.height / 2;
  const deltaX = floatingCenterX - referenceCenterX;
  const deltaY = floatingCenterY - referenceCenterY;

  if (Math.abs(deltaX) >= Math.abs(deltaY)) {
    return deltaX >= 0 ? 'right' : 'left';
  }

  return deltaY >= 0 ? 'bottom' : 'top';
}

function getHandleCloseContext(
  anchorElement: Element,
  positionerElement: HTMLElement,
  nodeId: string | undefined,
): HandleCloseContextBase {
  return {
    placement: getPlacementFromElements(anchorElement, positionerElement),
    elements: {
      domReference: anchorElement,
      floating: positionerElement,
    },
    nodeId,
  };
}
