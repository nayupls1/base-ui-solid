import { omit } from 'solid-js';
import { useButton } from '../internals/use-button/useButton';
import { useRenderElement } from '../internals/useRenderElement';
import type { BaseUIComponentProps, NativeButtonProps } from '../internals/types';

/**
 * A button component that can be used to trigger actions.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Button](https://base-ui.com/react/components/button)
 */
export function Button(componentProps: Button.Props) {
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'disabled',
    'focusableWhenDisabled',
    'nativeButton',
    'style',
    'children',
    'ref',
  );

  const { getButtonProps, buttonRef } = useButton({
    get disabled() {
      return componentProps.disabled ?? false;
    },
    get focusableWhenDisabled() {
      return componentProps.focusableWhenDisabled ?? false;
    },
    get native() {
      return componentProps.nativeButton ?? true;
    },
  });

  const state = (): ButtonState => ({
    disabled: componentProps.disabled ?? false,
  });

  return useRenderElement('button', componentProps, {
    state,
    ref: buttonRef,
    props: [elementProps, getButtonProps],
  });
}

export interface ButtonState {
  /**
   * Whether the button should ignore user interaction.
   */
  disabled: boolean;
}

export interface ButtonProps
  extends NativeButtonProps, BaseUIComponentProps<'button', ButtonState> {
  /**
   * Whether the button should be focusable when disabled.
   * @default false
   */
  focusableWhenDisabled?: boolean | undefined;
}

export namespace Button {
  export type State = ButtonState;
  export type Props = ButtonProps;
}
