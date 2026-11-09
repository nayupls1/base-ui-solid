import { flush } from 'solid-js';
import { useAnimationFrame } from '@base-ui-solid/utils/useAnimationFrame';
import { NOOP } from '@base-ui-solid/utils/empty';
import { resolveRef } from '../utils/resolveRef';
import { isFiniteAnimation } from '../utils/getFiniteAnimations';
import * as TransitionStatusDataAttributes from './TransitionStatusDataAttributes';
import { createFlushBeforePaint } from './createFlushBeforePaint';

declare global {
  // eslint-disable-next-line vars-on-top, no-var
  var BASE_UI_ANIMATIONS_DISABLED: boolean | undefined;
}

/**
 * Returns a function that queues items and flushes them together in a microtask.
 */
function createMicrotaskQueue<T>(flushItems: (items: T[]) => void) {
  let pending: T[] = [];
  return (item: T) => {
    if (!pending.length) {
      queueMicrotask(() => {
        const items = pending;
        pending = [];
        flushItems(items);
      });
    }
    pending.push(item);
  };
}

/**
 * Passes each element's animations to its callback in a microtask.
 */
const getAnimationsBatched = createMicrotaskQueue<
  [element: Element, callback: (animations: Animation[]) => void]
>((lookups) => {
  const animationsByElement = new Map<Element, Animation[] | undefined>();
  for (const [element] of lookups) {
    animationsByElement.set(element, undefined);
  }
  let remaining = animationsByElement.size;
  let animatedRoot: (Node & Partial<DocumentOrShadowRoot>) | undefined;
  let animationsByTarget: Map<Element | null, Animation[]> | undefined;

  for (const [element, callback] of lookups) {
    let animations = animationsByElement.get(element);
    if (!animations) {
      remaining -= 1;
      const root: Node & Partial<DocumentOrShadowRoot> = element.getRootNode();
      if (root === animatedRoot && !animationsByTarget) {
        animationsByTarget = new Map();
        for (const animation of root.getAnimations!()) {
          const effect = animation.effect as KeyframeEffect;
          if (!effect.pseudoElement) {
            animationsByTarget.set(effect.target, [
              ...(animationsByTarget.get(effect.target) ?? []),
              animation,
            ]);
          }
        }
      }
      animations =
        root === animatedRoot ? (animationsByTarget!.get(element) ?? []) : element.getAnimations();
      if (remaining > 1 && animations.length && element.isConnected && root.getAnimations) {
        animatedRoot ??= root;
      }
      animationsByElement.set(element, animations);
    }
    callback(animations);
  }
});

const flushBeforePaint = createFlushBeforePaint();

type ElementSource = { current: HTMLElement | null } | HTMLElement | null | (() => HTMLElement | null | undefined);

/**
 * Executes a function once all animations have finished on the provided element.
 * If an animation is canceled, waits for any replacement animations before executing.
 * @param elementOrRef - The element (or an accessor/ref of it) to watch for animations.
 * @param waitForStartingStyleRemoved - Whether to wait for [data-starting-style] to be removed before checking for animations.
 * Accepts an accessor so it can be read at call time.
 * @param batch - Whether completions ready in the same microtask may be coalesced into a single flush.
 * @returns A function that takes a callback to execute once all animations have finished, and an optional AbortSignal to abort the callback
 */
export function useAnimationsFinished(
  elementOrRef: ElementSource,
  waitForStartingStyleRemoved: boolean | (() => boolean | undefined) = false,
  batch = false,
) {
  const frame = useAnimationFrame();

  return (
    /**
     * A function to execute once all animations have finished.
     */
    fnToExecute: () => void,
    /**
     * An optional AbortSignal that can be used to abort `fnToExecute` before all the animations
     * have finished.
     * @default null
     */
    signal: AbortSignal | null = null,
  ) => {
    frame.cancel();

    const element = resolveRef(elementOrRef as any) as HTMLElement | null | undefined;
    if (element == null) {
      return;
    }

    const resolvedElement = element;

    const done = () => {
      if (!batch) {
        fnToExecute();
        flush();
        return;
      }

      flushBeforePaint(() => {
        if (!signal?.aborted) {
          fnToExecute();
        }
      });
    };

    if (
      typeof resolvedElement.getAnimations !== 'function' ||
      globalThis.BASE_UI_ANIMATIONS_DISABLED
    ) {
      fnToExecute();
      return;
    }

    function exec() {
      getAnimationsBatched([resolvedElement, waitForAnimations]);
    }

    function waitForAnimations(animations: Animation[]) {
      Promise.all(
        animations.filter(isFiniteAnimation).map((animation) => animation.finished.then(NOOP)),
      ).then(
        () => {
          if (!signal?.aborted) {
            done();
          }
        },
        () => {
          if (!signal?.aborted) {
            exec();
          }
        },
      );
    }

    const shouldWaitForStartingStyle =
      typeof waitForStartingStyleRemoved === 'function'
        ? waitForStartingStyleRemoved()
        : waitForStartingStyleRemoved;

    if (shouldWaitForStartingStyle) {
      const startingStyleAttribute = TransitionStatusDataAttributes.startingStyle;

      if (!resolvedElement.hasAttribute(startingStyleAttribute)) {
        frame.request(exec);
        return;
      }

      const attributeObserver = new MutationObserver(() => {
        if (!resolvedElement.hasAttribute(startingStyleAttribute)) {
          attributeObserver.disconnect();
          exec();
        }
      });

      attributeObserver.observe(resolvedElement, {
        attributes: true,
        attributeFilter: [startingStyleAttribute],
      });

      signal?.addEventListener('abort', () => attributeObserver.disconnect(), { once: true });
      return;
    }

    frame.request(exec);
  };
}
