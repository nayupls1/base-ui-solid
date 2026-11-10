import { createEffect, createMemo, createSignal, onCleanup, untrack, type Accessor } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { useAnimationFrame } from 'base-ui-solidjs-utils/useAnimationFrame';
import { ownerDocument } from 'base-ui-solidjs-utils/owner';
import { createSyncSignal } from 'base-ui-solidjs-utils/createSyncSignal';
import type { Dimensions } from '@floating-ui/utils';
import { useAnimationsFinished } from '../../../internals/useAnimationsFinished';
import type { StateAttributesMapping } from '../../../internals/getStateAttributesProps';
import { flushIfPossible } from '../../../internals/flushIfPossible';
import { usePopupAutoResize } from './usePopupAutoResize';
import type { Side } from '../../../internals/useAnchorPositioning';
import { useDirection } from '../../../internals/direction-context/DirectionContext';
import { adaptiveOrigin } from '../positioning/adaptiveOriginMiddleware';
import * as CommonPopupCssVars from './CommonPopupCssVars';
import * as CommonViewportDataAttributes from './CommonViewportDataAttributes';

export const popupViewportStateMapping: StateAttributesMapping<{
  activationDirection: string | undefined;
}> = {
  activationDirection: (value) =>
    value
      ? {
          [CommonViewportDataAttributes.activationDirection]: value,
        }
      : null,
};

export interface PopupViewportState {
  activationDirection: string | undefined;
  transitioning: boolean;
}

type PopupViewportStore = {
  useState: (key: any, ...args: any[]) => Accessor<any>;
  set: (key: any, value: any) => void;
};

export interface UsePopupViewportParameters {
  store: PopupViewportStore;
  side: Side;
  children?: () => JSX.Element;
}

export interface UsePopupViewportResult {
  children: () => JSX.Element;
  state: Accessor<PopupViewportState>;
}

/**
 * Renders the popup content inside a "current" container, and the previous content in a
 * "previous" container while the popup transitions between triggers.
 * Parameters are read lazily, so they can be getters.
 */
export function usePopupViewport(parameters: UsePopupViewportParameters): UsePopupViewportResult {
  const { store } = parameters;

  const direction = useDirection();

  const activeTrigger = store.useState('activeTriggerElement');
  const activeTriggerId = store.useState('activeTriggerId');
  const open = store.useState('open');
  const payload = store.useState('payload');
  const mounted = store.useState('mounted');
  const popupElement = store.useState('popupElement');
  const positionerElement = store.useState('positionerElement');

  const currentContentKey = usePopupContentKey(activeTriggerId, payload);

  let capturedNode: HTMLElement | null = null;
  const [previousContentNode, setPreviousContentNode] = createSyncSignal<HTMLElement | null>(null);

  const [newTriggerOffset, setNewTriggerOffset] = createSyncSignal<Offset | null>(null);

  const [currentContainer, setCurrentContainer] = createSyncSignal<HTMLDivElement | null>(null);
  let previousContainer: HTMLDivElement | null = null;

  const onAnimationsFinished = useAnimationsFinished(() => currentContainer(), true);
  const cleanupFrame = useAnimationFrame();
  let cleanupController: AbortController | null = null;

  const [previousContentDimensions, setPreviousContentDimensions] = createSyncSignal<{
    width: number;
    height: number;
  } | null>(null);

  const [showStartingStyleAttribute, setShowStartingStyleAttribute] = createSyncSignal(false);

  store.set('adaptiveOrigin', adaptiveOrigin);
  onCleanup(() => {
    store.set('adaptiveOrigin', undefined);
  });

  const handleMeasureLayout = () => {
    const current = currentContainer();
    current?.style.setProperty('animation', 'none');
    current?.style.setProperty('transition', 'none');

    previousContainer?.style.setProperty('display', 'none');
  };

  const handleMeasureLayoutComplete = (previousDimensions: Dimensions | null) => {
    const current = currentContainer();
    current?.style.removeProperty('animation');
    current?.style.removeProperty('transition');

    previousContainer?.style.removeProperty('display');

    if (previousDimensions) {
      setPreviousContentDimensions(previousDimensions);
    }
  };

  const armViewportCleanup = () => {
    cleanupController?.abort();
    const controller = new AbortController();
    cleanupController = controller;
    onAnimationsFinished(() => {
      setPreviousContentNode(null);
      setPreviousContentDimensions(null);
      capturedNode = null;
    }, controller.signal);
  };

  let lastHandledTrigger: Element | null = null;
  let previousActiveTrigger: Element | null = null;

  createEffect(
    () => [open(), mounted()] as const,
    ([isOpen, isMounted]) => {
      if (!isOpen || !isMounted) {
        lastHandledTrigger = null;
      }
    },
  );

  createEffect(
    () => [open(), activeTrigger()] as const,
    ([isOpen, trigger]) => {
      const previous = previousActiveTrigger;
      previousActiveTrigger = isOpen ? trigger : null;
      if (
        isOpen &&
        trigger &&
        previous &&
        trigger !== previous &&
        lastHandledTrigger !== trigger &&
        capturedNode
      ) {
        setPreviousContentNode(capturedNode);
        setShowStartingStyleAttribute(true);

        const offset = calculateRelativePosition(previous, trigger);
        setNewTriggerOffset(offset);

        lastHandledTrigger = trigger;
      }
    },
  );

  createEffect(
    () => [currentContentKey(), previousContentNode()] as const,
    ([, previousNode]) => {
      if (previousNode == null) {
        return;
      }

      cleanupController?.abort();

      setShowStartingStyleAttribute(true);

      cleanupFrame.request(() => {
        setShowStartingStyleAttribute(false);
        flushIfPossible();
        armViewportCleanup();
      });
    },
  );

  // Capture a static copy of the current content after every change, so the previous content
  // can be shown while transitioning to the content of another trigger.
  createEffect(currentContainer, (source) => {
    if (!source) {
      return undefined;
    }

    const capture = () => {
      const wrapper = ownerDocument(source).createElement('div');
      for (const child of Array.from(source.childNodes)) {
        wrapper.appendChild(child.cloneNode(true));
      }
      capturedNode = wrapper;
    };

    capture();
    const observer = new MutationObserver(capture);
    observer.observe(source, { childList: true, subtree: true, characterData: true, attributes: true });
    return () => {
      observer.disconnect();
    };
  });

  createEffect(previousContentNode, (previousNode) => {
    const container = previousContainer;
    if (!container || !previousNode) {
      return;
    }

    container.replaceChildren(...Array.from(previousNode.childNodes));
  });

  usePopupAutoResize({
    get popupElement() {
      return popupElement();
    },
    get positionerElement() {
      return positionerElement();
    },
    get mounted() {
      return mounted();
    },
    get content() {
      return payload();
    },
    onMeasureLayout: handleMeasureLayout,
    onMeasureLayoutComplete: handleMeasureLayoutComplete,
    get side() {
      return parameters.side;
    },
    get direction() {
      return direction();
    },
  });

  const isTransitioning = () => previousContentNode() != null;

  const currentChildren = () => {
    // Re-create the children when the content key changes (React's `key`).
    currentContentKey();
    return untrack(() => parameters.children?.());
  };

  const children = () => (
    <>
      {isTransitioning() ? (
        <div
          data-previous
          inert
          ref={(el: HTMLDivElement) => {
            previousContainer = el;
            const node = untrack(previousContentNode);
            if (node) {
              el.replaceChildren(...Array.from(node.childNodes));
            }
          }}
          style={{
            ...(previousContentDimensions()
              ? {
                  [CommonPopupCssVars.popupWidth]: `${previousContentDimensions()!.width}px`,
                  [CommonPopupCssVars.popupHeight]: `${previousContentDimensions()!.height}px`,
                }
              : null),
            position: 'absolute',
          }}
          data-ending-style={showStartingStyleAttribute() ? undefined : ''}
        />
      ) : null}
      <div
        data-current
        ref={(el: HTMLDivElement) => {
          setCurrentContainer(el);
        }}
        data-starting-style={isTransitioning() && showStartingStyleAttribute() ? '' : undefined}
      >
        {currentChildren()}
      </div>
    </>
  );

  const state = createMemo<PopupViewportState>(() => ({
    activationDirection: getActivationDirection(newTriggerOffset()),
    transitioning: isTransitioning(),
  }));

  return { children, state };
}

