import { createEffect, createMemo, createSignal, flush, omit, untrack } from 'solid-js';
import { addEventListener } from 'base-ui-solidjs-utils/addEventListener';
import { mergeCleanups } from 'base-ui-solidjs-utils/mergeCleanups';
import { ownerWindow } from 'base-ui-solidjs-utils/owner';
import { useTimeout } from 'base-ui-solidjs-utils/useTimeout';
import {
  disableFocusInside,
  enableFocusInside,
  isOutsideEvent,
} from '../../utils/popups/focus/tabbable';
import type { BaseUIComponentProps } from '../../internals/types';
import {
  useNavigationMenuRootContext,
  useNavigationMenuTreeContext,
} from '../root/NavigationMenuRootContext';
import { useNavigationMenuPortalContext } from '../portal/NavigationMenuPortalContext';
import type {
  Align,
  Side,
  UseAnchorPositioningSharedParameters,
} from '../../internals/useAnchorPositioning';
import { useAnchorPositioning } from '../../internals/useAnchorPositioning';
import { useFloatingRootStore } from '../../utils/popups/floating-root/useFloatingRootStore';
import { createForwardingStore } from '../../utils/popups/floating-root/createForwardingStore';
import { NavigationMenuPositionerContext } from './NavigationMenuPositionerContext';
import { DROPDOWN_COLLISION_AVOIDANCE, POPUP_COLLISION_AVOIDANCE } from '../../internals/constants';
import { adaptiveOrigin } from '../../utils/popups/positioning/adaptiveOriginMiddleware';
import { usePositioner } from '../../utils/popups/positioning/usePositioner';
import { ownedProps } from '../../internals/ownedProps';

/**
 * Positions the navigation menu against the currently active trigger.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Navigation Menu](https://base-ui.com/react/components/navigation-menu)
 */
