import { createSignal, omit } from 'solid-js';
import type { BaseUIComponentProps, NativeButtonProps } from '../../internals/types';
import { useToastRootContext } from '../root/ToastRootContext';
import { useToastProviderContext } from '../provider/ToastProviderContext';
import { useButton } from '../../internals/use-button';
import { useRenderElement } from '../../internals/useRenderElement';
import { ownedProps } from '../../internals/ownedProps';

/**
 * Closes the toast when clicked.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Toast](https://base-ui.com/react/components/toast)
 */
export function ToastClose(componentProps: ToastClose.Props) {
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

  const store = useToastProviderContext();
  const root = useToastRootContext();

  const [hasFocus, setHasFocus] = createSignal(false);

  const { getButtonProps, buttonRef } = useButton({
    get disabled() {
      return componentProps.disabled ?? false;
    },
    get native() {
      return componentProps.nativeButton ?? true;
    },
  });

  const state = (): ToastCloseState => ({
    type: root.toast.type,
  });

  return useRenderElement('button', componentProps, {
    ref: buttonRef,
    state,
    props: [
      {
        get 'aria-hidden'() {
          return !root.expanded && !hasFocus();
        },
        onClick() {
          store.closeToast(root.toast.id);
        },
        onFocus() {
          setHasFocus(true);
        },
        onBlur() {
          setHasFocus(false);
        },
      },
      elementProps,
      getButtonProps,
    ],
  });
}

export interface ToastCloseState {
  /**
   * The type of the toast.
   */
  type: string | undefined;
}

export interface ToastCloseProps
  extends NativeButtonProps, BaseUIComponentProps<'button', ToastCloseState> {}

export namespace ToastClose {
  export type State = ToastCloseState;
  export type Props = ToastCloseProps;
}
