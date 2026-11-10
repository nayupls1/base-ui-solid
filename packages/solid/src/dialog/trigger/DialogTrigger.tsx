import { createMemo, omit, untrack } from 'solid-js';
import { createSyncSignal } from '@base-ui-solid/utils/createSyncSignal';
import { useDialogRootContext } from '../root/DialogRootContext';
import { useButton } from '../../internals/use-button/useButton';
import { useRenderElement } from '../../internals/useRenderElement';
import type { BaseUIComponentProps, NativeButtonProps } from '../../internals/types';
import { triggerOpenStateMapping } from '../../utils/popups/popupStateMapping';
import { CLICK_TRIGGER_IDENTIFIER } from '../../internals/constants';
import type { DialogHandle } from '../store/DialogHandle';
import { usePopupHandleStore } from '../../utils/popups/usePopupHandleStore';
import { useTriggerDataForwarding } from '../../utils/popups/popupStoreUtils';
import { useBaseUiId } from '../../internals/useBaseUiId';
import { useClick } from '../../utils/popups/interactions/useClick';
import { useOpenMethodTriggerProps } from '../../utils/popups/interactions/useOpenInteractionType';
import { mergeProps } from '../../merge-props';
import { ownedProps } from '../../internals/ownedProps';

/**
 * A button that opens the dialog.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Dialog](https://base-ui.com/react/components/dialog)
 */
export function DialogTrigger<Payload = unknown>(componentProps: DialogTrigger.Props<Payload>) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'style',
    'disabled',
    'nativeButton',
    'id',
    'payload',
    'handle',
    'children',
    'ref',
  );

  const disabled = () => componentProps.disabled ?? false;

  const dialogRootStore = useDialogRootContext(true);
  const handleStore = usePopupHandleStore(untrack(() => componentProps.handle) as any);
  const store = (handleStore ?? dialogRootStore) as NonNullable<typeof dialogRootStore>;
  if (!store) {
    throw new Error(
      'Base UI: <Dialog.Trigger> must be used within <Dialog.Root> or provided with a handle.',
    );
  }

  const thisTriggerId = useBaseUiId(() => componentProps.id);
  const isOpenedByThisTrigger = store.useState('isOpenedByTrigger', thisTriggerId);
  const popupId = store.useState('triggerPopupId', thisTriggerId);

  const [triggerElement, setTriggerElement] = createSyncSignal<HTMLElement | null>(null);

  const { registerTrigger, isMountedByThisTrigger } = useTriggerDataForwarding(
    thisTriggerId,
    triggerElement,
    store,
    () => ({
      payload: componentProps.payload,
    }),
  );

  const { getButtonProps, buttonRef } = useButton({
    get disabled() {
      return disabled();
    },
    get native() {
      return componentProps.nativeButton ?? true;
    },
  });

  const click = useClick(store);
  const interactionTypeProps = useOpenMethodTriggerProps(
    () => store.select('open'),
    (interactionType) => {
      store.set('openMethod', interactionType);
    },
  );

  const state = createMemo<DialogTriggerState>(() => ({
    disabled: disabled(),
    open: isOpenedByThisTrigger(),
  }));

  const rootTriggerProps = store.useState('triggerProps', isMountedByThisTrigger);

  return useRenderElement('button', componentProps, {
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
    stateAttributesMapping: triggerOpenStateMapping,
  });
}

export interface DialogTriggerProps<Payload = unknown>
  extends NativeButtonProps, BaseUIComponentProps<'button', DialogTriggerState> {
  /**
   * A handle to associate the trigger with a dialog.
   * Can be created with the Dialog.createHandle() method.
   */
  handle?: DialogHandle<Payload> | undefined;
  /**
   * A payload to pass to the dialog when it is opened.
   */
  payload?: Payload | undefined;
  /**
   * ID of the trigger. In addition to being forwarded to the rendered element,
   * it is also used to specify the active trigger for the dialog in controlled mode (with the DialogRoot `triggerId` prop).
   */
  id?: string | undefined;
}

export interface DialogTriggerState {
  /**
   * Whether the trigger is currently disabled.
   */
  disabled: boolean;
  /**
   * Whether the dialog is currently open and was opened by this trigger.
   */
  open: boolean;
}

export namespace DialogTrigger {
  export type Props<Payload = unknown> = DialogTriggerProps<Payload>;
  export type State = DialogTriggerState;
}
