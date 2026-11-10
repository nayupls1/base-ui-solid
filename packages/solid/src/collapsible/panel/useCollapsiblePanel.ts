import { createEffect, onCleanup, untrack, type Accessor } from 'solid-js';
import { addEventListener } from '@base-ui-solid/utils/addEventListener';
import { createSyncSignal } from '@base-ui-solid/utils/createSyncSignal';
import { AnimationFrame } from '@base-ui-solid/utils/useAnimationFrame';
import { Timeout } from '@base-ui-solid/utils/useTimeout';
import { warn } from '@base-ui-solid/utils/warn';
import { ownerWindow } from '@base-ui-solid/utils/owner';
import type { HTMLProps } from '../../internals/types';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { useOpenChangeComplete } from '../../internals/useOpenChangeComplete';
import { useAnimationsFinished } from '../../internals/useAnimationsFinished';
import { assignRefs, type RefInput } from '../../internals/useRenderElement';
import * as CollapsiblePanelDataAttributes from './CollapsiblePanelDataAttributes';
import type { CollapsibleRoot } from '../root/CollapsibleRoot';
import type { TransitionStatus } from '../../internals/useTransitionStatus';

type AnimationType = 'css-transition' | 'css-animation' | 'none';

interface Dimensions {
  height: number | undefined;
  width: number | undefined;
}

const EMPTY_DIMENSIONS: Dimensions = {
  height: undefined,
  width: undefined,
};

/**
 * Parameters are read lazily, so they can be getters.
 */
