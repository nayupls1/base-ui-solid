import { createEffect, createRenderEffect, untrack, type Accessor } from 'solid-js';
import { createSyncSignal } from 'base-ui-solidjs-utils/createSyncSignal';
import { AnimationFrame } from 'base-ui-solidjs-utils/useAnimationFrame';

export type TransitionStatus = 'starting' | 'ending' | 'idle' | undefined;

/**
 * Provides a status string for CSS animations.
 * @param open - an accessor that determines if the element is open.
 * @param enableIdleState - enables the `'idle'` state between `'starting'` and `'ending'`
 * @param deferEndingState - delays the `'ending'` state by a frame
 * @param animateInitialOpen - makes an element which mounts already open still go
 *   through `'starting'`. Off by default so content that was open on the first render doesn't
 *   animate in.
 */
export function useTransitionStatus(
  open: Accessor<boolean>,
  enableIdleState: boolean = false,
  deferEndingState: boolean = false,
  animateInitialOpen: boolean = false,
) {
  const initialOpen = untrack(open);
  const [transitionStatus, setTransitionStatus] = createSyncSignal<TransitionStatus>(
    initialOpen && enableIdleState ? 'idle' : undefined,
  );
  const [mounted, setMounted] = createSyncSignal(initialOpen && !animateInitialOpen);

  // Equivalent of the render-phase state adjustments in the React implementation.
  createRenderEffect(
    () => [open(), mounted(), transitionStatus()] as const,
    ([isOpen, isMounted, status]) => {
      if (isOpen && !isMounted) {
        setMounted(true);
        setTransitionStatus('starting');
        return;
      }

      if (!isOpen && isMounted && status !== 'ending' && !deferEndingState) {
        setTransitionStatus('ending');
        return;
      }

      if (!isOpen && !isMounted && status === 'ending') {
        setTransitionStatus(undefined);
      }
    },
  );

  createEffect(
    () => [open(), mounted(), transitionStatus()] as const,
    ([isOpen, isMounted, status]) => {
      if (!isOpen && isMounted && status !== 'ending' && deferEndingState) {
        const frame = AnimationFrame.request(() => {
          setTransitionStatus('ending');
        });

        return () => {
          AnimationFrame.cancel(frame);
        };
      }

      return undefined;
    },
  );

  createEffect(
    () => [open(), transitionStatus()] as const,
    ([isOpen, status]) => {
      if (!isOpen || enableIdleState || status === undefined) {
        return undefined;
      }

      const frame = AnimationFrame.request(() => {
        setTransitionStatus(undefined);
      });

      return () => {
        AnimationFrame.cancel(frame);
      };
    },
  );

  createEffect(
    () => [open(), mounted(), transitionStatus()] as const,
    ([isOpen, isMounted, status]) => {
      if (!isOpen || !enableIdleState) {
        return undefined;
      }

      if (isOpen && isMounted && status !== 'idle') {
        setTransitionStatus('starting');
      }

      const frame = AnimationFrame.request(() => {
        setTransitionStatus('idle');
      });

      return () => {
        AnimationFrame.cancel(frame);
      };
    },
  );

  return {
    mounted,
    setMounted: (value: boolean) => {
      setMounted(value);
    },
    transitionStatus,
  };
}
