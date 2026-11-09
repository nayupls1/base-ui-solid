import { createEffect, flush, omit, untrack } from 'solid-js';
import { useTimeout } from '@base-ui-solid/utils/useTimeout';
import type { FieldRootState } from '../root/FieldRoot';
import { useFieldRootContext } from '../../internals/field-root-context/FieldRootContext';
import { useSetFieldFocused } from '../../internals/field-root-context/useSetFieldFocused';
import { useRegisterFieldControl } from '../../internals/field-register-control/useRegisterFieldControl';
import { useFormContext } from '../../internals/form-context/FormContext';
import { useLabelableContext } from '../../internals/labelable-provider/LabelableContext';
import { useLabelableId } from '../../internals/labelable-provider/useLabelableId';
import { fieldValidityMapping } from '../../internals/field-constants/constants';
import type { BaseUIComponentProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useValueChanged } from '../../internals/useValueChanged';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import type { BaseUIChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { createSyncSignal } from '@base-ui-solid/utils/createSyncSignal';

/**
 * The form control to label and validate.
 * Renders an `<input>` element.
 *
 * You can omit this part and use any Base UI input component instead. For example,
 * [Input](https://base-ui.com/react/components/input), [Checkbox](https://base-ui.com/react/components/checkbox),
 * or [Select](https://base-ui.com/react/components/select), among others, will work with Field out of the box.
 *
 * Documentation: [Base UI Field](https://base-ui.com/react/components/field)
 */
export function FieldControl(componentProps: FieldControl.Props) {
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'id',
    'name',
    'value',
    'disabled',
    'onValueChange',
    'defaultValue',
    'autofocus',
    'style',
    'children',
    'ref',
  );

  const field = useFieldRootContext();
  const formContext = useFormContext();
  const { clearErrors, elementRef: formElementRef, submitCountRef } = formContext;
  const validation = field.validation;

  const disabled = () => Boolean(field.disabled || (componentProps.disabled ?? false));
  const name = () => field.name ?? componentProps.name;

  const state = (): FieldControlState => ({
    ...field.state,
    disabled: disabled(),
  });

  const labelable = useLabelableContext();

  const id = useLabelableId({
    get id() {
      return componentProps.id;
    },
  });

  const isControlled = untrack(() => componentProps.value !== undefined);
  const serializedValue = () =>
    componentProps.value == null ? undefined : String(componentProps.value);

  const getValueFromInput = () => validation.inputRef.current?.value;

  useRegisterFieldControl(
    validation.inputRef,
    id,
    serializedValue,
    getValueFromInput,
    () => !disabled(),
    () => componentProps.name,
  );

  createEffect(
    () => [serializedValue(), componentProps.defaultValue] as const,
    ([currentSerializedValue]) => {
      const currentValue = currentSerializedValue ?? validation.inputRef.current?.value;
      if (currentValue !== undefined) {
        field.setFilled(currentValue !== '');
      }
    },
  );

  useValueChanged(serializedValue, () => {
    const currentSerializedValue = serializedValue();
    if (currentSerializedValue === undefined) {
      return;
    }

    clearErrors(name());
    field.setDirty(currentSerializedValue !== (field.validityData.initialValue ?? ''));

    validation.change(currentSerializedValue);
  });

  const [inputElement, setInputElement] = createSyncSignal<HTMLElement | null>(null);
  const setFocused = useSetFieldFocused(disabled, inputElement);
  const enterValidationTimeout = useTimeout();

  const initialValue = untrack(() =>
    isControlled ? undefined : (componentProps.defaultValue as string | number | undefined),
  );

  return useRenderElement('input', componentProps, {
    ref: [
      (el: HTMLElement | null) => {
        setInputElement(el);
      },
      (el: HTMLInputElement | null) => {
        validation.inputRef.current = el;
      },
    ],
    state,
    props: [
      {
        get id() {
          return id();
        },
        get disabled() {
          return disabled();
        },
        get name() {
          return name();
        },
        get 'aria-labelledby'() {
          return labelable.labelId;
        },
        get autofocus() {
          return componentProps.autofocus ?? false;
        },
        onInput(event: InputEvent & { currentTarget: HTMLInputElement }) {
          const input = event.currentTarget;
          const inputValue = input.value;
          const details = createChangeEventDetails(REASONS.none, event);
          componentProps.onValueChange?.(inputValue, details);

          if (isControlled) {
            // Emulate a controlled input: if the owner didn't accept the new value,
            // restore the DOM to the controlled value.
            queueMicrotask(() => {
              flush();
              const controlledValue =
                componentProps.value == null ? '' : String(componentProps.value);
              if (input.value !== controlledValue) {
                input.value = controlledValue;
              }
            });
            return;
          }

          field.setDirty(inputValue !== (field.validityData.initialValue ?? ''));
          field.setFilled(inputValue !== '');

          if (!event.defaultPrevented && !details.isCanceled) {
            clearErrors(name());
            validation.change(inputValue);
          }
        },
        onFocus() {
          setFocused(true);
        },
        onBlur(event: FocusEvent & { currentTarget: HTMLInputElement }) {
          field.setTouched(true);
          setFocused(false);

          if (field.validationMode === 'onBlur') {
            const inputValue = event.currentTarget.value;
            validation.commit(inputValue);

            if (isControlled) {
              queueMicrotask(() => {
                const nextValue = validation.inputRef.current?.value;
                if (
                  nextValue !== undefined &&
                  nextValue !== inputValue &&
                  nextValue !== (field.validityData.initialValue ?? '')
                ) {
                  validation.commit(nextValue);
                }
              });
            }
          }
        },
        onKeyDown(event: KeyboardEvent & { currentTarget: HTMLInputElement }) {
          if (event.currentTarget.tagName === 'INPUT' && event.key === 'Enter') {
            field.setTouched(true);
            const value = event.currentTarget.value;
            const form = event.currentTarget.form;
            if (form && form === formElementRef.current && !event.defaultPrevented) {
              const input = event.currentTarget;
              const submitCount = submitCountRef.current;

              // Let the form's submit handler run first.
              enterValidationTimeout.start(0, () => {
                if (submitCountRef.current === submitCount) {
                  validation.commit(input.value);
                }
              });
            } else {
              validation.commit(value);
            }
          }
        },
      },
      isControlled
        ? {
            get value() {
              return componentProps.value ?? '';
            },
          }
        : initialValue !== undefined
          ? { value: initialValue }
          : undefined,
      elementProps,
      (props: Record<string, any>) => validation.getValidationProps(disabled(), props),
    ],
    stateAttributesMapping: fieldValidityMapping,
  });
}

export interface FieldControlState extends FieldRootState {}

export interface FieldControlProps extends BaseUIComponentProps<'input', FieldControlState> {
  /**
   * Callback fired when the `value` changes. Use when controlled.
   */
  onValueChange?:
    | ((value: string, eventDetails: FieldControl.ChangeEventDetails) => void)
    | undefined;
  /**
   * The uncontrolled initial value.
   */
  defaultValue?: string | number | string[] | undefined;
}

export type FieldControlChangeEventReason = typeof REASONS.none;

export type FieldControlChangeEventDetails =
  BaseUIChangeEventDetails<FieldControl.ChangeEventReason>;

export namespace FieldControl {
  export type State = FieldControlState;
  export type Props = FieldControlProps;
  export type ChangeEventReason = FieldControlChangeEventReason;
  export type ChangeEventDetails = FieldControlChangeEventDetails;
}