export function useCollapsiblePanel(
  parameters: UseCollapsiblePanelParameters,
): UseCollapsiblePanelReturnValue {
  const [panelElement, setPanelElement] = createSyncSignal<HTMLDivElement | null>(null);
  let animationType: AnimationType | null = null;
  const [dimensions, setDimensionsUnwrapped] = createSyncSignal<Dimensions>(EMPTY_DIMENSIONS);
  let lastMeasuredDimensions: Dimensions = EMPTY_DIMENSIONS;
  let shouldSkipNextOpen = false;
  let shouldPreventMountAnimation = untrack(() => parameters.open);
  let shouldPreventActivityResumeAnimation = false;
  const [forcePanelIdle, setForcePanelIdle] = createSyncSignal(false);
  let pendingTemporaryStyleRestore: (() => void) | null = null;

  const ref = (element: HTMLDivElement | null) => {
    setPanelElement(element);
    assignRefs(parameters.externalRef as RefInput<HTMLDivElement | null>, element);
  };

  const runOnceCloseAnimationsFinish = useAnimationsFinished(() => panelElement());

  const hidden = () => !parameters.open && !parameters.mounted;
  const panelTransitionStatus = (): TransitionStatus =>
    forcePanelIdle() ? 'idle' : parameters.transitionStatus;
  const shouldPreventOpenAnimation = () =>
    parameters.open && (shouldPreventMountAnimation || shouldPreventActivityResumeAnimation);
  const renderedDimensions = () => {
    const current = dimensions();
    return !parameters.open &&
      parameters.mounted &&
      animationType === 'css-animation' &&
      current.height === undefined &&
      current.width === undefined
      ? lastMeasuredDimensions
      : current;
  };
  const shouldPersistHiddenTransitionStyles = () =>
    parameters.hiddenUntilFound && hidden() && animationType !== 'css-animation';

  const setDimensions = (nextDimensions: Dimensions, shouldCacheMeasurement: boolean = true) => {
    if (shouldCacheMeasurement) {
      lastMeasuredDimensions = nextDimensions;
    }

    setDimensionsUnwrapped(nextDimensions);
  };

  const restorePendingTemporaryStyle = () => {
    pendingTemporaryStyleRestore?.();
    pendingTemporaryStyleRestore = null;
  };

  const setPendingTemporaryStyleRestore = (restore: () => void) => {
    restorePendingTemporaryStyle();
    pendingTemporaryStyleRestore = () => {
      pendingTemporaryStyleRestore = null;
      restore();
    };
  };

  createEffect(
    () => [forcePanelIdle(), parameters.transitionStatus] as const,
    ([isForcedIdle, transitionStatus]) => {
      if (!isForcedIdle || transitionStatus === 'starting') {
        return;
      }

      setForcePanelIdle(false);
    },
  );

  onCleanup(() => {
    if (parameters.open && parameters.mounted && animationType === 'css-animation') {
      shouldPreventActivityResumeAnimation = true;
    }
    restorePendingTemporaryStyle();
  });

  createEffect(
    () =>
      [
        parameters.mounted,
        parameters.open,
        shouldPreventOpenAnimation(),
        parameters.transitionStatus,
        panelElement(),
      ] as const,
    ([mounted, open, preventOpenAnimation, transitionStatus, panel]) => {
      if (!open) {
        shouldPreventMountAnimation = false;
        shouldPreventActivityResumeAnimation = false;
      }

      if (!panel) {
        return undefined;
      }

      if (!open && pendingTemporaryStyleRestore) {
        restorePendingTemporaryStyle();
      }

      const currentAnimationType = getAnimationType(panel, preventOpenAnimation);
      animationType = currentAnimationType;

      if (
        open &&
        transitionStatus === 'idle' &&
        shouldPreventMountAnimation &&
        currentAnimationType === 'css-animation'
      ) {
        lastMeasuredDimensions = getDimensions(panel);
        return undefined;
      }

      if (open && transitionStatus === 'starting') {
        const skipNextOpen = shouldSkipNextOpen;
        shouldSkipNextOpen = false;

        if (currentAnimationType === 'none') {
          setDimensions(getDimensions(panel));
          setForcePanelIdle(true);
          return undefined;
        }

        if (currentAnimationType === 'css-transition') {
          const restoreLayoutStyles = resetLayoutStyles(panel);
          setDimensions(getDimensions(panel));

          if (!skipNextOpen) {
            return restoreLayoutStyles;
          }

          const restoreTransitionDuration = setTemporaryStyle(panel, 'transition-duration', '0s');
          setPendingTemporaryStyleRestore(restoreTransitionDuration);
          setForcePanelIdle(true);
          return restoreLayoutStyles;
        }

        setDimensions(getDimensions(panel));

        const restoreAnimationName = setTemporaryStyle(panel, 'animation-name', 'none');
        if (!skipNextOpen) {
          restoreAnimationName();
          return undefined;
        }

        const restoreAnimationDuration = setTemporaryStyle(panel, 'animation-duration', '0s');

        restoreAnimationName();
        setPendingTemporaryStyleRestore(restoreAnimationDuration);
        setForcePanelIdle(true);

        return undefined;
      }

      if (!open && mounted && (transitionStatus === 'idle' || transitionStatus === 'starting')) {
        if (currentAnimationType === 'none') {
          setDimensions(EMPTY_DIMENSIONS, false);
          parameters.setMounted(false);
          return undefined;
        }

        setDimensions(getDimensions(panel));
        return undefined;
      }

      if (transitionStatus !== 'ending') {
        return undefined;
      }

      if (currentAnimationType === 'none') {
        parameters.setMounted(false);
        return undefined;
      }

      const nextDimensions = getDimensions(panel);
      const hasMeasuredSize = nextDimensions.height > 0 || nextDimensions.width > 0;

      if (!hasMeasuredSize) {
        parameters.setMounted(false);
        return undefined;
      }

      setDimensions(nextDimensions);

      if (currentAnimationType === 'css-animation') {
        const restoreAnimationName = setTemporaryStyle(panel, 'animation-name', 'none');
        restoreAnimationName();
      }

      return undefined;
    },
  );

  useOpenChangeComplete({
    get enabled() {
      return parameters.open && parameters.mounted && panelTransitionStatus() === 'idle';
    },
    open: true,
    ref: panelElement,
    onComplete() {
      if (!parameters.open) {
        return;
      }

      setDimensions(EMPTY_DIMENSIONS, false);
    },
  });

  createEffect(
    () => [parameters.open, parameters.mounted, panelTransitionStatus(), panelElement()] as const,
    ([open, mounted, transitionStatus, panel]) => {
      if (open || !mounted || transitionStatus !== 'ending') {
        return undefined;
      }

      if (!panel) {
        parameters.setMounted(false);
        setDimensions(EMPTY_DIMENSIONS, false);
        return undefined;
      }

      const abortController = new AbortController();
      let endingStyleFrame = -1;

      function handleComplete() {
        if (parameters.open) {
          return;
        }

        parameters.setMounted(false);
        setDimensions(EMPTY_DIMENSIONS, false);
      }

      endingStyleFrame = AnimationFrame.request(() => {
        runOnceCloseAnimationsFinish(handleComplete, abortController.signal);
      });

      return () => {
        AnimationFrame.cancel(endingStyleFrame);
        abortController.abort();
      };
    },
  );

  createEffect(
    () => [panelElement(), parameters.hiddenUntilFound, hidden()] as const,
    ([panel, hiddenUntilFound, isHidden]) => {
      if (!panel || !hiddenUntilFound || !isHidden) {
        return;
      }

      panel.setAttribute('hidden', 'until-found');
    },
  );

  createEffect(panelElement, (panel) => {
    if (!panel) {
      return undefined;
    }

    const revealDecisionTimeout = Timeout.create();
    let revertRevealFrame = -1;

    const scheduleRevealRevert = (revertSkippedMotion: boolean, restoreStartingStyle: boolean) => {
      revealDecisionTimeout.start(0, () => {
        if (parameters.open) {
          return;
        }

        revertRevealFrame = AnimationFrame.request(() => {
          if (parameters.open) {
            return;
          }

          if (revertSkippedMotion) {
            shouldSkipNextOpen = false;
          }

          if (restoreStartingStyle) {
            panel.setAttribute(CollapsiblePanelDataAttributes.startingStyle, '');
          }

          panel.setAttribute('hidden', 'until-found');
        });
      });
    };

    const handleBeforeMatch = (event: Event) => {
      const eventDetails = createChangeEventDetails(REASONS.none, event);

      parameters.onOpenChange(true, eventDetails);

      if (eventDetails.isCanceled) {
        scheduleRevealRevert(false, false);
        return;
      }

      shouldSkipNextOpen = true;

      const hadStartingStyle = panel.hasAttribute(CollapsiblePanelDataAttributes.startingStyle);
      panel.removeAttribute(CollapsiblePanelDataAttributes.startingStyle);

      parameters.setOpen(true);

      scheduleRevealRevert(true, hadStartingStyle);
    };

    const cleanupBeforeMatchListener = addEventListener(panel, 'beforematch', handleBeforeMatch);

    return () => {
      revealDecisionTimeout.clear();
      AnimationFrame.cancel(revertRevealFrame);
      cleanupBeforeMatchListener();
    };
  });

  const shouldRender = () =>
    parameters.keepMounted || parameters.hiddenUntilFound || parameters.mounted || parameters.open;

  return {
    height: () => renderedDimensions().height,
    props: {
      get [CollapsiblePanelDataAttributes.startingStyle]() {
        return shouldPersistHiddenTransitionStyles() ? '' : undefined;
      },
      get hidden() {
        return hidden();
      },
      get id() {
        return parameters.id;
      },
    },
    ref,
    shouldPreventOpenAnimation,
    shouldRender,
    transitionStatus: panelTransitionStatus,
    width: () => renderedDimensions().width,
  };
}

