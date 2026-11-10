import type { JSX } from '@solidjs/web';
import { createMemo, omit, Show, untrack } from 'solid-js';
import { createSyncSignal } from 'base-ui-solidjs-utils/createSyncSignal';
import { usePopoverRootContext } from '../root/PopoverRootContext';
import { useButton } from '../../internals/use-button/useButton';
import type { BaseUIComponentProps, NativeButtonProps } from '../../internals/types';
import {
  triggerOpenStateMapping,
  pressableTriggerOpenStateMapping,
} from '../../utils/popups/popupStateMapping';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import { useRenderElement } from '../../internals/useRenderElement';
import { CLICK_TRIGGER_IDENTIFIER } from '../../internals/constants';
import { mergeProps } from '../../merge-props';
import { safePolygon } from '../../utils/popups/interactions/safePolygon';
import { useClick } from '../../utils/popups/interactions/useClick';
import { useHoverTriggerInteraction } from '../../utils/popups/interactions/useHoverTriggerInteraction';
import { OPEN_DELAY } from '../utils/constants';
import type { PopoverHandle } from '../store/PopoverHandle';
import { useBaseUiId } from '../../internals/useBaseUiId';
import { FocusGuard } from '../../utils/popups/focus/FocusGuard';
import { useTriggerDataForwarding } from '../../utils/popups/popupStoreUtils';
import { usePopupHandleStore } from '../../utils/popups/usePopupHandleStore';
import { useTriggerFocusGuards } from '../../utils/popups/useTriggerFocusGuards';
import { useOpenMethodTriggerProps } from '../../utils/popups/interactions/useOpenInteractionType';
import { ownedProps } from '../../internals/ownedProps';

/**
 * A button that opens the popover.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Popover](https://base-ui.com/react/components/popover)
 */