export type Offset = {
  horizontal: number;
  vertical: number;
};

/**
 * Returns a string describing the provided offset.
 * It describes both the horizontal and vertical offset, separated by a space.
 *
 * @param offset
 */
export function getActivationDirection(offset: Offset | null): string | undefined {
  if (!offset) {
    return undefined;
  }

  return `${getValueWithTolerance(offset.horizontal, 5, 'right', 'left')} ${getValueWithTolerance(offset.vertical, 5, 'down', 'up')}`;
}

/**
 * Returns a label describing the value (positive/negative) treating values
 * within tolerance as zero.
 *
 * @param value Value to check
 * @param tolerance Tolerance to treat the value as zero.
 * @param positiveLabel
 * @param negativeLabel
 * @returns If 0 < abs(value) < tolerance, returns an empty string. Otherwise returns positiveLabel or negativeLabel.
 */
function getValueWithTolerance(
  value: number,
  tolerance: number,
  positiveLabel: string,
  negativeLabel: string,
) {
  if (value > tolerance) {
    return positiveLabel;
  }

  if (value < -tolerance) {
    return negativeLabel;
  }

  return '';
}

/**
 * Calculates the relative position between centers of two elements.
 */
export function calculateRelativePosition(from: Element, to: Element): Offset {
  const fromRect = from.getBoundingClientRect();
  const toRect = to.getBoundingClientRect();

  const fromCenter = {
    x: fromRect.left + fromRect.width / 2,
    y: fromRect.top + fromRect.height / 2,
  };
  const toCenter = {
    x: toRect.left + toRect.width / 2,
    y: toRect.top + toRect.height / 2,
  };

  return {
    horizontal: toCenter.x - fromCenter.x,
    vertical: toCenter.y - fromCenter.y,
  };
}

/**
 * Returns a key that forces remounting content when triggers change or a payload is updated.
 */

function usePopupContentKey(
  activeTriggerId: Accessor<string | null>,
  payload: Accessor<unknown>,
): Accessor<string> {
  const [contentKey, setContentKey] = createSignal(0, { ownedWrite: true });
  let previousActiveTriggerId = untrack(activeTriggerId);
  let previousPayload = untrack(payload);
  let pendingPayloadUpdate = false;

  createEffect(
    () => [activeTriggerId(), payload()] as const,
    ([currentTriggerId, currentPayload]) => {
      const triggerIdChanged = currentTriggerId !== previousActiveTriggerId;
      const payloadChanged = currentPayload !== previousPayload;

      if (triggerIdChanged) {
        setContentKey((value) => value + 1);
        pendingPayloadUpdate = !payloadChanged;
      } else if (pendingPayloadUpdate && payloadChanged) {
        setContentKey((value) => value + 1);
        pendingPayloadUpdate = false;
      }

      previousActiveTriggerId = currentTriggerId;
      previousPayload = currentPayload;
    },
  );

  return () => `${activeTriggerId() ?? 'current'}-${contentKey()}`;
}
