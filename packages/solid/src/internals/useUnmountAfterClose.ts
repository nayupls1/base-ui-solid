import { createEffect, createSignal, untrack, type Accessor } from 'solid-js';
import { useTransitionStatus } from './useTransitionStatus';
import { useOpenChangeComplete } from './useOpenChangeComplete';

export interface UseUnmountAfterCloseParameters {
  /**
   * Whether the popup is open.
   */
  open: boolean;
  /**
   * The popup element: a `{ current }` ref or an accessor.
   */
  ref: { current: HTMLElement | null } | (() => HTMLElement | null | undefined);
  /**
   * Whether to keep the popup mounted after it closes.
   */
  preventUnmountOnClose: boolean;
  setPreventUnmountOnClose: (preventUnmountOnClose: boolean) => void;
  /**
   * Subscribes to changes that can attach the popup element after the wait started.
   */
  subscribeToAttach?: ((listener: () => void) => () => void) | undefined;
  /**
   * Called once the popup unmounts.
   */
  onUnmount: () => void;
  /**
   * Whether a popup that mounts already open still animates in.
   */
  animateInitialOpen?: boolean | undefined;
}

/**
 * Keeps a popup mounted until its exit animation completes. Parameters are read lazily, so they
 * can be getters.
 */
export function useUnmountAfterClose(parameters: UseUnmountAfterCloseParameters) {
  const open = () => parameters.open;
  const { mounted, setMounted, transitionStatus } = useTransitionStatus(
    open,
    false,
    false,
    untrack(() => parameters.animateInitialOpen) ?? false,
  );

  const preventUnmountingOnClose = () => (open() ? false : parameters.preventUnmountOnClose);

  createEffect(open, (isOpen) => {
    if (isOpen) {
      parameters.setPreventUnmountOnClose(false);
    }
  });

  let mountedValue = untrack(mounted);
  const [unmountRequest, setUnmountRequest] = createSignal(0, { ownedWrite: true });
  let unmountRequestCount = 0;
  let pendingUnmount: number | null = null;

  const unmount = () => {
    mountedValue = false;
    setMounted(false);
    parameters.onUnmount();
  };

  createEffect(
    () => [mounted(), unmountRequest(), open()] as const,
    ([isMounted, request, isOpen]) => {
      mountedValue = isMounted;
      if (pendingUnmount !== null && pendingUnmount <= request) {
        pendingUnmount = null;
        if (!isOpen && isMounted) {
          unmount();
        }
      }
    },
  );

  const forceUnmount = () => {
    if (!mountedValue) {
      return;
    }
    if (untrack(open)) {
      // Wait for the close commit before unmounting.
      unmountRequestCount += 1;
      pendingUnmount = unmountRequestCount;
      setUnmountRequest(unmountRequestCount);
      return;
    }
    unmount();
  };

  const waitsForClose = () => mounted() && !open() && !preventUnmountingOnClose();

  const resolveElement = () => {
    const ref = parameters.ref;
    return typeof ref === 'function' ? (ref() ?? null) : ref.current;
  };

  const [attachCount, setAttachCount] = createSignal(0, { ownedWrite: true });
  createEffect(waitsForClose, (isWaiting) => {
    const subscribeToAttach = parameters.subscribeToAttach;
    if (!isWaiting || resolveElement() != null || !subscribeToAttach) {
      return undefined;
    }
    const unsubscribe = subscribeToAttach(() => {
      if (resolveElement() != null) {
        unsubscribe();
        setAttachCount((count) => count + 1);
      }
    });
    return unsubscribe;
  });

  useOpenChangeComplete({
    get enabled() {
      return waitsForClose();
    },
    get open() {
      return open();
    },
    ref: resolveElement,
    get restartKey() {
      return attachCount();
    },
    onComplete() {
      if (!untrack(open)) {
        forceUnmount();
      }
    },
  });

  return {
    mounted,
    transitionStatus,
    preventUnmountingOnClose,
    forceUnmount,
  } as {
    mounted: Accessor<boolean>;
    transitionStatus: typeof transitionStatus;
    preventUnmountingOnClose: Accessor<boolean>;
    forceUnmount: () => void;
  };
}
