import { createContext, useContext } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { OTPFieldRoot, OTPFieldRootState } from './OTPFieldRoot';
import type { OTPFieldInputState } from '../input/OTPFieldInput';

/** Reactive values are getters. */
export interface OTPFieldRootContext {
  activeIndex: number;
  autoComplete: string | undefined;
  disabled: boolean;
  form: string | undefined;
  focusInput: (index: number) => void;
  queueFocusInput: (index: number, value: string) => void;
  getInputId: (index: number) => string | undefined;
  handleInputBlur: (event: FocusEvent) => void;
  handleInputFocus: (index: number, event: FocusEvent) => void;
  inputMode: JSX.HTMLAttributes<HTMLInputElement>['inputmode'];
  inputAriaLabelledBy: string | undefined;
  invalid: boolean | undefined;
  length: number;
  mask: boolean;
  pattern: string | undefined;
  reportValueInvalid: (value: string, details: OTPFieldRoot.InvalidEventDetails) => void;
  readOnly: boolean;
  required: boolean;
  normalizeValue: ((value: string) => string) | undefined;
  setFocused: (value: boolean | ((prev: boolean) => boolean)) => void;
  setValue: (value: string, details: OTPFieldRoot.ChangeEventDetails) => string | null;
  state: OTPFieldRootState;
  validationType: OTPFieldRoot.ValidationType;
  value: string;
}

export const OTPFieldRootContext = createContext<OTPFieldRootContext | null>(null);

export function useOTPFieldRootContext() {
  const context = useContext(OTPFieldRootContext);

  if (context == null) {
    throw new Error(
      'Base UI: OTPFieldRootContext is missing. OTPField parts must be placed within <OTPField.Root>.',
    );
  }

  return context ?? undefined;
}

export function getOTPFieldInputState(
  state: OTPFieldRootState,
  value: string,
  index: number,
): OTPFieldInputState {
  return {
    ...state,
    value,
    index,
    filled: value !== '',
  };
}
