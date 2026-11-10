import type { JSX } from '@solidjs/web';
import { createMemo, omit, untrack } from 'solid-js';
import { isElement } from '@floating-ui/utils/dom';
import { useTimeout } from 'base-ui-solidjs-utils/useTimeout';
import { createSyncSignal } from 'base-ui-solidjs-utils/createSyncSignal';
import { closest, contains, getTarget } from 'base-ui-solidjs-utils/shadowDom';
import { useTooltipRootContext } from '../root/TooltipRootContext';
import type { BaseUIComponentProps, BaseUIEvent } from '../../internals/types';
import type { RefInput } from '../../internals/useRenderElement';
import { triggerOpenStateMapping } from '../../utils/popups/popupStateMapping';
import { useRenderElement } from '../../internals/useRenderElement';
import { usePopupHandleStore } from '../../utils/popups/usePopupHandleStore';
import { useTriggerDataForwarding } from '../../utils/popups/popupStoreUtils';
import { useBaseUiId } from '../../internals/useBaseUiId';
import type { TooltipHandle } from '../store/TooltipHandle';
import { useTooltipProviderContext } from '../provider/TooltipProviderContext';
import { safePolygon } from '../../utils/popups/interactions/safePolygon';
import { useDelayGroup } from '../../utils/popups/delay-group/FloatingDelayGroup';
import { useFocus } from '../../utils/popups/interactions/useFocus';
import { useHoverTriggerInteraction } from '../../utils/popups/interactions/useHoverTriggerInteraction';
import { isMouseLikePointerType } from '../../utils/popups/event';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { getHoverIntent } from '../../utils/popups/interactions/hoverIntent';
import { getDelay } from '../../utils/popups/interactions/useHoverShared';
import { mergeProps } from '../../merge-props';
import * as TooltipTriggerDataAttributes from './TooltipTriggerDataAttributes';
import { ownedProps } from '../../internals/ownedProps';

import { OPEN_DELAY } from '../utils/constants';

const TOOLTIP_TRIGGER_IDENTIFIER = 'data-base-ui-tooltip-trigger';

function getTargetElement(event: Event): Element | null {
  const target = getTarget(event);
  return isElement(target) ? target : null;
}

/**
 * An element to attach the tooltip to.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Tooltip](https://base-ui.com/react/components/tooltip)
 */