function getDimensions(element: HTMLElement) {
  return {
    height: element.scrollHeight,
    width: element.scrollWidth,
  };
}

function getAnimationType(
  element: HTMLElement,
  hasSuppressedMountAnimation: boolean,
): AnimationType {
  const panelStyles = ownerWindow(element).getComputedStyle(element);
  const hasAnimation =
    ((panelStyles.animationName ?? '')
      .split(',')
      .map((name) => name.trim())
      .some((name) => name !== '' && name !== 'none') ||
      hasSuppressedMountAnimation) &&
    hasNonZeroDuration(panelStyles.animationDuration ?? '');
  const hasTransition = hasNonZeroDuration(panelStyles.transitionDuration ?? '');

  if (hasAnimation && hasTransition) {
    if (process.env.NODE_ENV !== 'production') {
      warn(
        'CSS transitions and CSS animations both detected on Collapsible or Accordion panel.',
        'Only one of either animation type should be used.',
      );
    }

    return 'css-transition';
  }

  if (hasTransition) {
    return 'css-transition';
  }

  if (hasAnimation) {
    return 'css-animation';
  }

  return 'none';
}

function hasNonZeroDuration(value: string) {
  return value
    .split(',')
    .map((part) => part.trim())
    .some((part) => part !== '' && Number.parseFloat(part) > 0);
}

