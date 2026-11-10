import { omit, onCleanup } from 'solid-js';
import { useControlled } from '@base-ui-solid/utils/useControlled';
import { createSyncSignal } from '@base-ui-solid/utils/createSyncSignal';
import { contains } from '@base-ui-solid/utils/shadowDom';
import type { RefObject } from '@base-ui-solid/utils/types';
import type { BaseUIComponentProps, HTMLProps } from '../internals/types';
import { useBaseUiId } from '../internals/useBaseUiId';
import { SHIFT } from '../internals/composite/composite';
import { CompositeRoot } from '../internals/composite/root/CompositeRoot';
import { useFieldRootContext } from '../internals/field-root-context/FieldRootContext';
import { useRegisterFieldControl } from '../internals/field-register-control/useRegisterFieldControl';
import { fieldValidityMapping } from '../internals/field-constants/constants';
import type { FieldRootState } from '../field/root/FieldRoot';
import { isEligibleInput } from '../field/root/useFieldValidation';
import { useFieldsetRootContext } from '../fieldset/root/FieldsetRootContext';
import { useFormContext } from '../internals/form-context/FormContext';
import { useLabelableContext } from '../internals/labelable-provider/LabelableContext';
import { useValueChanged } from '../internals/useValueChanged';
import { RadioGroupContext } from './RadioGroupContext';
import type { BaseUIChangeEventDetails } from '../internals/createBaseUIEventDetails';
import type { REASONS } from '../internals/reasons';
import { assignRefs, type RefInput } from '../internals/useRenderElement';
import { ownedProps } from '../internals/ownedProps';

const MODIFIER_KEYS = [SHIFT];

/**
 * Provides shared state to a series of radio buttons.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Radio Group](https://base-ui.com/react/components/radio-group)
 */
export function RadioGroup<Value>(componentProps: RadioGroup.Props<Value>) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'disabled',
    'readOnly',
    'required',
    'onValueChange',
    'value',
    'defaultValue',
    'form',
    'name',
    'inputRef',
    'id',
    'style',
    'children',
    'ref',
  );

  const field = useFieldRootContext();
  const validation = field.validation;
  const labelable = useLabelableContext();
  const formContext = useFormContext();
  const fieldsetContext = useFieldsetRootContext(true);

  const disabled = () => field.disabled || componentProps.disabled;
  const name = () => field.name ?? componentProps.name;
  const id = useBaseUiId(() => componentProps.id);

  const [checkedValue, setCheckedValueUnwrapped] = useControlled<Value | undefined>({
    controlled: () => componentProps.value,
    default: () => componentProps.defaultValue,
    name: 'RadioGroup',
    state: 'value',
  });
  const [touched, setTouched] = createSyncSignal(false);

  const setCheckedValue = (value: Value, eventDetails: RadioGroup.ChangeEventDetails) => {
    componentProps.onValueChange?.(value, eventDetails);

    if (eventDetails.isCanceled) {
      return;
    }

    setCheckedValueUnwrapped(value);
  };

  const controlRef: RefObject<HTMLElement | null> = {
    get current() {
      return validation.getInputControl();
    },
    set current(_value) {},
  };

  let groupInput: HTMLInputElement | null = null;
  let firstEnabledInput: HTMLInputElement | null = null;

  const setInputRef = (hiddenInput: HTMLInputElement | null) => {
    if (groupInput === hiddenInput) {
      return;
    }
    groupInput = hiddenInput;
    assignRefs(componentProps.inputRef as RefInput<HTMLInputElement | null>, hiddenInput);
  };

  const registerInputRef = (input: HTMLInputElement | null) => {
    if (!input) {
      return undefined;
    }

    if (!input.disabled) {
      if (!firstEnabledInput) {
        firstEnabledInput = input;
      }

      const currentInput = groupInput;
      if (input.checked || currentInput == null || currentInput.disabled) {
        setInputRef(input);
      }
    }

    return () => {
      if (firstEnabledInput === input) {
        firstEnabledInput = null;
      }
      if (groupInput === input) {
        setInputRef(null);
      }
    };
  };

  const getFormValue = () => {
    const formElement = formContext.elementRef.current;
    if (!formElement) {
      return checkedValue() ?? null;
    }

    for (const input of validation.registeredInputs.keys()) {
      if (input.checked && isEligibleInput(input, formElement)) {
        return checkedValue() ?? null;
      }
    }

    return null;
  };

  useRegisterFieldControl(
    controlRef,
    id,
    () => checkedValue() ?? null,
    getFormValue,
    () => !disabled(),
    () => componentProps.name,
  );

  useValueChanged(checkedValue, () => {
    const value = checkedValue();
    formContext.clearErrors(name());

    field.setDirty(value !== field.validityData.initialValue);
    field.setFilled(value != null);

    validation.change(value);

    const fallbackInput = firstEnabledInput;
    if (value == null && fallbackInput && !fallbackInput.disabled) {
      setInputRef(fallbackInput);
    }
  });

  const ariaLabelledby = () => labelable.labelId ?? fieldsetContext?.legendId;

  const state = (): RadioGroupState => ({
    ...field.state,
    disabled: disabled() ?? false,
    required: componentProps.required ?? false,
    readOnly: componentProps.readOnly ?? false,
  });

  const contextValue: RadioGroupContext<Value> = {
    get checkedValue() {
      return checkedValue();
    },
    get disabled() {
      return disabled();
    },
    get form() {
      return componentProps.form;
    },
    validation,
    get name() {
      return name();
    },
    get readOnly() {
      return componentProps.readOnly;
    },
    registerInputRef,
    get required() {
      return componentProps.required;
    },
    setCheckedValue,
    setTouched: (value) => {
      setTouched(value);
    },
    get touched() {
      return touched();
    },
  };

  const defaultProps: HTMLProps = {
    get id() {
      return componentProps.id;
    },
    role: 'radiogroup',
    get 'aria-required'() {
      return componentProps.required || undefined;
    },
    get 'aria-disabled'() {
      return disabled() || undefined;
    },
    get 'aria-readonly'() {
      return componentProps.readOnly || undefined;
    },
    get 'aria-labelledby'() {
      return ariaLabelledby();
    },
    onFocusOut(event: FocusEvent) {
      if (!contains(event.currentTarget as Element, event.relatedTarget as Element)) {
        setTouched(false);
        field.setTouched(true);
        field.setFocused(false);

        if (field.validationMode === 'onBlur') {
          validation.commit(checkedValue());
        }
      }
    },
  };

  const handleKeyDownCapture = (event: KeyboardEvent) => {
    if (event.key.startsWith('Arrow')) {
      setTouched(true);
    }
  };

  let capturedElement: HTMLElement | null = null;
  const captureRef = (element: HTMLElement | null) => {
    capturedElement?.removeEventListener('keydown', handleKeyDownCapture, true);
    capturedElement = element;
    element?.addEventListener('keydown', handleKeyDownCapture, true);
  };
  onCleanup(() => {
    capturedElement?.removeEventListener('keydown', handleKeyDownCapture, true);
  });

  return (
    <RadioGroupContext value={contextValue}>
      <CompositeRoot
        render={componentProps.render}
        class={componentProps.class}
        style={componentProps.style}
        state={state()}
        props={[
          defaultProps,
          elementProps,
          (props: HTMLProps) => validation.getValidationProps(disabled() ?? false, props),
        ]}
        refs={[captureRef, componentProps.ref]}
        stateAttributesMapping={fieldValidityMapping}
        enableHomeAndEndKeys={false}
        modifierKeys={MODIFIER_KEYS}
      >
        {componentProps.children}
      </CompositeRoot>
    </RadioGroupContext>
  );
}


