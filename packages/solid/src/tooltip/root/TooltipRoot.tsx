import type { RefObject } from 'base-ui-solidjs-utils/types';
import { createEffect, Show, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { EMPTY_OBJECT } from 'base-ui-solidjs-utils/empty';
import { TooltipRootContext } from './TooltipRootContext';
import { useClientPoint } from '../../utils/popups/interactions/useClientPoint';
import { useDismiss } from '../../utils/popups/interactions/useDismiss';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import type { BaseUIChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { renderPopupRootChildren, usePopupRoot } from '../../utils/popups/popupRoot';
import { usePopupInteractionProps } from '../../utils/popups/popupStoreUtils';
import type { PayloadChildRenderFunction } from '../../utils/popups/popupRoot';
import { mergeProps } from '../../merge-props';
import { TooltipStore } from '../store/TooltipStore';
import type { State as TooltipStoreState } from '../store/TooltipStore';
import type { TooltipHandle } from '../store/TooltipHandle';
import { REASONS } from '../../internals/reasons';
import { ownedProps } from '../../internals/ownedProps';

/**
 * Groups all parts of the tooltip.
 * Doesn't render its own HTML element.
 *
 * Documentation: [Base UI Tooltip](https://base-ui.com/react/components/tooltip)
 */
export function TooltipRoot<Payload = unknown>(props: TooltipRoot.Props<Payload>) {
  props = ownedProps(props);
  const disabled = () => props.disabled ?? false;
  const disableHoverablePopup = () => props.disableHoverablePopup ?? false;
  const trackCursorAxis = () => props.trackCursorAxis ?? 'none';

  const { store, open, mounted, payload, transitionStatus } = usePopupRoot(
    props as any,
    (initialState, defaultPopupId) => new TooltipStore<Payload>(initialState, defaultPopupId),
    {
      closeOnActiveTriggerUnmount: true,
      get disabled() {
        return disabled();
      },
    },
  );

  const openState = store.useState('open');
  const activeTriggerId = store.useState('activeTriggerId');

  store.useSyncedValues(() => ({
    trackCursorAxis: trackCursorAxis(),
    disableHoverablePopup: disableHoverablePopup(),
    disabled: disabled(),
  }));

  const isInstantPhase = store.useState('isInstantPhase');
  const instantType = store.useState('instantType');
  const lastOpenChangeReason = store.useState('lastOpenChangeReason');

  // Animations should be instant in two cases:
  // 1) Opening during the provider's instant phase (adjacent tooltip opens instantly)
  // 2) Closing because another tooltip opened (reason === 'none')
  // Otherwise, allow the animation to play. In particular, do not disable animations
  // during the 'ending' phase unless it's due to a sibling opening.
  let previousInstantType: TooltipStoreState<Payload>['instantType'] | null = null;

  createEffect(
    () => [openState(), disabled()] as const,
    ([isOpen, isDisabled]) => {
      if (isOpen && isDisabled) {
        store.setOpen(false, createChangeEventDetails(REASONS.disabled));
      }
    },
  );

  createEffect(
    () => [transitionStatus(), isInstantPhase(), lastOpenChangeReason(), instantType()] as const,
    ([status, instantPhase, reason, type]) => {
      if ((status === 'ending' && reason === REASONS.none) || (status !== 'ending' && instantPhase)) {
        // Capture the current instant type so we can restore it later
        // and set to 'delay' to disable animations while moving from one trigger to another
        // within a delay group.
        if (type !== 'delay') {
          previousInstantType = type;
        }
        store.set('instantType', 'delay');
      } else if (previousInstantType !== null) {
        store.set('instantType', previousInstantType);
        previousInstantType = null;
      }
    },
  );

  createEffect(
    () => [activeTriggerId(), open()] as const,
    ([triggerId, isOpen]) => {
      if (isOpen) {
        if (triggerId == null) {
          store.set('payload', undefined);
        }
      }
    },
  );

  const shouldRenderInteractions = () =>
    open() || mounted() || (!disabled() && trackCursorAxis() !== 'none');

  return (
    <TooltipRootContext value={store as TooltipRootContext}>
      {untrack(() =>
        renderPopupRootChildren({
          store,
          handle: props.handle as any,
          interactions: () => (
            <Show when={shouldRenderInteractions()}>
              <TooltipInteractions
                store={store}
                disabled={disabled()}
                trackCursorAxis={trackCursorAxis()}
              />
            </Show>
          ),
          children: () => props.children as any,
          payload,
        }),
      )}
    </TooltipRootContext>
  );
}

export interface TooltipRootState {}

export interface TooltipRootProps<Payload = unknown> {
  /**
   * Whether the tooltip is initially open.
   *
   * To render a controlled tooltip, use the `open` prop instead.
   * @default false
   */
  defaultOpen?: boolean | undefined;
  /**
   * Whether the tooltip is currently open.
   */
  open?: boolean | undefined;
  /**
   * Event handler called when the tooltip is opened or closed.
   */
  onOpenChange?:
    ((open: boolean, eventDetails: TooltipRoot.ChangeEventDetails) => void) | undefined;
  /**
   * Event handler called after any animations complete when the tooltip is opened or closed.
   */
  onOpenChangeComplete?: ((open: boolean) => void) | undefined;
  /**
   * Whether the tooltip contents can be hovered without closing the tooltip.
   * @default false
   */
  disableHoverablePopup?: boolean | undefined;
  /**
   * Determines which axis the tooltip should track the cursor on.
   * @default 'none'
   */
  trackCursorAxis?: 'none' | 'x' | 'y' | 'both' | undefined;
  /**
   * A ref to imperative actions.
   * - `unmount`: Ends the closing phase of the tooltip after an externally controlled closing animation finishes.
   * Call `preventUnmountOnClose()` in `onOpenChange` first, otherwise the tooltip completes closing on its own.
   * Whether it leaves the DOM is decided by `keepMounted` on the portal.
   * - `close`: Closes the tooltip imperatively when called.
   */
  actionsRef?: RefObject<TooltipRoot.Actions | null> | undefined;
  /**
   * Whether the tooltip is disabled.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * A handle to associate the tooltip with a trigger.
   * If specified, allows external triggers to control the tooltip's open state.
   * Can be created with the Tooltip.createHandle() method.
   */
  handle?: TooltipHandle<Payload> | undefined;
  /**
   * The content of the tooltip.
   * This can be a regular JSX node or a render function that receives the `payload` of the active trigger.
   */
  children?: JSX.Element | PayloadChildRenderFunction<Payload>;
  /**
   * ID of the trigger that the tooltip is associated with.
   * This is useful in conjunction with the `open` prop to create a controlled tooltip.
   * There's no need to specify this prop when the tooltip is uncontrolled (that is, when the `open` prop is not set).
   */
  triggerId?: string | null | undefined;
  /**
   * ID of the trigger that the tooltip is associated with.
   * This is useful in conjunction with the `defaultOpen` prop to create an initially open tooltip.
   */
  defaultTriggerId?: string | null | undefined;
}

export interface TooltipRootActions {
  unmount: () => void;
  close: () => void;
}

export type TooltipRootChangeEventReason =
  | typeof REASONS.triggerHover
  | typeof REASONS.triggerFocus
  | typeof REASONS.triggerPress
  | typeof REASONS.outsidePress
  | typeof REASONS.escapeKey
  | typeof REASONS.disabled
  | typeof REASONS.imperativeAction
  | typeof REASONS.none;

export type TooltipRootChangeEventDetails =
  BaseUIChangeEventDetails<TooltipRoot.ChangeEventReason> & {
    /** Prevents the popup from unmounting until the `unmount` action is called. */
    preventUnmountOnClose: () => void;
  };

export namespace TooltipRoot {
  export type State = TooltipRootState;
  export type Props<Payload = unknown> = TooltipRootProps<Payload>;
  export type Actions = TooltipRootActions;
  export type ChangeEventReason = TooltipRootChangeEventReason;
  export type ChangeEventDetails = TooltipRootChangeEventDetails;
}

function TooltipInteractions<Payload>(props: {
  store: TooltipStore<Payload>;
  disabled: boolean;
  trackCursorAxis: 'none' | 'x' | 'y' | 'both';
}) {
  const store = props.store;
  const dismiss = useDismiss(store, {
    get enabled() {
      return !props.disabled;
    },
    referencePress: () => store.select('closeOnClick'),
  });
  const clientPoint = useClientPoint(store, {
    get enabled() {
      return !props.disabled && props.trackCursorAxis !== 'none';
    },
    get axis() {
      return props.trackCursorAxis === 'none' ? undefined : props.trackCursorAxis;
    },
  });

  // Both hooks return `trigger: reference` (same object identity), so the active and
  // inactive trigger props can never differ. `useClientPoint` has no floating-side props.
  usePopupInteractionProps(store, () => {
    const triggerProps = mergeProps(clientPoint.reference, dismiss.reference);
    return {
      activeTriggerProps: triggerProps,
      inactiveTriggerProps: triggerProps,
      popupProps: dismiss.floating ?? EMPTY_OBJECT,
    };
  });

  return null;
}