export function PopoverTrigger(componentProps: PopoverTrigger.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'style',
    'disabled',
    'nativeButton',
    'handle',
    'payload',
    'openOnHover',
    'delay',
    'closeDelay',
    'id',
    'children',
    'ref',
  );

  const disabled = () => componentProps.disabled ?? false;
  const openOnHover = () => componentProps.openOnHover ?? false;

  const rootStore = usePopoverRootContext(true);
  const handleStore = usePopupHandleStore(untrack(() => componentProps.handle) as any);
  const store = (handleStore ?? rootStore) as NonNullable<typeof rootStore>;
  if (!store) {
    throw new Error(
      'Base UI: <Popover.Trigger> must be either used within a <Popover.Root> component or provided with a handle.',
    );
  }

  const thisTriggerId = useBaseUiId(() => componentProps.id);
  const isTriggerActive = store.useState('isTriggerActive', thisTriggerId);
  const isOpenedByThisTrigger = store.useState('isOpenedByTrigger', thisTriggerId);
  const popupId = store.useState('triggerPopupId', thisTriggerId);

  const [triggerElement, setTriggerElement] = createSyncSignal<HTMLElement | null>(null);
  const triggerElementRef = {
    get current() {
      return triggerElement();
    },
  };

  const { registerTrigger, isMountedByThisTrigger } = useTriggerDataForwarding(
    thisTriggerId,
    triggerElement,
    store,
    () => ({
      payload: componentProps.payload,
      disabled: disabled(),
      openOnHover: openOnHover(),
      closeDelay: componentProps.closeDelay ?? 0,
    }),
  );

  const isPressOpenedByThisTrigger = store.useState('isPressOpenedByTrigger', thisTriggerId);
  const isTouchPressOpen = store.useState('isTouchPressOpen', openOnHover);
  const hasFocusGuards = store.useState('hasTriggerFocusGuards', thisTriggerId);

  const hoverProps = useHoverTriggerInteraction(store, {
    get enabled() {
      return !disabled() && openOnHover() && !isTouchPressOpen();
    },
    mouseOnly: true,
    move: false,
    handleClose: safePolygon(),
    get restMs() {
      return componentProps.delay ?? OPEN_DELAY;
    },
    get delay() {
      return {
        close: componentProps.closeDelay ?? 0,
      };
    },
    triggerElement,
    get isActiveTrigger() {
      return isTriggerActive();
    },
  });

  const click = useClick(store, { stickIfOpen: () => store.context.stickIfOpen });
  const interactionTypeProps = useOpenMethodTriggerProps(
    () => store.select('open'),
    (interactionType) => {
      store.set('openMethod', interactionType);
    },
  );

  const rootTriggerProps = store.useState('triggerProps', isMountedByThisTrigger);

  const { getButtonProps, buttonRef } = useButton({
    get disabled() {
      return disabled();
    },
    get native() {
      return componentProps.nativeButton ?? true;
    },
  });

  const stateAttributesMapping: StateAttributesMapping<{ open: boolean }> = {
    open(value) {
      if (isPressOpenedByThisTrigger()) {
        return pressableTriggerOpenStateMapping.open(value);
      }

      return triggerOpenStateMapping.open(value);
    },
  };

  const { handlePreFocusGuardFocus, handleFocusTargetFocus } = useTriggerFocusGuards(
    store,
    triggerElementRef,
  );

  const state = createMemo<PopoverTriggerState>(() => ({
    disabled: disabled(),
    open: isOpenedByThisTrigger(),
  }));

  const element = untrack(() =>
    useRenderElement('button', componentProps, {
      state,
      ref: [
        buttonRef,
        registerTrigger,
        (el: HTMLElement | null) => {
          setTriggerElement(el);
        },
      ],
      props: [
        (merged: Record<string, any>) => mergeProps(merged, click.reference),
        hoverProps,
        (merged: Record<string, any>) => mergeProps(merged, rootTriggerProps()),
        interactionTypeProps,
        {
          [CLICK_TRIGGER_IDENTIFIER]: '',
          get id() {
            return thisTriggerId();
          },
          'aria-haspopup': 'dialog' as const,
          get 'aria-expanded'() {
            return isOpenedByThisTrigger();
          },
          get 'aria-controls'() {
            return popupId();
          },
        },
        elementProps,
        getButtonProps,
      ],
      stateAttributesMapping,
    }),
  );

  return (
    <>
      <Show when={hasFocusGuards()}>
        <FocusGuard
          ref={(el: HTMLElement) => {
            store.context.beforeTriggerFocusGuardRef.current = el;
          }}
          onFocus={handlePreFocusGuardFocus}
        />
      </Show>
      {element}
      <Show when={hasFocusGuards()}>
        <FocusGuard
          ref={(el: HTMLElement) => {
            store.context.triggerFocusTargetRef.current = el;
          }}
          onFocus={handleFocusTargetFocus}
        />
      </Show>
    </>
  );
}

export interface PopoverTriggerState {
  /**
   * Whether the trigger is currently disabled.
   */
  disabled: boolean;
  /**
   * Whether the popover is currently open and was opened by this trigger.
   */
  open: boolean;
}

export type PopoverTriggerProps<Payload = unknown> = NativeButtonProps &
  BaseUIComponentProps<'button', PopoverTriggerState> & {
    /**
     * Whether the component renders a native `<button>` element when replacing it
     * via the `render` prop.
     * Set to `false` if the rendered element is not a button (e.g. `<div>`).
     * @default true
     */
    nativeButton?: boolean | undefined;
    /**
     * A handle to associate the trigger with a popover.
     */
    handle?: PopoverHandle<Payload> | undefined;
    /**
     * A payload to pass to the popover when it is opened.
     */
    payload?: Payload | undefined;
    /**
     * ID of the trigger. In addition to being forwarded to the rendered element,
     * it is also used to specify the active trigger for the popover in controlled mode (with the PopoverRoot `triggerId` prop).
     */
    id?: string | undefined;
    /**
     * Whether the popover should also open when the trigger is hovered.
     * @default false
     */
    openOnHover?: boolean | undefined;
    /**
     * How long to wait before the popover may be opened on hover. Specified in milliseconds.
     *
     * Requires the `openOnHover` prop.
     * @default 300
     */
    delay?: number | undefined;
    /**
     * How long to wait before closing the popover that was opened on hover.
     * Specified in milliseconds.
     *
     * Requires the `openOnHover` prop.
     * @default 0
     */
    closeDelay?: number | undefined;
  };

export namespace PopoverTrigger {
  export type State = PopoverTriggerState;
  export type Props<Payload = unknown> = PopoverTriggerProps<Payload>;
}
