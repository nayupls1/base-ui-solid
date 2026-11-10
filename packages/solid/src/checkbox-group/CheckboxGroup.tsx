import { createEffect, omit, untrack } from 'solid-js';
import { useControlled } from 'base-ui-solidjs-utils/useControlled';
import { EMPTY_ARRAY } from 'base-ui-solidjs-utils/empty';
import { areArraysEqual } from 'base-ui-solidjs-utils/areArraysEqual';
import type { RefObject } from 'base-ui-solidjs-utils/types';
import { useBaseUiId } from '../internals/useBaseUiId';
import { useRenderElement } from '../internals/useRenderElement';
import { CheckboxGroupContext } from './CheckboxGroupContext';
import type { FieldRootState } from '../field/root/FieldRoot';
import { isEligibleInput } from '../field/root/useFieldValidation';
import { useFieldRootContext } from '../internals/field-root-context/FieldRootContext';
import { useRegisterFieldControl } from '../internals/field-register-control/useRegisterFieldControl';
import { useLabelableContext } from '../internals/labelable-provider/LabelableContext';
import { useLabelableId } from '../internals/labelable-provider/useLabelableId';
import type { BaseUIComponentProps } from '../internals/types';
import { fieldValidityMapping } from '../internals/field-constants/constants';
import { useCheckboxGroupParent } from './useCheckboxGroupParent';
import type { BaseUIChangeEventDetails } from '../internals/createBaseUIEventDetails';
import type { REASONS } from '../internals/reasons';
import { useFormContext } from '../internals/form-context/FormContext';
import { useValueChanged } from '../internals/useValueChanged';
import { ownedProps } from '../internals/ownedProps';

/**
 * Provides a shared state to a series of checkboxes.
 *
 * Documentation: [Base UI Checkbox Group](https://base-ui.com/react/components/checkbox-group)
 */
export function CheckboxGroup(componentProps: CheckboxGroup.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(
    componentProps,
    'allValues',
    'class',
    'defaultValue',
    'disabled',
    'id',
    'onValueChange',
    'render',
    'value',
    'style',
    'children',
    'ref',
  );

  const field = useFieldRootContext();
  const validation = field.validation;
  const labelable = useLabelableContext();
  const formContext = useFormContext();

  const disabled = () => Boolean(field.disabled || (componentProps.disabled ?? false));

  const [value, setValueUnwrapped] = useControlled<string[]>({
    controlled: () => componentProps.value,
    default: () => componentProps.defaultValue ?? (EMPTY_ARRAY as string[]),
    name: 'CheckboxGroup',
    state: 'value',
  });

  const setValue = (v: string[], eventDetails: CheckboxGroup.ChangeEventDetails) => {
    componentProps.onValueChange?.(v, eventDetails);

    if (eventDetails.isCanceled) {
      return;
    }

    setValueUnwrapped(v);
  };

  const parent = useCheckboxGroupParent({
    get allValues() {
      return componentProps.allValues;
    },
    get value() {
      return value();
    },
    onValueChange: setValue,
  });

  useLabelableId({ id: null });

  const id = useBaseUiId(() => componentProps.id);

  const controlRef: RefObject<HTMLElement | null> = {
    get current() {
      return validation.getInputControl();
    },
    set current(_value) {},
  };

  const getFormValue = () => {
    const formElement = formContext.elementRef.current;
    const currentValue = value();
    if (!formElement) {
      return currentValue;
    }

    const successfulValues = new Set<string>();
    for (const [input, registration] of validation.registeredInputs) {
      if (
        registration.value !== undefined &&
        input.checked &&
        isEligibleInput(input, formElement)
      ) {
        successfulValues.add(registration.value);
      }
    }

    return currentValue.filter((inputValue) => successfulValues.has(inputValue));
  };

  useRegisterFieldControl(
    controlRef,
    id,
    value,
    getFormValue,
    () => !!field.name && !disabled(),
    () => field.name,
  );

  createEffect(value, (currentValue) => {
    field.setFilled(currentValue.length > 0);
  });

  useValueChanged(value, () => {
    if (field.name) {
      formContext.clearErrors(field.name);
    }

    const initialValue = Array.isArray(field.validityData.initialValue)
      ? (field.validityData.initialValue as readonly string[])
      : EMPTY_ARRAY;

    field.setDirty(!areArraysEqual(value(), initialValue as string[]));

    validation.change(value());
  });

  const state = (): CheckboxGroupState => ({
    ...field.state,
    disabled: disabled(),
  });

  const contextValue: CheckboxGroupContext = {
    get allValues() {
      return componentProps.allValues;
    },
    get value() {
      return value();
    },
    setValue,
    parent,
    get disabled() {
      return disabled();
    },
    validation,
    registerControlId: labelable.registerControlId,
  };

  return (
    <CheckboxGroupContext value={contextValue}>
      {untrack(() =>
        useRenderElement('div', componentProps, {
          state,
          props: [
            {
              get id() {
                return componentProps.id;
              },
              role: 'group',
              get 'aria-labelledby'() {
                return labelable.labelId;
              },
            },
            elementProps,
            labelable.getDescriptionProps,
          ],
          stateAttributesMapping: fieldValidityMapping,
        }),
      )}
    </CheckboxGroupContext>
  );
}


export interface CheckboxGroupState extends FieldRootState {
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
}

export interface CheckboxGroupProps extends BaseUIComponentProps<'div', CheckboxGroupState> {
  /**
   * Names of the checkboxes in the group that should be ticked.
   *
   * To render an uncontrolled checkbox group, use the `defaultValue` prop instead.
   */
  value?: string[] | undefined;
  /**
   * Names of the checkboxes in the group that should be initially ticked.
   *
   * To render a controlled checkbox group, use the `value` prop instead.
   */
  defaultValue?: string[] | undefined;
  /**
   * Event handler called when a checkbox in the group is ticked or unticked.
   * Provides the new value as an argument.
   */
  onValueChange?:
    | ((value: string[], eventDetails: CheckboxGroupChangeEventDetails) => void)
    | undefined;
  /**
   * Names of all checkboxes in the group. Use this when creating a parent checkbox.
   */
  allValues?: string[] | undefined;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
}

export type CheckboxGroupChangeEventReason = typeof REASONS.none;
export type CheckboxGroupChangeEventDetails =
  BaseUIChangeEventDetails<CheckboxGroup.ChangeEventReason>;

export namespace CheckboxGroup {
  export type State = CheckboxGroupState;
  export type Props = CheckboxGroupProps;
  export type ChangeEventReason = CheckboxGroupChangeEventReason;
  export type ChangeEventDetails = CheckboxGroupChangeEventDetails;
}
