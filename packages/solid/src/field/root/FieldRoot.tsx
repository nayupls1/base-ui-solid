import { createEffect, createMemo, omit, untrack } from 'solid-js';
import { createSyncSignal } from '@base-ui-solid/utils/createSyncSignal';
import { FieldRootContext } from '../../internals/field-root-context/FieldRootContext';
import {
  DEFAULT_VALIDITY_STATE,
  fieldValidityMapping,
} from '../../internals/field-constants/constants';
import { useFieldsetRootContext } from '../../fieldset/root/FieldsetRootContext';
import type { Form } from '../../form';
import { useFormContext } from '../../internals/form-context/FormContext';
import { LabelableProvider } from '../../internals/labelable-provider';
import type { BaseUIComponentProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useFieldValidation } from './useFieldValidation';
import { useFieldControlRegistration } from '../../internals/field-register-control/useFieldControlRegistration';
import { assignRefs, type RefInput } from '../../internals/useRenderElement';
import { ownedProps } from '../../internals/ownedProps';

type SetStateAction<T> = T | ((prev: T) => T);

/**
 * @internal
 */
function FieldRootInner(componentProps: FieldRoot.Props) {
  componentProps = ownedProps(componentProps);
  const formContext = useFormContext();
  const { submitCountRef } = formContext;

  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'validate',
    'validationDebounceTime',
    'validationMode',
    'name',
    'disabled',
    'invalid',
    'dirty',
    'touched',
    'actionsRef',
    'style',
    'children',
    'ref',
  );

  const validationMode = () => componentProps.validationMode ?? formContext.validationMode;
  const fieldsetContext = useFieldsetRootContext(true);

  const validate = (value: unknown, formValues: Form.Values) =>
    (componentProps.validate || (() => null))(value, formValues);

  const disabled = () => Boolean(fieldsetContext?.disabled || (componentProps.disabled ?? false));

  const [touchedState, setTouchedUnwrapped] = createSyncSignal(false);
  const [dirtyState, setDirtyUnwrapped] = createSyncSignal(false);
  const [filled, setFilled] = createSyncSignal(false);
  const [focused, setFocused] = createSyncSignal(false);
  const focusOwnerRef = { current: undefined as unknown };

  const dirty = () => componentProps.dirty ?? dirtyState();
  const touched = () => componentProps.touched ?? touchedState();

  const markedDirtyRef = { current: untrack(dirty) };
  const registeredFieldIdRef = { current: undefined as string | undefined };
  const [registeredFieldName, setRegisteredFieldName] = createSyncSignal<string | undefined>(
    undefined,
  );
  const effectiveName = () => componentProps.name ?? registeredFieldName();

  createEffect(
    () => componentProps.dirty,
    (dirtyProp) => {
      if (dirtyProp !== undefined) {
        markedDirtyRef.current = dirtyProp;
      }
    },
  );

  const setDirty = (value: SetStateAction<boolean>) => {
    if (componentProps.dirty !== undefined) {
      return;
    }

    const next = typeof value === 'function' ? value(dirtyState()) : value;
    if (next) {
      markedDirtyRef.current = true;
    }
    setDirtyUnwrapped(next);
  };

  const setTouched = (value: SetStateAction<boolean>) => {
    if (componentProps.touched !== undefined) {
      return;
    }
    setTouchedUnwrapped(value);
  };

  const shouldValidateOnChange = () =>
    validationMode() === 'onChange' ||
    (validationMode() === 'onSubmit' && submitCountRef.current > 0);

  const invalid = createMemo(() => {
    const name = effectiveName();
    const errors = formContext.errors;
    const formError = name && Object.hasOwn(errors, name) ? errors[name] : null;
    const hasFormError = !!(Array.isArray(formError) ? formError.length : formError);
    return componentProps.invalid === true || hasFormError;
  });

  const [validityData, setValidityDataState] = createSyncSignal<FieldValidityData>({
    state: DEFAULT_VALIDITY_STATE,
    error: '',
    errors: [],
    value: null,
    initialValue: null,
  });
  const setValidityData = (value: SetStateAction<FieldValidityData>) => {
    setValidityDataState(value);
  };

  const valid = () => !invalid() && (disabled() ? null : validityData().state.valid);

  const state = createMemo<FieldRootState>(() => ({
    disabled: disabled(),
    touched: touched(),
    dirty: dirty(),
    valid: valid(),
    filled: filled(),
    focused: focused(),
  }));

  const validation = useFieldValidation({
    setValidityData,
    validate,
    get validityData() {
      return validityData();
    },
    get validationDebounceTime() {
      return componentProps.validationDebounceTime ?? 0;
    },
    get invalid() {
      return invalid();
    },
    markedDirtyRef,
    get state() {
      return state();
    },
    shouldValidateOnChange,
    get validationMode() {
      return validationMode();
    },
    registeredFieldIdRef,
  });

  const [validateFieldControl, registerFieldControl] = useFieldControlRegistration({
    change: validation.change,
    commit: validation.commit,
    get invalid() {
      return invalid();
    },
    markedDirtyRef,
    get name() {
      return componentProps.name;
    },
    setRegisteredFieldName: (name) => {
      setRegisteredFieldName(name);
    },
    registeredFieldIdRef,
    setValidityData,
    get validityData() {
      return validityData();
    },
  });

  createEffect(
    () => componentProps.actionsRef,
    (actionsRef) => {
      assignRefs(actionsRef as RefInput<FieldRoot.Actions>, { validate: validateFieldControl });
    },
  );

  const contextValue: FieldRootContext = {
    get invalid() {
      return invalid();
    },
    get name() {
      return effectiveName();
    },
    get validityData() {
      return validityData();
    },
    setValidityData,
    get disabled() {
      return disabled();
    },
    setTouched,
    setDirty,
    setFilled: (value) => {
      setFilled(value);
    },
    setFocused: (value) => {
      setFocused(value);
    },
    focusOwnerRef,
    get validationMode() {
      return validationMode();
    },
    shouldValidateOnChange,
    get state() {
      return state();
    },
    registerFieldControl,
    validation,
  };

  return (
    <FieldRootContext value={contextValue}>
      {untrack(() =>
        useRenderElement('div', componentProps, {
          state,
          props: elementProps,
          stateAttributesMapping: fieldValidityMapping,
        }),
      )}
    </FieldRootContext>
  );
}


