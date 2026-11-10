import type { JSX } from '@solidjs/web';
import type { RefObject } from 'base-ui-solidjs-utils/types';
import { createEffect, createMemo, createSignal, onCleanup, untrack } from 'solid-js';
import { addEventListener } from 'base-ui-solidjs-utils/addEventListener';
import { NOOP } from 'base-ui-solidjs-utils/empty';
import { useControlled } from 'base-ui-solidjs-utils/useControlled';
import { ownerWindow } from 'base-ui-solidjs-utils/owner';
import { platform } from 'base-ui-solidjs-utils/platform';
import { DrawerRootContext, useDrawerRootContext } from './DrawerRootContext';
import type {
  DrawerNestedSwipeProgressStore,
  DrawerSwipeDirection,
  DrawerSnapPoint,
} from './DrawerRootContext';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import type { BaseUIChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { useDialogRootContext } from '../../dialog/root/DialogRootContext';
import { useRenderDialogRoot } from '../../dialog/root/useRenderDialogRoot';
import { useDrawerProviderContext } from '../provider/DrawerProviderContext';
import type { DrawerHandle } from '../handle';
import type { PayloadChildRenderFunction } from '../../utils/popups/popupRoot';
import { ownedProps } from '../../internals/ownedProps';

/**
 * Groups all parts of the drawer.
 * Doesn't render its own HTML element.
 *
 * Documentation: [Base UI Drawer](https://base-ui.com/react/components/drawer)
 */
export function DrawerRoot<Payload = unknown>(props: DrawerRoot.Props<Payload>) {
  props = ownedProps(props);

  const swipeDirection = () => props.swipeDirection ?? 'down';
  const snapToSequentialPoints = () => props.snapToSequentialPoints ?? false;

  const parentDrawerRootContext = useDrawerRootContext(true);

  const notifyParentSwipeProgressChange = parentDrawerRootContext?.onNestedSwipeProgressChange;
  const notifyParentFrontmostHeight = parentDrawerRootContext?.onNestedFrontmostHeightChange;
  const notifyParentSwipingChange = parentDrawerRootContext?.onNestedSwipingChange;
  const notifyParentHasNestedDrawer = parentDrawerRootContext?.onNestedDrawerPresenceChange;

  const [popupHeight, setPopupHeight] = createSignal(0, { ownedWrite: true });
  const [frontmostHeight, setFrontmostHeight] = createSignal(0, { ownedWrite: true });
  const [hasNestedDrawer, setHasNestedDrawer] = createSignal(false, { ownedWrite: true });
  const [nestedSwiping, setNestedSwiping] = createSignal(false, { ownedWrite: true });
  const nestedSwipeProgressStore = createNestedSwipeProgressStore();

  const resolvedDefaultSnapPoint = createMemo(() =>
    props.defaultSnapPoint !== undefined ? props.defaultSnapPoint : (props.snapPoints?.[0] ?? null),
  );
  const isSnapPointControlled = () => props.snapPoint !== undefined;

  const [activeSnapPoint, setActiveSnapPointUnwrapped] = useControlled<DrawerSnapPoint | null>({
    controlled: () => props.snapPoint,
    default: untrack(resolvedDefaultSnapPoint),
    name: 'Drawer',
    state: 'snapPoint',
  });

  let isNestedDrawerOpen = false;
  const swipeAreaActiveRef = { current: false };

  const setActiveSnapPoint = (
    nextSnapPoint: DrawerSnapPoint | null,
    eventDetails?: DrawerRoot.SnapPointChangeEventDetails,
  ) => {
    const resolvedEventDetails = eventDetails ?? createChangeEventDetails(REASONS.none);

    untrack(() => props.onSnapPointChange)?.(nextSnapPoint, resolvedEventDetails);

    if (resolvedEventDetails.isCanceled) {
      return;
    }

    setActiveSnapPointUnwrapped(nextSnapPoint);
  };

  const resolvedActiveSnapPoint = createMemo(() => {
    const active = activeSnapPoint();
    if (isSnapPointControlled()) {
      return active;
    }

    const snapPoints = props.snapPoints;
    if (!snapPoints || snapPoints.length === 0) {
      return active;
    }

    if (active === null || !snapPoints.some((snapPoint) => Object.is(snapPoint, active))) {
      return resolvedDefaultSnapPoint();
    }

    return active;
  });

  const onPopupHeightChange = (height: number) => {
    setPopupHeight(height);

    if (!isNestedDrawerOpen && height > 0) {
      setFrontmostHeight(height);
    }
  };

  const onNestedFrontmostHeightChange = (height: number) => {
    if (height > 0) {
      isNestedDrawerOpen = true;
      setFrontmostHeight(height);
      return;
    }

    isNestedDrawerOpen = false;
    const ownHeight = untrack(popupHeight);
    if (ownHeight > 0) {
      setFrontmostHeight(ownHeight);
    }
  };

  const onNestedDrawerPresenceChange = (present: boolean) => {
    setHasNestedDrawer(present);
  };

  const onNestedSwipeProgressChange = (progress: number) => {
    nestedSwipeProgressStore.set(progress);
    notifyParentSwipeProgressChange?.(progress);
  };

  const onNestedSwipingChange = (swiping: boolean) => {
    setNestedSwiping(swiping);
    notifyParentSwipingChange?.(swiping);
  };

  const handleOpenChange = (nextOpen: boolean, eventDetails: DrawerRoot.ChangeEventDetails) => {
    untrack(() => props.onOpenChange)?.(nextOpen, eventDetails);

    if (eventDetails.isCanceled) {
      return;
    }

    const snapPoints = untrack(() => props.snapPoints);
    if (!nextOpen && snapPoints && snapPoints.length > 0) {
      setActiveSnapPoint(
        untrack(resolvedDefaultSnapPoint),
        createChangeEventDetails(
          eventDetails.reason,
          eventDetails.event,
          eventDetails.trigger as HTMLElement | undefined,
        ),
      );
    }
  };

  const contextValue: DrawerRootContext = {
    get swipeDirection() {
      return swipeDirection();
    },
    swipeAreaActiveRef,
    get snapToSequentialPoints() {
      return snapToSequentialPoints();
    },
    get snapPoints() {
      return props.snapPoints;
    },
    get activeSnapPoint() {
      return resolvedActiveSnapPoint();
    },
    setActiveSnapPoint,
    get frontmostHeight() {
      return frontmostHeight();
    },
    get popupHeight() {
      return popupHeight();
    },
    get hasNestedDrawer() {
      return hasNestedDrawer();
    },
    get nestedSwiping() {
      return nestedSwiping();
    },
    nestedSwipeProgressStore,
    onNestedDrawerPresenceChange,
    onPopupHeightChange,
    onNestedFrontmostHeightChange,
    onNestedSwipingChange,
    onNestedSwipeProgressChange,
    notifyParentFrontmostHeight,
    notifyParentSwipingChange,
    notifyParentSwipeProgressChange,
    notifyParentHasNestedDrawer,
  };

  const resolvedChildren = (): JSX.Element | PayloadChildRenderFunction<Payload> => {
    const children = props.children;
    return typeof children === 'function' ? (
      (payload) => (
        <>
          <DrawerProviderReporter />
          {(children as PayloadChildRenderFunction<Payload>)(payload)}
        </>
      )
    ) : (
      <>
        <DrawerProviderReporter />
        {children}
      </>
    );
  };

  return (
    <DrawerRootContext value={contextValue}>
      {untrack(() =>
        useRenderDialogRoot('drawer', {
          get open() {
            return props.open;
          },
          get defaultOpen() {
            return props.defaultOpen ?? false;
          },
          onOpenChange: handleOpenChange as any,
          get onOpenChangeComplete() {
            return props.onOpenChangeComplete;
          },
          get disablePointerDismissal() {
            return props.disablePointerDismissal ?? false;
          },
          get modal() {
            return props.modal ?? true;
          },
          get actionsRef() {
            return props.actionsRef;
          },
          get handle() {
            return props.handle;
          },
          get triggerId() {
            return props.triggerId;
          },
          get defaultTriggerId() {
            return props.defaultTriggerId ?? null;
          },
          get children() {
            return resolvedChildren() as any;
          },
        } as any),
      )}
    </DrawerRootContext>
  );
}

export interface DrawerRootState {}

export interface DrawerRootProps<Payload = unknown> {
  /**
   * Whether the drawer is currently open.
   */
  open?: boolean | undefined;
  /**
   * Whether the drawer is initially open.
   *
   * To render a controlled drawer, use the `open` prop instead.
   * @default false
   */
  defaultOpen?: boolean | undefined;
  /**
   * Determines if the drawer enters a modal state when open.
   * - `true`: user interaction is limited to just the drawer: focus is trapped, document page scroll is locked, and pointer interactions on outside elements are disabled.
   * - `false`: user interaction with the rest of the document is allowed.
   * - `'trap-focus'`: focus is trapped inside the drawer, but document page scroll is not locked and pointer interactions outside of it remain enabled.
   * @default true
   */
  modal?: boolean | 'trap-focus' | undefined;
  /**
   * Event handler called when the drawer is opened or closed.
   */
  onOpenChange?: ((open: boolean, eventDetails: DrawerRoot.ChangeEventDetails) => void) | undefined;
  /**
   * Event handler called after any animations complete when the drawer is opened or closed.
   */
  onOpenChangeComplete?: ((open: boolean) => void) | undefined;
  /**
   * Whether to prevent the drawer from closing on outside presses.
   * For non-modal drawers, this also prevents the drawer from closing when focus moves outside of it.
   * @default false
   */
  disablePointerDismissal?: boolean | undefined;
  /**
   * A ref to imperative actions.
   * - `unmount`: Ends the closing phase of the drawer after an externally controlled closing animation finishes.
   * Call `preventUnmountOnClose()` in `onOpenChange` first, otherwise the drawer completes closing on its own.
   * Whether it leaves the DOM is decided by `keepMounted` on the portal.
   * - `close`: Closes the drawer imperatively when called.
   */
  actionsRef?: RefObject<DrawerRoot.Actions | null> | undefined;
  /**
   * A handle to associate the drawer with a trigger.
   * If specified, allows detached triggers to control the drawer's open state.
   * Can be created with the Drawer.createHandle() method.
   */
  handle?: DrawerHandle<Payload> | undefined;
  /**
   * ID of the trigger that the drawer is associated with.
   * This is useful in conjunction with the `open` prop to create a controlled drawer.
   * There's no need to specify this prop when the drawer is uncontrolled (that is, when the `open` prop is not set).
   */
  triggerId?: string | null | undefined;
  /**
   * ID of the trigger that the drawer is associated with.
   * This is useful in conjunction with the `defaultOpen` prop to create an initially open drawer.
   */
  defaultTriggerId?: string | null | undefined;
  /**
   * The content of the drawer.
   */
  children?: JSX.Element | PayloadChildRenderFunction<Payload>;
  /**
   * The swipe direction used to dismiss the drawer.
   * @default 'down'
   */
  swipeDirection?: DrawerSwipeDirection | undefined;
  /**
   * Snap points used to position the drawer.
   * Use numbers between 0 and 1 to represent fractions of the viewport height,
   * numbers greater than 1 as pixel values, or strings in `px`/`rem` units
   * (for example, `'148px'` or `'30rem'`).
   */
  snapPoints?: DrawerSnapPoint[] | undefined;
  /**
   * Disables velocity-based snap skipping so drag distance determines the next snap point.
   * @default false
   */
  snapToSequentialPoints?: boolean | undefined;
  /**
   * The currently active snap point. Use with `onSnapPointChange` to control the snap point.
   */
  snapPoint?: DrawerSnapPoint | null | undefined;
  /**
   * The initial snap point value when uncontrolled.
   */
  defaultSnapPoint?: DrawerSnapPoint | null | undefined;
  /**
   * Callback fired when the snap point changes.
   */
  onSnapPointChange?:
    | ((
        snapPoint: DrawerSnapPoint | null,
        eventDetails: DrawerRoot.SnapPointChangeEventDetails,
      ) => void)
    | undefined;
}

export interface DrawerRootActions {
  unmount: () => void;
  close: () => void;
}

export type DrawerRootChangeEventReason =
  | typeof REASONS.triggerPress
  | typeof REASONS.outsidePress
  | typeof REASONS.escapeKey
  | typeof REASONS.closeWatcher
  | typeof REASONS.closePress
  | typeof REASONS.focusOut
  | typeof REASONS.imperativeAction
  | typeof REASONS.swipe
  | typeof REASONS.none;

export type DrawerRootChangeEventDetails =
  BaseUIChangeEventDetails<DrawerRoot.ChangeEventReason> & {
    /** Prevents the popup from unmounting until the `unmount` action is called. */
    preventUnmountOnClose: () => void;
  };

export type DrawerRootSnapPointChangeEventReason = DrawerRootChangeEventReason;

export type DrawerRootSnapPointChangeEventDetails =
  BaseUIChangeEventDetails<DrawerRootSnapPointChangeEventReason>;

export namespace DrawerRoot {
  export type State = DrawerRootState;
  export type Props<Payload = unknown> = DrawerRootProps<Payload>;
  export type Actions = DrawerRootActions;
  export type ChangeEventReason = DrawerRootChangeEventReason;
  export type ChangeEventDetails = DrawerRootChangeEventDetails;
  export type SnapPointChangeEventReason = DrawerRootSnapPointChangeEventReason;
  export type SnapPointChangeEventDetails = DrawerRootSnapPointChangeEventDetails;
  export type SnapPoint = DrawerSnapPoint;
}

interface NestedSwipeProgressStore extends DrawerNestedSwipeProgressStore {
  set: (progress: number) => void;
}

function createNestedSwipeProgressStore(): NestedSwipeProgressStore {
  let progress = 0;
  const listeners = new Set<() => void>();

  return {
    getSnapshot: () => progress,
    set(nextProgress) {
      const resolved = Number.isFinite(nextProgress) ? nextProgress : 0;
      if (resolved === progress) {
        return;
      }

      progress = resolved;
      listeners.forEach((listener) => {
        listener();
      });
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

function DrawerProviderReporter() {
  const providerContext = useDrawerProviderContext();
  const store = useDialogRootContext(false);
  const setDrawerOpen = providerContext?.setDrawerOpen;
  const removeDrawer = providerContext?.removeDrawer;

  const open = store.useState('open');
  const nestedOpenDialogCount = store.useState('nestedOpenDialogCount');
  const popupElement = store.useState('popupElement');

  const isTopmost = () => nestedOpenDialogCount() === 0;

  if (removeDrawer) {
    onCleanup(() => {
      removeDrawer(store);
    });
  }

  createEffect(open, (isOpen) => {
    setDrawerOpen?.(store, isOpen);
  });

  createEffect(
    () => [open(), isTopmost(), popupElement()] as const,
    ([isOpen, topmost, popup]) => {
      // CloseWatcher enables the Android back gesture (Chromium-only).
      // Keep this Android-only for now to avoid interfering with Escape/nesting semantics on desktop due to `useDismiss`.
      if (!isOpen || !topmost || !platform.os.android) {
        return undefined;
      }

      const win = ownerWindow(popup);

      const CloseWatcherCtor = (win as Window & { CloseWatcher?: (new () => any) | undefined })
        .CloseWatcher;
      if (!CloseWatcherCtor) {
        return undefined;
      }

      function handleCancel(event: Event) {
        if (!store.select('open')) {
          return;
        }

        const eventDetails: Parameters<typeof store.setOpen>[1] = createChangeEventDetails(
          REASONS.closeWatcher,
          event,
        );

        if (!event.cancelable) {
          // The browser lets only one close request per user activation be prevented; any further
          // request closes the drawer regardless, like a native `<dialog>`.
          eventDetails.cancel = NOOP;
        }

        store.setOpen(false, eventDetails);

        if (eventDetails.isCanceled) {
          // Keeps this watcher active for the next close request.
          event.preventDefault();
        }
      }

      const closeWatcher = new CloseWatcherCtor();
      // The browser destroys the watcher before `close` fires, so the request is handled from
      // `cancel`, where it can still be prevented.
      const unsubscribe = addEventListener(closeWatcher, 'cancel', handleCancel);

      return () => {
        unsubscribe();
        closeWatcher.destroy();
      };
    },
  );

  return null;
}
