import { createContext, createEffect, createSignal, onCleanup, untrack, useContext } from 'solid-js';
import type { Accessor } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { useTimeout, Timeout } from 'base-ui-solidjs-utils/useTimeout';
import type { RefObject } from 'base-ui-solidjs-utils/types';

import { getDelay } from '../interactions/useHoverShared';
import type { PopupInteractionStore, Delay } from '../types';

interface ContextValue {
  hasProvider: boolean;
  readonly timeoutMs: number;
  delayRef: RefObject<Delay>;
  initialDelayRef: RefObject<Delay>;
  timeout: Timeout;
  currentIdRef: RefObject<string | null | undefined>;
  currentContextRef: RefObject<{
    closeForSibling: () => void;
    setIsInstantPhase: (value: boolean) => void;
  } | null>;
}

const FloatingDelayGroupContext = createContext<ContextValue>({
  hasProvider: false,
  timeoutMs: 0,
  delayRef: { current: 0 },
  initialDelayRef: { current: 0 },
  timeout: new Timeout(),
  currentIdRef: { current: null },
  currentContextRef: { current: null },
});

function resetDelayRef(delayRef: RefObject<Delay>, initialDelayRef: RefObject<Delay>) {
  delayRef.current = initialDelayRef.current;
}

export interface FloatingDelayGroupProps {
  children?: JSX.Element;
  /**
   * The delay to use for the group when it's not in the instant phase.
   */
  delay: Delay;
  /**
   * An optional explicit timeout to use for the group, which represents when
   * grouping logic will no longer be active after the close delay completes.
   * This is useful if you want grouping to “last” longer than the close delay,
   * for example if there is no close delay at all.
   */
  timeoutMs?: number | undefined;
}

/**
 * Provides context for a group of floating elements that should share a
 * `delay`. Once one of them opens, the others open instantly until
 * `timeoutMs` passes after it closes.
 * Consumers read the delay through refs, so changing it doesn't re-run
 * unrelated consumers of the context.
 * Based on `NextFloatingDelayGroup` from `@floating-ui/react`.
 * @see https://floating-ui.com/docs/FloatingDelayGroup
 * @internal
 */
export function FloatingDelayGroup(props: FloatingDelayGroupProps): JSX.Element {
  const delayRef: RefObject<Delay> = { current: untrack(() => props.delay) };
  const initialDelayRef: RefObject<Delay> = { current: untrack(() => props.delay) };
  const currentIdRef: RefObject<string | null | undefined> = { current: null };
  const currentContextRef: ContextValue['currentContextRef'] = { current: null };
  const timeout = useTimeout();

  createEffect(
    () => props.delay,
    (delay) => {
      initialDelayRef.current = delay;

      if (!currentIdRef.current) {
        delayRef.current = delay;
        return;
      }

      delayRef.current = {
        open: getDelay(delayRef.current, 'open'),
        close: getDelay(delay, 'close'),
      };
    },
  );

  const value: ContextValue = {
    hasProvider: true,
    delayRef,
    initialDelayRef,
    currentIdRef,
    get timeoutMs() {
      return props.timeoutMs ?? 0;
    },
    currentContextRef,
    timeout,
  };

  return <FloatingDelayGroupContext value={value}>{props.children}</FloatingDelayGroupContext>;
}

interface UseDelayGroupOptions {
  /**
   * Whether the trigger this hook is used in has opened the tooltip.
   */
  open: Accessor<boolean>;
}

interface UseDelayGroupReturn {
  /**
   * The id of the floating element keeping the delay group active.
   */
  activeIdRef: RefObject<string | null | undefined>;
  /**
   * The delay reference object.
   */
  delayRef: RefObject<Delay>;
  /**
   * Whether animations should be removed.
   */
  isInstantPhase: Accessor<boolean>;
  /**
   * Whether a `<FloatingDelayGroup>` provider is present.
   */
  hasProvider: boolean;
}

/**
 * Enables grouping when called inside a component that's a child of a
 * `FloatingDelayGroup`.
 * @see https://floating-ui.com/docs/FloatingDelayGroup
 * @internal
 */
export function useDelayGroup(
  store: PopupInteractionStore & {
    /**
     * Closes the popup because another popup in the group opened.
     */
    closeForSibling(): void;
  },
  options: UseDelayGroupOptions,
): UseDelayGroupReturn {
  const open = options.open;

  const defaultPopupId = (store as any).useState('defaultPopupId') as Accessor<string | undefined>;

  const groupContext = useContext(FloatingDelayGroupContext);
  const { currentIdRef, delayRef, initialDelayRef, currentContextRef, hasProvider, timeout } =
    groupContext;

  const [isInstantPhase, setIsInstantPhase] = createSignal(false, { ownedWrite: true });
  let openValue = untrack(open);

  createEffect(open, (isOpen) => {
    openValue = isOpen;
  });

  createEffect(
    () => [open(), defaultPopupId()] as const,
    ([isOpen, popupId]) => {
      function unset() {
        currentContextRef.current?.setIsInstantPhase(false);
        currentIdRef.current = null;
        currentContextRef.current = null;
        delayRef.current = initialDelayRef.current;
        timeout.clear();
      }

      if (!currentIdRef.current) {
        return undefined;
      }

      if (!isOpen && currentIdRef.current === popupId) {
        setIsInstantPhase(false);

        const timeoutMs = groupContext.timeoutMs;
        if (timeoutMs) {
          const closingId = popupId;
          timeout.start(timeoutMs, () => {
            // If another tooltip has taken over the group, skip resetting.
            if (
              store.select('open') ||
              (currentIdRef.current && currentIdRef.current !== closingId)
            ) {
              return;
            }
            unset();
          });
          return () => {
            if (openValue || currentIdRef.current !== closingId) {
              timeout.clear();
            }
          };
        }

        unset();
      }

      return undefined;
    },
  );

  createEffect(
    () => [open(), defaultPopupId()] as const,
    ([isOpen, popupId]) => {
      if (!isOpen) {
        return;
      }

      const prevContext = currentContextRef.current;
      const prevId = currentIdRef.current;

      // A new tooltip is opening, so cancel any pending timeout that would reset
      // the group's delay back to the initial value.
      timeout.clear();
      currentContextRef.current = {
        closeForSibling: () => store.closeForSibling(),
        setIsInstantPhase,
      };
      currentIdRef.current = popupId;
      delayRef.current = {
        open: 0,
        close: getDelay(initialDelayRef.current, 'close'),
      };

      if (prevId !== null && prevId !== popupId) {
        setIsInstantPhase(true);
        prevContext?.setIsInstantPhase(true);
        prevContext?.closeForSibling();
      } else {
        setIsInstantPhase(false);
        prevContext?.setIsInstantPhase(false);
      }
    },
  );

  onCleanup(() => {
    if (currentIdRef.current === untrack(defaultPopupId)) {
      currentContextRef.current = null;

      if (!openValue) {
        return;
      }

      currentIdRef.current = null;
      resetDelayRef(delayRef, initialDelayRef);
      timeout.clear();
    }
  });

  return {
    activeIdRef: currentIdRef,
    hasProvider,
    delayRef,
    isInstantPhase,
  };
}