/**
 * Temporarily overrides an inline style property and returns a cleanup that
 * restores the previous inline value and priority.
 */
function setTemporaryStyle(element: HTMLElement, property: string, value: string): () => void {
  const previousValue = element.style.getPropertyValue(property);
  const previousPriority = element.style.getPropertyPriority(property);

  element.style.setProperty(property, value);

  return () => {
    if (previousValue === '') {
      element.style.removeProperty(property);
      return;
    }

    element.style.setProperty(property, previousValue, previousPriority);
  };
}

/**
 * Temporarily resets inline alignment styles that can distort scroll-based
 * size measurements, then restores them on the next animation frame.
 */
function resetLayoutStyles(element: HTMLElement): () => void {
  const originalLayoutStyles = {
    'justify-content': element.style.justifyContent,
    'align-items': element.style.alignItems,
    'align-content': element.style.alignContent,
    'justify-items': element.style.justifyItems,
  };

  Object.keys(originalLayoutStyles).forEach((key) => {
    element.style.setProperty(key, 'initial', 'important');
  });

  function restoreLayoutStyles() {
    Object.entries(originalLayoutStyles).forEach(([key, value]) => {
      if (value === '') {
        element.style.removeProperty(key);
        return;
      }

      element.style.setProperty(key, value);
    });
  }

  const frame = AnimationFrame.request(restoreLayoutStyles);

  return () => {
    AnimationFrame.cancel(frame);
    restoreLayoutStyles();
  };
}

export interface UseCollapsiblePanelParameters {
  externalRef?: RefInput<HTMLDivElement> | undefined;
  /**
   * Allows the browser's built-in page search to find and expand the panel contents.
   *
   * Overrides the `keepMounted` prop and uses `hidden="until-found"`
   * to hide the element without removing it from the DOM.
   */
  hiddenUntilFound: boolean;
  /**
   * The `id` attribute of the panel.
   */
  id: string | undefined;
  /**
   * Whether to keep the element in the DOM while the panel is closed.
   * This prop is ignored when `hiddenUntilFound` is used.
   */
  keepMounted: boolean;
  /**
   * Whether the collapsible panel is mounted for transition and hidden-state
   * purposes.
   */
  mounted: boolean;
  onOpenChange: (open: boolean, eventDetails: CollapsibleRoot.ChangeEventDetails) => void;
  /**
   * Whether the collapsible panel is currently open.
   */
  open: boolean;
  setMounted: (nextMounted: boolean) => void;
  setOpen: (nextOpen: boolean) => void;
  transitionStatus: TransitionStatus;
}

export interface UseCollapsiblePanelReturnValue {
  height: Accessor<number | undefined>;
  props: HTMLProps;
  ref: (element: HTMLDivElement | null) => void;
  shouldPreventOpenAnimation: Accessor<boolean>;
  shouldRender: Accessor<boolean>;
  transitionStatus: Accessor<TransitionStatus>;
  width: Accessor<number | undefined>;
}