export function TooltipTrigger<Payload = unknown>(componentProps: TooltipTrigger.Props<Payload>) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'style',
    'handle',
    'payload',
    'disabled',
    'delay',
    'closeOnClick',
    'closeDelay',
    'id',
    'children',
    'ref',
  );
  const closeOnClick = () => componentProps.closeOnClick ?? true;

  const rootStore = useTooltipRootContext(true);
  const handleStore = usePopupHandleStore(untrack(() => componentProps.handle) as any);
  const store = (handleStore ?? rootStore) as NonNullable<typeof rootStore>;
  if (!store) {
    throw new Error(
      'Base UI: <Tooltip.Trigger> must be either used within a <Tooltip.Root> component or provided with a handle.',
    );
  }

  const thisTriggerId = useBaseUiId(() => componentProps.id);
  const isTriggerActive = store.useState('isTriggerActive', thisTriggerId);
  const isOpenedByThisTrigger = store.useState('isOpenedByTrigger', thisTriggerId);

  const [triggerElement, setTriggerElement] = createSyncSignal<Element | null>(null);

  const closeDelayWithDefault = () => componentProps.closeDelay ?? 0;

  const { registerTrigger, isMountedByThisTrigger } = useTriggerDataForwarding(
    thisTriggerId,
    triggerElement as any,
    store,
    () => ({
      payload: componentProps.payload,
      closeOnClick: closeOnClick(),
      closeDelay: closeDelayWithDefault(),
    }),
  );

  const providerDelay = useTooltipProviderContext();
  const { activeIdRef, delayRef, isInstantPhase, hasProvider } = useDelayGroup(store as any, {
    open: isOpenedByThisTrigger,
  });
  const hoverIntent = getHoverIntent(store);

  store.useSyncedValue('isInstantPhase', isInstantPhase);

  const rootDisabled = store.useState('disabled');
  const disabled = () => componentProps.disabled || rootDisabled();
  const trackCursorAxis = store.useState('trackCursorAxis');
  const disableHoverablePopup = store.useState('disableHoverablePopup');

  let isNestedTriggerHovered = false;
  const nestedTriggerOpenTimeout = useTimeout();
  // Local copy so it can be cleared on mouseLeave without resetting the hover hook's own pointerType.
  let pointerType: string | undefined;

  function getOpenDelay() {
    // Adjacent tooltips open instantly while the group is active.
    if (hasProvider && activeIdRef.current != null) {
      return 0;
    }
    return untrack(() => componentProps.delay ?? providerDelay?.() ?? OPEN_DELAY);
  }

  function isEnabledNestedTriggerTarget(target: Element | null) {
    const triggerEl = triggerElement();
    if (!triggerEl || !target) {
      return false;
    }

    const nearestTrigger = closest(target, `[${TOOLTIP_TRIGGER_IDENTIFIER}]`);
    return (
      nearestTrigger !== null && nearestTrigger !== triggerEl && contains(triggerEl, nearestTrigger)
    );
  }

  function detectNestedTriggerHover(target: Element | null) {
    const nestedTriggerHovered = isEnabledNestedTriggerTarget(target);

    isNestedTriggerHovered = nestedTriggerHovered;
    if (nestedTriggerHovered) {
      hoverIntent.cancelPendingOpen();
      nestedTriggerOpenTimeout.clear();
    }
    return nestedTriggerHovered;
  }

  const hoverProps = useHoverTriggerInteraction(store, {
    get enabled() {
      return !disabled();
    },
    mouseOnly: true,
    move: false,
    get handleClose() {
      return !disableHoverablePopup() && trackCursorAxis() !== 'both' ? safePolygon() : null;
    },
    restMs: getOpenDelay,
    delay() {
      if (untrack(() => componentProps.closeDelay) == null && hasProvider) {
        return { close: getDelay(delayRef.current, 'close') };
      }
      return { close: untrack(closeDelayWithDefault) };
    },
    triggerElement,
    get isActiveTrigger() {
      return isTriggerActive();
    },
    shouldOpen() {
      return !isNestedTriggerHovered;
    },
  } as any);

  const focusProps = useFocus(store, {
    get enabled() {
      return !disabled();
    },
  });

  const handleNestedTriggerHover = (event: MouseEvent) => {
    const wasNestedTriggerHovered = isNestedTriggerHovered;
    const target = getTargetElement(event);
    const nestedTriggerHovered = detectNestedTriggerHover(target);
    const triggerEl = triggerElement() as HTMLElement | null;
    const targetInsideTrigger = triggerEl && target && contains(triggerEl, target);

    // Only close hover-opened parents. Focus/click-like opens remain owned by
    // their original interaction and should not be clobbered by nested hover.
    if (
      nestedTriggerHovered &&
      store.select('open') &&
      store.select('lastOpenChangeReason') === REASONS.triggerHover
    ) {
      store.setOpen(false, createChangeEventDetails(REASONS.triggerHover, event));
      return;
    }

    if (
      wasNestedTriggerHovered &&
      !nestedTriggerHovered &&
      targetInsideTrigger &&
      !untrack(disabled) &&
      !store.select('open') &&
      triggerEl &&
      // Match the hover hook's non-strict mouse fallback for mouse-only event sequences.
      isMouseLikePointerType(pointerType)
    ) {
      const open = () => {
        if (!isNestedTriggerHovered && !untrack(disabled) && !store.select('open')) {
          store.setOpen(true, createChangeEventDetails(REASONS.triggerHover, event, triggerEl));
        }
      };

      const openDelay = getOpenDelay();

      // With `move: false`, the hover hook only listens to mouseenter/mouseleave
      // on the parent trigger. Leaving a nested child for the parent area fires
      // no event the hook can react to, so reopen locally.
      if (openDelay === 0) {
        nestedTriggerOpenTimeout.clear();
        open();
      } else {
        nestedTriggerOpenTimeout.start(openDelay, open);
      }
    }
  };

  const rootTriggerProps = store.useState(
    'appliedTriggerProps',
    () => isMountedByThisTrigger() || trackCursorAxis() !== 'none',
  );

  const state = createMemo<TooltipTriggerState>(() => ({ open: isOpenedByThisTrigger() }));

  return useRenderElement('button', componentProps, {
    state,
    ref: [
      registerTrigger,
      (el: Element | null) => {
        setTriggerElement(el);
      },
    ],
    props: [
      hoverProps,
      (merged: Record<string, any>) => mergeProps(merged, focusProps.reference),
      (merged: Record<string, any>) => mergeProps(merged, rootTriggerProps()),
      {
        onMouseOver(event: MouseEvent) {
          handleNestedTriggerHover(event);
        },
        onFocus(event: FocusEvent) {
          if (isEnabledNestedTriggerTarget(getTargetElement(event))) {
            (event as BaseUIEvent<FocusEvent>).preventBaseUIHandler();
          }
        },
        onMouseLeave() {
          isNestedTriggerHovered = false;
          nestedTriggerOpenTimeout.clear();
          pointerType = undefined;
        },
        onPointerEnter(event: PointerEvent) {
          pointerType = event.pointerType;
        },
        onPointerDown(event: PointerEvent) {
          pointerType = event.pointerType;
          const shouldCloseOnClick = untrack(closeOnClick);
          store.set('closeOnClick', shouldCloseOnClick);
          if (shouldCloseOnClick && !store.select('open')) {
            store.cancelPendingOpen(event);
          }
        },
        onClick(event: MouseEvent) {
          if (untrack(closeOnClick) && !store.select('open')) {
            store.cancelPendingOpen(event);
          }
        },
        get id() {
          return thisTriggerId();
        },
        get [TooltipTriggerDataAttributes.triggerDisabled]() {
          return disabled() ? '' : undefined;
        },
        get [TOOLTIP_TRIGGER_IDENTIFIER]() {
          return disabled() ? undefined : '';
        },
      },
      elementProps,
    ],
    stateAttributesMapping: triggerOpenStateMapping,
  });
}

