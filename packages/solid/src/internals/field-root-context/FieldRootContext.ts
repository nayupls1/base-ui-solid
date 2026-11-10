import { createContext, useContext } from 'solid-js';
import type { RefObject } from 'base-ui-solidjs-utils/types';
import { EMPTY_OBJECT } from 'base-ui-solidjs-utils/empty';
import { NOOP } from '../noop';
import { DEFAULT_FIELD_ROOT_STATE, DEFAULT_VALIDITY_STATE } from '../field-constants/constants';
import type { FieldValidityData, FieldRootState } from '../../field/root/FieldRoot';
import type { Form } from '../../form';
import type { UseFieldValidationReturnValue } from '../../field/root/useFieldValidation';
import type { HTMLProps } from '../types';
import type { FieldControlRegistration } from '../field-register-control/useFieldControlRegistration';

type SetStateAction<T> = T | ((prev: T) => T);

/**
 * Reactive values are exposed as getters, so read them lazily.
 */
export interface FieldRootContext {
  readonly invalid: boolean | undefined;
  readonly name: string | undefined;
  readonly validityData: FieldValidityData;
  setValidityData: (value: SetStateAction<FieldValidityData>) => void;
  readonly disabled: boolean | undefined;
  setTouched: (value: SetStateAction<boolean>) => void;
  setDirty: (value: SetStateAction<boolean>) => void;
  setFilled: (value: SetStateAction<boolean>) => void;
  setFocused: (value: SetStateAction<boolean>) => void;
  /**
   * Identifies the control the focused state belongs to, so that disabling or unmounting a
   * different control in the same field can't clear it. Written through `useSetFieldFocused`.
   */
  focusOwnerRef: RefObject<unknown>;
  readonly validationMode: Form.ValidationMode;
  shouldValidateOnChange: () => boolean;
  readonly state: FieldRootState;
  registerFieldControl: (
    source: symbol,
    registration: FieldControlRegistration | undefined,
  ) => void;
  validation: UseFieldValidationReturnValue;
}

export const DEFAULT_FIELD_ROOT_CONTEXT: FieldRootContext = {
  invalid: undefined,
  name: undefined,
  validityData: {
    state: DEFAULT_VALIDITY_STATE,
    errors: [],
    error: '',
    value: '',
    initialValue: null,
  },
  setValidityData: NOOP,
  disabled: undefined,
  setTouched: NOOP,
  setDirty: NOOP,
  setFilled: NOOP,
  setFocused: NOOP,
  focusOwnerRef: { current: undefined },
  validationMode: 'onSubmit',
  shouldValidateOnChange: () => false,
  state: DEFAULT_FIELD_ROOT_STATE,
  registerFieldControl: NOOP,
  validation: {
    getValidationProps: (_disabled: boolean, props: HTMLProps = EMPTY_OBJECT) => props,
    inputRef: { current: null },
    registeredInputs: new Map(),
    registerInput: NOOP,
    getInputControl: () => null,
    commit: async () => {},
    change: NOOP,
  },
};

export const FieldRootContext = createContext<FieldRootContext>(DEFAULT_FIELD_ROOT_CONTEXT);

export function useFieldRootContext(optional = true) {
  const context = useContext(FieldRootContext);

  if (context.setValidityData === NOOP && !optional) {
    throw new Error(
      'Base UI: FieldRootContext is missing. Field parts must be placed within <Field.Root>.',
    );
  }

  return context;
}
