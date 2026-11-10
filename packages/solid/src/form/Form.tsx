import { createEffect, omit, untrack } from 'solid-js';
import { EMPTY_OBJECT } from 'base-ui-solidjs-utils/empty';
import { createSyncSignal } from 'base-ui-solidjs-utils/createSyncSignal';
import { createGenericEventDetails } from '../internals/createBaseUIEventDetails';
import type { BaseUIGenericEventDetails } from '../internals/createBaseUIEventDetails';
import { REASONS } from '../internals/reasons';
import type { BaseUIComponentProps } from '../internals/types';
import { FormContext } from '../internals/form-context/FormContext';
import { assignRefs, useRenderElement, type RefInput } from '../internals/useRenderElement';
import { useValueChanged } from '../internals/useValueChanged';

/**
 * A native form element with consolidated error handling.
 * Renders a `<form>` element.
 *
 * Documentation: [Base UI Form](https://base-ui.com/react/components/form)
 */
export function Form<FormValues extends Record<string, any> = Record<string, any>>(
  componentProps: Form.Props<FormValues>,
) {
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'validationMode',
    'errors',
    'onSubmit',
    'onFormSubmit',
    'actionsRef',
    'style',
    'children',
    'ref',
  );

  const formRef: FormContext['formRef'] = {
    current: {
      fields: new Map(),
    },
  };
  const elementRef: FormContext['elementRef'] = { current: null };
  let submitted = false;
  const submitCountRef = { current: 0 };

  const focusFirstInvalid = () => {
    let hasInvalid = false;
    let firstControl: HTMLElement | null = null;
    for (const field of formRef.current.fields.values()) {
      if (field.validityData.state.valid !== false) {
        continue;
      }
      hasInvalid = true;
      const control = field.controlRef.current;
      if (control && (!firstControl || comesBeforeInSameTree(control, firstControl))) {
        firstControl = control;
      }
    }
    if (firstControl) {
      firstControl.focus();
      if (firstControl.tagName === 'INPUT') {
        (firstControl as HTMLInputElement).select();
      }
      return true;
    }
    return hasInvalid;
  };

  const [errors, setErrors] = createSyncSignal(untrack(() => componentProps.errors));

  useValueChanged(
    () => componentProps.errors,
    () => {
      setErrors(componentProps.errors);
    },
  );

  createEffect(errors, () => {
    if (!submitted) {
      return;
    }

    submitted = false;
    focusFirstInvalid();
  });

  createEffect(
    () => componentProps.actionsRef,
    (actionsRef) => {
      assignRefs(actionsRef as RefInput<Form.Actions>, {
        validate(fieldName?: string) {
          if (fieldName) {
            Array.from(formRef.current.fields.values())
              .find((field) => field.name === fieldName)
              ?.validate();
          } else {
            formRef.current.fields.forEach((field) => {
              field.validate();
            });
          }
        },
      });
    },
  );

  const clearErrors = (name: string | undefined) => {
    if (!name) {
      return;
    }
    setErrors((previousErrors) => {
      if (!previousErrors || !Object.hasOwn(previousErrors, name)) {
        return previousErrors;
      }
      const nextErrors = { ...previousErrors };
      delete nextErrors[name];
      return nextErrors;
    });
  };

  const contextValue: FormContext = {
    elementRef,
    formRef,
    get validationMode() {
      return componentProps.validationMode ?? 'onSubmit';
    },
    get errors() {
      return errors() ?? (EMPTY_OBJECT as FormContext['errors']);
    },
    clearErrors,
    submitCountRef,
  };

  return (
    <FormContext value={contextValue}>
      {untrack(() =>
        useRenderElement('form', componentProps, {
          ref: (el: HTMLFormElement | null) => {
            elementRef.current = el;
          },
          props: [
            {
              novalidate: true,
              onSubmit(event: SubmitEvent) {
                submitCountRef.current += 1;

                formRef.current.fields.forEach((field) => {
                  field.validate();
                });

                if (focusFirstInvalid()) {
                  event.preventDefault();
                  return;
                }

                submitted = true;
                (componentProps.onSubmit as ((e: SubmitEvent) => void) | undefined)?.(event);

                const onFormSubmit = componentProps.onFormSubmit;
                if (onFormSubmit) {
                  event.preventDefault();

                  const formValues = {} as FormValues;
                  formRef.current.fields.forEach((field) => {
                    if (field.name) {
                      (formValues as Record<string, any>)[field.name] = field.getValue();
                    }
                  });

                  onFormSubmit(formValues, createGenericEventDetails(REASONS.none, event));
                }
              },
            },
            elementProps,
          ],
        }),
      )}
    </FormContext>
  );
}


export type FormSubmitEventReason = typeof REASONS.none;
export type FormSubmitEventDetails = BaseUIGenericEventDetails<Form.SubmitEventReason>;

export type FormValidationMode = 'onSubmit' | 'onBlur' | 'onChange';

export interface FormActions {
  validate: (fieldName?: string | undefined) => void;
}

export interface FormState {}

export interface FormProps<
  FormValues extends Record<string, any> = Record<string, any>,
> extends BaseUIComponentProps<'form', FormState> {
  /**
   * Determines when the form should be validated.
   * The `validationMode` prop on `<Field.Root>` takes precedence over this.
   *
   * - `onSubmit` (default): validates the field when the form is submitted, afterwards fields will re-validate on change.
   * - `onBlur`: validates a field when it loses focus.
   * - `onChange`: validates the field on every change to its value.
   *
   * @default 'onSubmit'
   */
  validationMode?: FormValidationMode | undefined;
  /**
   * Validation errors returned externally, typically after submission by a server or a form action.
   * This should be an object where keys correspond to the `name` attribute on `<Field.Root>`,
   * and values correspond to error(s) related to that field.
   */
  errors?: FormContext['errors'] | undefined;
  /**
   * Event handler called when the form is submitted.
   * `preventDefault()` is called on the native submit event when used.
   */
  onFormSubmit?:
    | ((formValues: FormValues, eventDetails: Form.SubmitEventDetails) => void)
    | undefined;
  /**
   * A ref to imperative actions.
   * - `validate`: Validates all fields when called. Optionally pass a field name to validate a single field.
   */
  actionsRef?: RefInput<Form.Actions | null> | undefined;
}

export namespace Form {
  export type Props<FormValues extends Record<string, any> = Record<string, any>> =
    FormProps<FormValues>;
  export type State = FormState;
  export type Actions = FormActions;
  export type ValidationMode = FormValidationMode;
  export type SubmitEventReason = FormSubmitEventReason;
  export type SubmitEventDetails = FormSubmitEventDetails;

  export type Values<FormValues extends Record<string, any> = Record<string, any>> = FormValues;
}

/* eslint-disable no-bitwise */
function comesBeforeInSameTree(element: Node, reference: Node) {
  const position = element.compareDocumentPosition(reference);
  return (
    (position & Node.DOCUMENT_POSITION_DISCONNECTED) === 0 &&
    (position & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
  );
}