/**
 * Groups all parts of the field.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Field](https://base-ui.com/react/components/field)
 */
export function FieldRoot(componentProps: FieldRoot.Props) {
  componentProps = ownedProps(componentProps);
  return (
    <LabelableProvider>
      <FieldRootInner {...componentProps} />
    </LabelableProvider>
  );
}

export interface FieldValidityData {
  state: {
    badInput: boolean;
    customError: boolean;
    patternMismatch: boolean;
    rangeOverflow: boolean;
    rangeUnderflow: boolean;
    stepMismatch: boolean;
    tooLong: boolean;
    tooShort: boolean;
    typeMismatch: boolean;
    valueMissing: boolean;
    valid: boolean | null;
  };
  error: string;
  errors: string[];
  value: unknown;
  initialValue: unknown;
}

export interface FieldRootActions {
  validate: () => void;
}

export interface FieldRootState {
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Whether the field has been touched.
   */
  touched: boolean;
  /**
   * Whether the field value has changed from its initial value.
   */
  dirty: boolean;
  /**
   * Whether the field is valid.
   */
  valid: boolean | null;
  /**
   * Whether the field has a value.
   */
  filled: boolean;
  /**
   * Whether the field is focused.
   */
  focused: boolean;
}

export interface FieldRootProps extends BaseUIComponentProps<'div', FieldRootState> {
  /**
   * Whether the component should ignore user interaction.
   * Takes precedence over the `disabled` prop on the `<Field.Control>` component.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Identifies the field when a form is submitted.
   * Takes precedence over the `name` prop on the `<Field.Control>` component.
   */
  name?: string | undefined;
  /**
   * A function for custom validation. Return a string or an array of strings with
   * the error message(s) if the value is invalid. Returning nothing, `null`, an empty
   * string, or an empty array means the value is valid.
   * Asynchronous functions are supported, but they do not prevent form submission
   * when using `validationMode="onSubmit"`.
   */
  validate?:
    | ((
        value: unknown,
        formValues: Form.Values,
      ) => string | string[] | null | void | Promise<string | string[] | null | void>)
    | undefined;
  /**
   * Determines when the field should be validated.
   * This takes precedence over the `validationMode` prop on `<Form>`.
   *
   * - `onSubmit`: triggers validation when the form is submitted, and re-validates on change after submission.
   * - `onBlur`: triggers validation when the control loses focus.
   * - `onChange`: triggers validation on every change to the control value.
   *
   * @default 'onSubmit'
   */
  validationMode?: Form.ValidationMode | undefined;
  /**
   * How long to wait between `validate` callbacks if
   * `validationMode="onChange"` is used. Specified in milliseconds.
   * @default 0
   */
  validationDebounceTime?: number | undefined;
  /**
   * Whether the field is invalid.
   * Useful when the field state is controlled by an external library.
   */
  invalid?: boolean | undefined;
  /**
   * Whether the field's value has been changed from its initial value.
   * Useful when the field state is controlled by an external library.
   */
  dirty?: boolean | undefined;
  /**
   * Whether the field has been touched.
   * Useful when the field state is controlled by an external library.
   */
  touched?: boolean | undefined;
  /**
   * A ref to imperative actions.
   * - `validate`: Validates the field when called.
   */
  actionsRef?: RefInput<FieldRoot.Actions | null> | undefined;
}

export namespace FieldRoot {
  export type State = FieldRootState;
  export type Props = FieldRootProps;
  export type Actions = FieldRootActions;
}
