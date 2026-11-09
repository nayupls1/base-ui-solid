import { createMemo, omit } from 'solid-js';
import { useDialogRootContext } from '../root/DialogRootContext';
import { useRenderElement } from '../../internals/useRenderElement';
import type { BaseUIComponentProps, NativeButtonProps } from '../../internals/types';
import { useButton } from '../../internals/use-button';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { ownedProps } from '../../internals/ownedProps';

/**
 * A button that closes the dialog.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Dialog](https://base-ui.com/react/components/dialog)
 */
export function DialogClose(componentProps: DialogClose.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'style',
    'disabled',
    'nativeButton',
    'children',
    'ref',
  );
  const disabled = () => componentProps.disabled ?? false;

  const store = useDialogRootContext();

  const { getButtonProps, buttonRef } = useButton({
    get disabled() {
      return disabled();
    },
    get native() {
      return componentProps.nativeButton ?? true;
    },
  });

  const state = createMemo<DialogCloseState>(() => ({ disabled: disabled() }));

  function handleClick(event: MouseEvent) {
    if (store.select('open')) {
      store.setOpen(false, createChangeEventDetails(REASONS.closePress, event));
    }
  }

  return useRenderElement('button', componentProps, {
    state,
    ref: buttonRef,
    props: [{ onClick: handleClick }, elementProps, getButtonProps],
  });
}

export interface DialogCloseProps
  extends NativeButtonProps, BaseUIComponentProps<'button', DialogCloseState> {}

export interface DialogCloseState {
  /**
   * Whether the button is currently disabled.
   */
  disabled: boolean;
}

export namespace DialogClose {
  export type Props = DialogCloseProps;
  export type State = DialogCloseState;
}