export interface RadioGroupState extends FieldRootState {
  /**
   * Whether the user should be unable to select a different radio button in the group.
   */
  readOnly: boolean;
  /**
   * Whether the user must tick a radio button within the group before submitting a form.
   */
  required: boolean;
}

export interface RadioGroupProps<Value = any> extends Omit<
  BaseUIComponentProps<'div', RadioGroupState>,
  'value'
> {
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Whether the user should be unable to select a different radio button in the group.
   * @default false
   */
  readOnly?: boolean | undefined;
  /**
   * Whether the user must choose a value before submitting a form.
   * @default false
   */
  required?: boolean | undefined;
  /**
   * Identifies the field when a form is submitted.
   */
  name?: string | undefined;
  /**
   * Identifies the form that owns the radio inputs.
   * Useful when the radio group is rendered outside the form.
   */
  form?: string | undefined;
  /**
   * The controlled value of the radio item that should be currently selected.
   *
   * To render an uncontrolled radio group, use the `defaultValue` prop instead.
   */
  value?: Value | undefined;
  /**
   * The uncontrolled value of the radio button that should be initially selected.
   *
   * To render a controlled radio group, use the `value` prop instead.
   */
  defaultValue?: Value | undefined;
  /**
   * Callback fired when the value changes.
   */
  onValueChange?: ((value: Value, eventDetails: RadioGroup.ChangeEventDetails) => void) | undefined;
  /**
   * A ref to access the hidden input element.
   */
  inputRef?: RefInput<HTMLInputElement> | undefined;
}

export type RadioGroupChangeEventReason = typeof REASONS.none;

export type RadioGroupChangeEventDetails = BaseUIChangeEventDetails<RadioGroup.ChangeEventReason>;

export namespace RadioGroup {
  export type State = RadioGroupState;
  export type Props<TValue = any> = RadioGroupProps<TValue>;
  export type ChangeEventReason = RadioGroupChangeEventReason;
  export type ChangeEventDetails = RadioGroupChangeEventDetails;
}
