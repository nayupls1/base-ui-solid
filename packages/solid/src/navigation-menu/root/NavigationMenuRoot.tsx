import type { JSX } from '@solidjs/web';
import type { RefObject } from 'base-ui-solidjs-utils/types';
import { createEffect, createMemo, createSignal, omit, untrack } from 'solid-js';
import { isHTMLElement } from '@floating-ui/utils/dom';
import { useControlled } from 'base-ui-solidjs-utils/useControlled';
import { ownerDocument } from 'base-ui-solidjs-utils/owner';
import { activeElement, contains } from 'base-ui-solidjs-utils/shadowDom';
import {
  FloatingNode,
  FloatingTree,
  useFloatingNodeId,
  useFloatingParentNodeId,
} from '../../utils/popups/tree/FloatingTree';
import type { FloatingRootStore } from '../../utils/popups/floating-root/FloatingRootStore';
import { assignRefs, useRenderElement, type RefInput } from '../../internals/useRenderElement';
import {
  NavigationMenuRootContext,
  NavigationMenuTreeContext,
  useNavigationMenuRootContext,
} from './NavigationMenuRootContext';
import type { NavigationMenuPopupAutoSizeResetState } from './NavigationMenuRootContext';
import type { BaseUIComponentProps } from '../../internals/types';
import { useOpenChangeComplete } from '../../internals/useOpenChangeComplete';
import { useUnmountAfterClose } from '../../internals/useUnmountAfterClose';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import type { BaseUIChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import * as NavigationMenuPositionerCssVars from '../positioner/NavigationMenuPositionerCssVars';
import { setSharedFixedSize } from '../utils/setSharedFixedSize';
import { ownedProps } from '../../internals/ownedProps';

const blockedReturnFocusReasons = new Set<string>([
  REASONS.triggerHover,
  REASONS.outsidePress,
  REASONS.focusOut,
]);

function getPositionerFixedSize(positionerElement: HTMLElement) {
  // Read the last fixed positioner size rather than measuring the popup now:
  // during a controlled close, the popup can already be in its exit render and
  // report 0 before the closing transition gets a stable size to animate from.
  const width =
    parseFloat(
      positionerElement.style.getPropertyValue(NavigationMenuPositionerCssVars.positionerWidth),
    ) || 0;
  const height =
    parseFloat(
      positionerElement.style.getPropertyValue(NavigationMenuPositionerCssVars.positionerHeight),
    ) || 0;

  if (width <= 0 || height <= 0) {
    return null;
  }

  return { width, height };
}

/**
 * Groups all parts of the navigation menu.
 * Renders a `<nav>` element at the root, or `<div>` element when nested.
 *
 * Documentation: [Base UI Navigation Menu](https://base-ui.com/react/components/navigation-menu)
 */
export function NavigationMenuRoot<Value = any>(componentProps: NavigationMenuRoot.Props<Value>) {
  componentProps = ownedProps(componentProps);

  const delay = () => componentProps.delay ?? 50;
  const closeDelay = () => componentProps.closeDelay ?? 50;
  const orientation = () => componentProps.orientation ?? 'horizontal';

  const nested = useFloatingParentNodeId() != null;
  const parentRootContext = useNavigationMenuRootContext(true);

  const [value, setValueUnwrapped] = useControlled<NavigationMenuRoot.Value<Value>>({
    controlled: () => componentProps.value,
    default: untrack(() => componentProps.defaultValue) ?? null,
    name: 'NavigationMenu',
    state: 'value',
  });

  // Derive open state from value being non-nullish
  const open = createMemo(() => value() != null);

  let closeReason: NavigationMenuRoot.ChangeEventReason | undefined;
  const rootRef: RefObject<HTMLDivElement | null> = { current: null };

  const [positionerElement, setPositionerElement] = createSignal<HTMLElement | null>(null, {
    ownedWrite: true,
  });
  const [popupElement, setPopupElement] = createSignal<HTMLElement | null>(null, {
    ownedWrite: true,
  });
  const [viewportElement, setViewportElement] = createSignal<HTMLElement | null>(null, {
    ownedWrite: true,
  });
  const [viewportTargetElement, setViewportTargetElement] = createSignal<HTMLElement | null>(null, {
    ownedWrite: true,
  });
  const [activationDirection, setActivationDirection] = createSignal<
    NavigationMenuRootContext['activationDirection']
  >(null, { ownedWrite: true });
  const [floatingRootStore, setFloatingRootStore] = createSignal<FloatingRootStore | undefined>(
    undefined,
    { ownedWrite: true },
  );
  const [viewportInert, setViewportInert] = createSignal(false, { ownedWrite: true });

  const prevTriggerElementRef: RefObject<Element | null | undefined> = { current: null };
  const currentContentRef: RefObject<HTMLDivElement | null> = { current: null };
  const beforeInsideRef: RefObject<HTMLSpanElement | null> = { current: null };
  const afterInsideRef: RefObject<HTMLSpanElement | null> = { current: null };
  const beforeOutsideRef: RefObject<HTMLSpanElement | null> = { current: null };
  const afterOutsideRef: RefObject<HTMLSpanElement | null> = { current: null };
  // Shared across triggers so a newly active trigger can cancel a stale
  // popup auto-size reset scheduled by the previously active trigger.
  const popupAutoSizeResetRef: RefObject<NavigationMenuPopupAutoSizeResetState> = {
    current: {
      abortController: null,
      owner: null,
    },
  };

  const [preventUnmountOnClose, setPreventUnmountOnClose] = createSignal(false, {
    ownedWrite: true,
  });
  const {
    mounted,
    transitionStatus,
    preventUnmountingOnClose,
    forceUnmount: handleUnmount,
  } = useUnmountAfterClose({
    get open() {
      return open();
    },
    ref: {
      get current() {
        return untrack(popupElement);
      },
    },
    get preventUnmountOnClose() {
      return preventUnmountOnClose();
    },
    setPreventUnmountOnClose,
    onUnmount() {
      const popup = untrack(popupElement);
      const doc = ownerDocument(rootRef.current);
      const activeEl = activeElement(doc);

      const isReturnFocusBlocked = closeReason ? blockedReturnFocusReasons.has(closeReason) : false;

      if (
        !isReturnFocusBlocked &&
        isHTMLElement(prevTriggerElementRef.current) &&
        (activeEl === ownerDocument(popup).body || contains(popup, activeEl)) &&
        popup
      ) {
        prevTriggerElementRef.current.focus({ preventScroll: true });
        prevTriggerElementRef.current = undefined;
      }

      untrack(() => componentProps.onOpenChangeComplete)?.(false);
      setActivationDirection(null);
      setFloatingRootStore(undefined);

      currentContentRef.current = null;
      closeReason = undefined;
    },
  });

  // The viewport target may be the animated element instead of the popup.
  useOpenChangeComplete({
    get enabled() {
      return mounted() && !open() && !preventUnmountingOnClose();
    },
    get open() {
      return open();
    },
    ref: {
      get current() {
        return untrack(viewportTargetElement);
      },
    },
    onComplete() {
      if (!untrack(open)) {
        handleUnmount();
      }
    },
  });

  createEffect(
    () => [open(), popupElement(), positionerElement()] as const,
    ([isOpen, popup, positioner]) => {
      if (isOpen) {
        return;
      }

      if (!positioner || !popup) {
        return;
      }

      const closeTransitionSize = getPositionerFixedSize(positioner);

      if (!closeTransitionSize) {
        return;
      }

      // No cleanup is needed for this fixed size: if the popup unmounts, the inline
      // styles are removed with it. If it stays mounted, reopening runs the trigger's
      // sizing logic which clears these vars via `clearFixedSizes`/`setAutoSizes`.
      setSharedFixedSize(popup, positioner, closeTransitionSize.width, closeTransitionSize.height);
    },
  );

  createEffect(value, () => {
    setViewportInert(false);
  });

  const setValue = (
    nextValue: NavigationMenuRoot.Value<Value>,
    eventDetails: Omit<NavigationMenuRoot.ChangeEventDetails, 'preventUnmountOnClose'>,
  ) => {
    const currentValue = untrack(value);
    if (nextValue == null) {
      closeReason = eventDetails.reason;
    }

    const changeEventDetails = eventDetails as NavigationMenuRoot.ChangeEventDetails;
    // Navigation Menu only takes the request from `onValueChange` itself, not after an `await`.
    let unmountPrevented = false;
    changeEventDetails.preventUnmountOnClose = () => {
      unmountPrevented = true;
    };

    if (nextValue !== currentValue) {
      untrack(() => componentProps.onValueChange)?.(nextValue, changeEventDetails);
    }

    if (eventDetails.isCanceled) {
      return;
    }

    if (nextValue == null) {
      // A redundant close (for example the trigger's blur after an imperative close) skips
      // `onValueChange`, so it can't opt out again and must not discard the recorded opt-out.
      if (currentValue != null) {
        setPreventUnmountOnClose(unmountPrevented);
      }
      setActivationDirection(null);
      setFloatingRootStore(undefined);
    }

    setValueUnwrapped(nextValue);

    if (
      nested &&
      nextValue == null &&
      eventDetails.reason === REASONS.linkPress &&
      parentRootContext
    ) {
      parentRootContext.setValue(null, eventDetails);
    }
  };

  createEffect(
    () => componentProps.actionsRef,
    (actionsRef) => {
      assignRefs(actionsRef as RefInput<NavigationMenuRoot.Actions | null>, {
        unmount: handleUnmount,
        close: () => setValue(null, createChangeEventDetails(REASONS.imperativeAction)),
      });
    },
  );

  const contextValue: NavigationMenuRootContext<Value> = {
    get open() {
      return open();
    },
    get value() {
      return value();
    },
    setValue,
    get mounted() {
      return mounted();
    },
    get transitionStatus() {
      return transitionStatus();
    },
    get positionerElement() {
      return positionerElement();
    },
    setPositionerElement,
    get popupElement() {
      return popupElement();
    },
    setPopupElement,
    get viewportElement() {
      return viewportElement();
    },
    setViewportElement,
    get viewportTargetElement() {
      return viewportTargetElement();
    },
    setViewportTargetElement,
    get activationDirection() {
      return open() ? activationDirection() : null;
    },
    setActivationDirection,
    get floatingRootStore() {
      return floatingRootStore();
    },
    setFloatingRootStore,
    currentContentRef,
    nested,
    rootRef,
    beforeInsideRef,
    afterInsideRef,
    beforeOutsideRef,
    afterOutsideRef,
    prevTriggerElementRef,
    popupAutoSizeResetRef,
    get delay() {
      return delay();
    },
    get closeDelay() {
      return closeDelay();
    },
    get orientation() {
      return orientation();
    },
    get viewportInert() {
      return viewportInert();
    },
    setViewportInert,
  } as NavigationMenuRootContext<Value>;

  const jsx = () => (
    <NavigationMenuRootContext value={contextValue}>
      <TreeContext componentProps={componentProps} />
    </NavigationMenuRootContext>
  );

  if (!nested) {
    // FloatingTree provides context to nested menus
    return <FloatingTree>{jsx()}</FloatingTree>;
  }

  return jsx();
}

function TreeContext<Value>(props: { componentProps: NavigationMenuRoot.Props<Value> }) {
  const componentProps = props.componentProps;
  const elementProps = omit(
    componentProps,
    'class',
    'render',
    'defaultValue',
    'value',
    'onValueChange',
    'actionsRef',
    'delay',
    'closeDelay',
    'orientation',
    'onOpenChangeComplete',
    'style',
    'children',
    'ref',
  );

  const nodeId = useFloatingNodeId();
  const context = useNavigationMenuRootContext();

  const state = (): NavigationMenuRootState => ({
    open: context.open,
    nested: context.nested,
  });

  return (
    <NavigationMenuTreeContext value={nodeId ?? null}>
      <FloatingNode id={nodeId}>
        {untrack(() =>
          useRenderElement(context.nested ? 'div' : 'nav', componentProps, {
            state,
            ref: (el: HTMLDivElement | null) => {
              context.rootRef.current = el;
            },
            props: [elementProps],
            children: () => componentProps.children,
          }),
        )}
      </FloatingNode>
    </NavigationMenuTreeContext>
  );
}

export interface NavigationMenuRootState {
  /**
   * If `true`, the popup is open.
   */
  open: boolean;
  /**
   * Whether the navigation menu is nested.
   */
  nested: boolean;
}

export interface NavigationMenuRootProps<Value = any> extends BaseUIComponentProps<
  'nav',
  NavigationMenuRootState
> {
  /**
   * A ref to imperative actions.
   * - `unmount`: Ends the closing phase of the navigation menu popup after an externally controlled closing animation finishes.
   * Call `preventUnmountOnClose()` in `onValueChange` first, otherwise the navigation menu popup completes closing on its own.
   * Whether it leaves the DOM is decided by `keepMounted` on the portal.
   * - `close`: Closes the navigation menu imperatively when called.
   */
  actionsRef?: RefObject<NavigationMenuRoot.Actions | null> | undefined;
  /**
   * Event handler called after any animations complete when the navigation menu is closed.
   */
  onOpenChangeComplete?: ((open: boolean) => void) | undefined;
  /**
   * The controlled value of the navigation menu item that should be currently open.
   * When non-nullish, the menu will be open. When nullish, the menu will be closed.
   *
   * To render an uncontrolled navigation menu, use the `defaultValue` prop instead.
   * @default null
   */
  value?: Value | null | undefined;
  /**
   * The uncontrolled value of the item that should be initially selected.
   *
   * To render a controlled navigation menu, use the `value` prop instead.
   * @default null
   */
  defaultValue?: Value | null | undefined;
  /**
   * Callback fired when the value changes.
   */
  onValueChange?:
    | ((value: Value | null, eventDetails: NavigationMenuRoot.ChangeEventDetails) => void)
    | undefined;
  /**
   * How long to wait before opening the navigation popup. Specified in milliseconds.
   * @default 50
   */
  delay?: number | undefined;
  /**
   * How long to wait before closing the navigation popup. Specified in milliseconds.
   * @default 50
   */
  closeDelay?: number | undefined;
  /**
   * The orientation of the navigation menu.
   * @default 'horizontal'
   */
  orientation?: 'horizontal' | 'vertical' | undefined;
}

export interface NavigationMenuRootActions {
  unmount: () => void;
  close: () => void;
}

export type NavigationMenuRootChangeEventReason =
  | typeof REASONS.triggerPress
  | typeof REASONS.triggerHover
  | typeof REASONS.outsidePress
  | typeof REASONS.listNavigation
  | typeof REASONS.focusOut
  | typeof REASONS.escapeKey
  | typeof REASONS.linkPress
  | typeof REASONS.imperativeAction
  | typeof REASONS.none;

export type NavigationMenuRootChangeEventDetails =
  BaseUIChangeEventDetails<NavigationMenuRoot.ChangeEventReason> & {
    /** Prevents the popup from unmounting until the `unmount` action is called. */
    preventUnmountOnClose: () => void;
  };

export namespace NavigationMenuRoot {
  export type State = NavigationMenuRootState;
  export type Props<TValue = any> = NavigationMenuRootProps<TValue>;
  export type Value<TValue = any> = TValue | null;
  export type Actions = NavigationMenuRootActions;
  export type ChangeEventReason = NavigationMenuRootChangeEventReason;
  export type ChangeEventDetails = NavigationMenuRootChangeEventDetails;
}