export function NavigationMenuPositioner(componentProps: NavigationMenuPositioner.Props) {
  componentProps = ownedProps(componentProps);
  const root = useNavigationMenuRootContext();

  const elementProps = omit(
    componentProps,
    'class',
    'render',
    'anchor',
    'positionMethod',
    'side',
    'align',
    'sideOffset',
    'alignOffset',
    'collisionBoundary',
    'collisionPadding',
    'collisionAvoidance',
    'arrowPadding',
    'sticky',
    'disableAnchorTracking',
    'style',
    'children',
    'ref',
  );

  const keepMounted = useNavigationMenuPortalContext();
  const nodeId = useNavigationMenuTreeContext() ?? undefined;

  const initialInstantTimeout = useTimeout();
  const resizeTimeout = useTimeout();

  // When the menu is initially open, disable the positioner's transition for one frame
  // so a default value does not animate in from the unpositioned portal state.
  const initialOpen = untrack(() => root.open);
  const [instant, setInstant] = createSignal(initialOpen, { ownedWrite: true });
  let needsInitialInstantReset = initialOpen;

  // https://codesandbox.io/s/tabbable-portal-f4tng?file=/src/TabbablePortal.tsx
  createEffect(
    () => root.positionerElement,
    (positionerElement) => {
      if (!positionerElement) {
        return undefined;
      }

      // Make sure elements inside the portal element are tabbable only when the
      // portal has already been focused, either by tabbing into a focus trap
      // element outside or using the mouse.
      function onFocus(event: FocusEvent) {
        if (positionerElement && isOutsideEvent(event)) {
          const focusing = event.type === 'focusin';
          const manageFocus = focusing ? enableFocusInside : disableFocusInside;
          manageFocus(positionerElement);
        }
      }

      // Listen to the event on the capture phase so they run before the focus
      // trap elements onFocus prop is called.
      return mergeCleanups(
        addEventListener(positionerElement, 'focusin', onFocus, true),
        addEventListener(positionerElement, 'focusout', onFocus, true),
      );
    },
  );

  // The active trigger supplies the root store after the positioner has already rendered.
  const fallbackRootStore = useFloatingRootStore({
    get open() {
      return keepMounted ? root.mounted : undefined;
    },
  });
  const currentStore = () => root.floatingRootStore || fallbackRootStore;
  const interactionStore = createForwardingStore(currentStore);

  const domReference = createMemo(() => currentStore().get('anchorElement'));

  const positioning = useAnchorPositioning({
    get anchor() {
      return componentProps.anchor ?? domReference();
    },
    get positionMethod() {
      return componentProps.positionMethod;
    },
    get mounted() {
      return root.mounted;
    },
    get side() {
      return componentProps.side ?? 'bottom';
    },
    get sideOffset() {
      return componentProps.sideOffset;
    },
    get align() {
      return componentProps.align ?? 'center';
    },
    get alignOffset() {
      return componentProps.alignOffset;
    },
    get arrowPadding() {
      return componentProps.arrowPadding;
    },
    get collisionBoundary() {
      return componentProps.collisionBoundary;
    },
    get collisionPadding() {
      return componentProps.collisionPadding;
    },
    get sticky() {
      return componentProps.sticky;
    },
    get disableAnchorTracking() {
      return componentProps.disableAnchorTracking;
    },
    keepMounted,
    interactionStore,
    get collisionAvoidance() {
      return (
        componentProps.collisionAvoidance ??
        (root.nested ? POPUP_COLLISION_AVOIDANCE : DROPDOWN_COLLISION_AVOIDANCE)
      );
    },
    shift: { rootBoundary: 'layoutViewport' },
    nodeId,
    // Allows the menu to remain anchored without wobbling while its size
    // and position transition simultaneously when side=top or side=left.
    adaptiveOrigin,
  } as any);

  // `useBaseUIFloating` publishes its positioning context on the store it was set up with;
  // republish it on whichever store is now active.
  createEffect(currentStore, (store) => {
    (store.context as any).positioning = positioning.context;
  });

  const state = createMemo<NavigationMenuPositionerState>(() => ({
    open: root.open,
    side: positioning.side,
    align: positioning.align,
    anchorHidden: positioning.anchorHidden,
    instant: instant(),
  }));

  createEffect(
    () => [root.open, root.positionerElement] as const,
    ([open, positionerElement]) => {
      if (!open) {
        return undefined;
      }

      if (needsInitialInstantReset) {
        initialInstantTimeout.start(0, () => {
          needsInitialInstantReset = false;

          if (!resizeTimeout.isStarted()) {
            setInstant(false);
          }
        });
      }

      function handleResize() {
        setInstant(true);
        flush();

        resizeTimeout.start(100, () => {
          setInstant(false);
        });
      }

      const win = ownerWindow(positionerElement);
      return addEventListener(win, 'resize', handleResize);
    },
  );

  return (
    <NavigationMenuPositionerContext value={positioning}>
      {untrack(() =>
        usePositioner(componentProps as any, state, {
          get styles() {
            return positioning.positionerStyles;
          },
          get transitionStatus() {
            return root.transitionStatus;
          },
          props: elementProps,
          refs: [(el: HTMLDivElement | null) => root.setPositionerElement(el)],
          get hidden() {
            return !root.mounted;
          },
          get inert() {
            return !root.open;
          },
        }),
      )}
    </NavigationMenuPositionerContext>
  );
}

export interface NavigationMenuPositionerState {
  /**
   * Whether the navigation menu is currently open.
   */
  open: boolean;
  /**
   * The side of the anchor the component is placed on.
   */
  side: Side;
  /**
   * The alignment of the component relative to the anchor.
   */
  align: Align;
  /**
   * Whether the anchor element is hidden.
   */
  anchorHidden: boolean;
  /**
   * Whether CSS transitions should be disabled.
   */
  instant: boolean;
}

export interface NavigationMenuPositionerProps
  extends
    UseAnchorPositioningSharedParameters,
    BaseUIComponentProps<'div', NavigationMenuPositionerState> {}

export namespace NavigationMenuPositioner {
  export type State = NavigationMenuPositionerState;
  export type Props = NavigationMenuPositionerProps;
}