export interface TooltipTriggerState {
  /**
   * Whether the tooltip is currently open and was opened by this trigger.
   */
  open: boolean;
}

export interface TooltipTriggerProps<Payload = unknown> extends BaseUIComponentProps<
  'button',
  TooltipTriggerState
> {
  /**
   * A handle to associate the trigger with a tooltip.
   */
  handle?: TooltipHandle<Payload> | undefined;
  /**
   * A payload to pass to the tooltip when it is opened.
   */
  payload?: Payload | undefined;
  /**
   * How long to wait before opening the tooltip on hover. Specified in milliseconds.
   * @default 600
   */
  delay?: number | undefined;
  /**
   * Whether the tooltip should close when this trigger is clicked.
   * @default true
   */
  closeOnClick?: boolean | undefined;
  /**
   * How long to wait before closing the tooltip. Specified in milliseconds.
   * @default 0
   */
  closeDelay?: number | undefined;
  /**
   * If `true`, the tooltip will not open when interacting with this trigger.
   * Note that this doesn't apply the `disabled` attribute to the trigger element.
   * If you want to disable the trigger element itself, you can pass the `disabled` prop to the trigger element via the `render` prop.
   * @default false
   */
  disabled?: boolean | undefined;
}

export namespace TooltipTrigger {
  export type State = TooltipTriggerState;
  export type Props<Payload = unknown> = TooltipTriggerProps<Payload>;
}
