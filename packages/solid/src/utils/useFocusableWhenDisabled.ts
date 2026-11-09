import type { HTMLProps } from '../internals/types';

/**
 * Parameters are read lazily, so they can be getters.
 * Returns a props object with getters.
 */
export function useFocusableWhenDisabled(
  parameters: UseFocusableWhenDisabledParameters,
): UseFocusableWhenDisabledReturnValue {
  const tabIndexProp = () => parameters.tabIndex ?? 0;
  const composite = () => parameters.composite ?? false;
  const isFocusableComposite = () => composite() && parameters.focusableWhenDisabled !== false;
  const isNonFocusableComposite = () => composite() && parameters.focusableWhenDisabled === false;

  const props: FocusableWhenDisabledProps = {
    onKeyDown(event: KeyboardEvent) {
      if (parameters.disabled && parameters.focusableWhenDisabled && event.key !== 'Tab') {
        event.preventDefault();
      }
    },
    get tabindex() {
      if (composite()) {
        return undefined;
      }
      if (!parameters.isNativeButton && parameters.disabled) {
        return parameters.focusableWhenDisabled ? tabIndexProp() : -1;
      }
      return tabIndexProp();
    },
    get 'aria-disabled'() {
      const { isNativeButton, focusableWhenDisabled, disabled } = parameters;
      if (
        (isNativeButton && (focusableWhenDisabled || isFocusableComposite())) ||
        (!isNativeButton && disabled)
      ) {
        return disabled;
      }
      return undefined;
    },
    get disabled() {
      if (
        parameters.isNativeButton &&
        (!parameters.focusableWhenDisabled || isNonFocusableComposite())
      ) {
        return parameters.disabled;
      }
      return undefined;
    },
  };

  return { props };
}

interface FocusableWhenDisabledProps extends HTMLProps {
  'aria-disabled'?: boolean | undefined;
  disabled?: boolean | undefined;
  onKeyDown: (event: KeyboardEvent) => void;
  tabindex: number | undefined;
}

export interface UseFocusableWhenDisabledParameters {
  /**
   * Whether the component should be focusable when disabled.
   * When `undefined`, composite items are focusable when disabled by default.
   */
  focusableWhenDisabled?: boolean | undefined;
  /**
   * The disabled state of the component.
   */
  disabled: boolean;
  /**
   * Whether this is a composite item or not.
   * @default false
   */
  composite?: boolean | undefined;
  /**
   * @default 0
   */
  tabIndex?: number | undefined;
  /**
   * @default true
   */
  isNativeButton: boolean;
}

export interface UseFocusableWhenDisabledReturnValue {
  props: FocusableWhenDisabledProps;
}

export interface UseFocusableWhenDisabledState {}
