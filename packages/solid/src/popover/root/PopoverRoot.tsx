import type { RefObject } from 'base-ui-solidjs-utils/types';
import { createEffect, onCleanup, Show, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { useDismiss } from '../../utils/popups/interactions/useDismiss';
import { FloatingTree } from '../../utils/popups/tree/FloatingTree';
import { PopoverRootContext, usePopoverRootContext } from './PopoverRootContext';
import { PopoverStore } from '../store/PopoverStore';
import type { PopoverHandle } from '../store/PopoverHandle';
import type { BaseUIChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import type { REASONS } from '../../internals/reasons';
import {
  renderPopupRootChildren,
  usePopupRoot,
  usePopupRootSync,
} from '../../utils/popups/popupRoot';
import { usePopupInteractionProps } from '../../utils/popups/popupStoreUtils';
import type { PayloadChildRenderFunction } from '../../utils/popups/popupRoot';
import type { RefInput } from '../../internals/useRenderElement';
import { ownedProps } from '../../internals/ownedProps';

function PopoverRootComponent<Payload>(props: PopoverRoot.Props<Payload>) {
  props = ownedProps(props);
  const { store, open, mounted, payload } = usePopupRoot(
    props,
    (initialState, defaultPopupId) =>
      new PopoverStore<Payload>({ ...initialState, modal: props.modal ?? false }, defaultPopupId),
  );

  onCleanup(store.context.stickIfOpenTimeout.disposeEffect());

  usePopupRootSync(store, open);

  store.useSyncedValues(() => ({
    modal: props.modal ?? false,
  }));

  createEffect(open, (isOpen) => {
    if (!isOpen) {
      store.context.stickIfOpenTimeout.clear();
    }
  });

  const shouldRenderInteractions = () => open() || mounted() || props.handle != null;

  return (
    <PopoverRootContext value={store as PopoverRootContext<unknown>}>
      {untrack(() =>
        renderPopupRootChildren({
          store,
          handle: props.handle as any,
          interactions: () => (
            <Show when={shouldRenderInteractions()}>
              <PopoverInteractions store={store} modal={props.modal ?? false} />
            </Show>
          ),
          children: () => props.children as any,
          payload,
        }),
      )}
    </PopoverRootContext>
  );
}

/**
 * Groups all parts of the popover.
 * Doesn't render its own HTML element.
 *
 * Documentation: [Base UI Popover](https://base-ui.com/react/components/popover)
 */
export function PopoverRoot<Payload = unknown>(props: PopoverRoot.Props<Payload>) {
  props = ownedProps(props);
  if (usePopoverRootContext(true)) {
    return <PopoverRootComponent {...props} />;
  }

  return (
    <FloatingTree>
      <PopoverRootComponent {...props} />
    </FloatingTree>
  );
}

function PopoverInteractions(props: { store: PopoverStore<any>; modal: boolean | 'trap-focus' }) {
  props = ownedProps(props);
  const dismiss = useDismiss(props.store, {
    get outsidePressEvent() {
      return {
        // Ensure `aria-hidden` on outside elements is removed immediately
        // on outside press when trapping focus.
        mouse: props.modal === 'trap-focus' ? ('sloppy' as const) : ('intentional' as const),
        touch: 'sloppy' as const,
      };
    },
  });

  usePopupInteractionProps(props.store, () => ({
    activeTriggerProps: dismiss.reference!,
    inactiveTriggerProps: dismiss.reference!,
    popupProps: dismiss.floating!,
  }));

  return null;
}

export type { PayloadChildRenderFunction };

export interface PopoverRootState {}

export interface PopoverRootProps<Payload = unknown> {
  /**
   * Whether the popover is initially open.
   *
   * To render a controlled popover, use the `open` prop instead.
   * @default false
   */
  defaultOpen?: boolean | undefined;
  /**
   * Whether the popover is currently open.
   */
  open?: boolean | undefined;
  /**
   * Event handler called when the popover is opened or closed.
   */
  onOpenChange?:
    ((open: boolean, eventDetails: PopoverRoot.ChangeEventDetails) => void) | undefined;
  /**
   * Event handler called after any animations complete when the popover is opened or closed.
   */
  onOpenChangeComplete?: ((open: boolean) => void) | undefined;
  /**
   * A ref to imperative actions.
   * - `unmount`: Ends the closing phase of the popover after an externally controlled closing animation finishes.
   * Call `preventUnmountOnClose()` in `onOpenChange` first, otherwise the popover completes closing on its own.
   * Whether it leaves the DOM is decided by `keepMounted` on the portal.
   * - `close`: Closes the popover imperatively when called.
   */
  actionsRef?: RefObject<PopoverRoot.Actions | null> | undefined;
  /**
   * Determines if the popover enters a modal state when open.
   * - `true`: user interaction is limited to the popover: document page scroll is locked, and pointer interactions on outside elements are disabled.
   * - `false`: user interaction with the rest of the document is allowed.
   * - `'trap-focus'`: focus is trapped inside the popover, but document page scroll is not locked and pointer interactions outside of it remain enabled.
   *
   * On touch devices, a `true` modal blocks outside taps but leaves the page scrollable unless the popup spans nearly the full viewport width, matching native iOS behavior.
   *
   * When `modal` is `true`, focus trapping is enabled only if `<Popover.Close>` is rendered
   * inside `<Popover.Popup>`. It can be visually hidden with your own CSS if needed, such as
   * Tailwind's `sr-only` utility.
   *
   * When `modal` is `'trap-focus'`, render `<Popover.Close>` inside `<Popover.Popup>` so touch
   * screen readers can escape the popup.
   * @default false
   */
  modal?: boolean | 'trap-focus' | undefined;
  /**
   * ID of the trigger that the popover is associated with.
   * This is useful in conjunction with the `open` prop to create a controlled popover.
   * There's no need to specify this prop when the popover is uncontrolled (that is, when the `open` prop is not set).
   */
  triggerId?: string | null | undefined;
  /**
   * ID of the trigger that the popover is associated with.
   * This is useful in conjunction with the `defaultOpen` prop to create an initially open popover.
   */
  defaultTriggerId?: string | null | undefined;
  /**
   * A handle to associate the popover with a trigger.
   * If specified, allows external triggers to control the popover's open state.
   */
  handle?: PopoverHandle<Payload> | undefined;
  /**
   * The content of the popover.
   * This can be a regular JSX node or a render function that receives the `payload` of the active trigger.
   */
  children?: JSX.Element | PayloadChildRenderFunction<Payload>;
}

export interface PopoverRootActions {
  unmount: () => void;
  close: () => void;
}

export type PopoverRootChangeEventReason =
  | typeof REASONS.triggerHover
  | typeof REASONS.triggerFocus
  | typeof REASONS.triggerPress
  | typeof REASONS.outsidePress
  | typeof REASONS.escapeKey
  | typeof REASONS.closePress
  | typeof REASONS.focusOut
  | typeof REASONS.imperativeAction
  | typeof REASONS.none;
export type PopoverRootChangeEventDetails =
  BaseUIChangeEventDetails<PopoverRoot.ChangeEventReason> & {
    /** Prevents the popup from unmounting until the `unmount` action is called. */
    preventUnmountOnClose: () => void;
  };

export namespace PopoverRoot {
  export type State = PopoverRootState;
  export type Props<Payload = unknown> = PopoverRootProps<Payload>;
  export type Actions = PopoverRootActions;
  export type ChangeEventReason = PopoverRootChangeEventReason;
  export type ChangeEventDetails = PopoverRootChangeEventDetails;
}

