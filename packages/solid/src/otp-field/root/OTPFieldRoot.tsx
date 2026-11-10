import type { JSX } from '@solidjs/web';
import type { RefObject } from 'base-ui-solidjs-utils/types';
import { createEffect, createMemo, createSignal, omit, Show, untrack } from 'solid-js';
import { clamp } from 'base-ui-solidjs-utils/clamp';
import { useControlled } from 'base-ui-solidjs-utils/useControlled';
import { visuallyHiddenInput, visuallyHiddenInputPinned } from 'base-ui-solidjs-utils/visuallyHidden';
import { warn } from 'base-ui-solidjs-utils/warn';
import { ownerDocument } from 'base-ui-solidjs-utils/owner';
import { activeElement, contains } from 'base-ui-solidjs-utils/shadowDom';
import { createSyncSignal } from 'base-ui-solidjs-utils/createSyncSignal';
import { CompositeList } from '../../internals/composite/list/CompositeList';
import { useFieldRootContext } from '../../internals/field-root-context/FieldRootContext';
import { useRegisterFieldControl } from '../../internals/field-register-control/useRegisterFieldControl';
import type { FieldRootState } from '../../field/root/FieldRoot';
import { useFormContext } from '../../internals/form-context/FormContext';
import { useLabelableContext } from '../../internals/labelable-provider/LabelableContext';
import { useAriaLabelledBy } from '../../internals/labelable-provider/useAriaLabelledBy';
import { useLabelableId } from '../../internals/labelable-provider/useLabelableId';
import { assignRefs, useRenderElement } from '../../internals/useRenderElement';
import { useValueChanged } from '../../internals/useValueChanged';
import type { BaseUIComponentProps } from '../../internals/types';
import {
  createChangeEventDetails,
  createGenericEventDetails,
} from '../../internals/createBaseUIEventDetails';
import type {
  BaseUIChangeEventDetails,
  BaseUIGenericEventDetails,
} from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { handleHiddenInputInvalid } from '../../internals/handleHiddenInputInvalid';
import { OTPFieldRootContext } from './OTPFieldRootContext';
import { rootStateAttributesMapping } from '../utils/stateAttributesMapping';
import {
  getOTPValidationConfig,
  normalizeOTPValue,
  normalizeOTPValueWithDetails,
} from '../utils/otp';
import type { OTPValidationType } from '../utils/otp';
import { ownedProps } from '../../internals/ownedProps';

/**
 * Groups all OTP field parts and manages their state.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI OTP Field](https://base-ui.com/react/components/otp-field)
 */
export function OTPFieldRoot(componentProps: OTPFieldRoot.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(
    componentProps,
    'aria-describedby',
    'aria-labelledby',
    'id',
    'autoComplete',
    'defaultValue',
    'value',
    'onValueChange',
    'onValueComplete',
    'form',
    'length',
    'autoSubmit',
    'mask',
    'inputMode',
    'validationType',
    'normalizeValue',
    'disabled',
    'readOnly',
    'required',
    'name',
    'onValueInvalid',
    'render',
    'class',
    'style',
    'children',
    'ref',
  );
  const autoComplete = () => componentProps.autoComplete ?? 'one-time-code';
  const length = () => componentProps.length;
  const validationType = () => componentProps.validationType ?? 'numeric';
  const readOnly = () => componentProps.readOnly ?? false;
  const required = () => componentProps.required ?? false;

  const field = useFieldRootContext();
  const { validation } = field;
  const { clearErrors } = useFormContext();
  const labelable = useLabelableContext();

  const disabled = () => field.disabled || (componentProps.disabled ?? false);
  const name = () => field.name ?? componentProps.name;

  const [valueUnwrapped, setValueUnwrapped] = useControlled<string>({
    controlled: () => componentProps.value,
    default: untrack(() => componentProps.defaultValue ?? ''),
    name: 'OTPField',
    state: 'value',
  });

  let rootElement: HTMLDivElement | null = null;
  const inputRefs: RefObject<Array<HTMLInputElement | null>> = { current: [] };
  let hiddenInputElement: HTMLInputElement | null = null;
  let pendingFocus: { index: number; value: string } | null = null;
  let pendingCompleteValue: {
    value: string;
    eventDetails: OTPFieldRoot.CompleteEventDetails;
  } | null = null;

  const [firstInputVersion, setFirstInputVersion] = createSignal(0, {
    ownedWrite: true,
    equals: false,
  });
  const firstInputRef = {
    get current() {
      return inputRefs.current[0] ?? null;
    },
  } as RefObject<HTMLInputElement | null>;

  const id = useLabelableId({
    get id() {
      return componentProps.id;
    },
  } as any);

  const ariaLabelledBy = useAriaLabelledBy(
    () => componentProps['aria-labelledby'],
    () => labelable.labelId,
    () => {
      firstInputVersion();
      return firstInputRef.current;
    },
    () => true,
    id as any,
  );
  const inputAriaLabelledBy = () =>
    componentProps['aria-labelledby'] == null ? ariaLabelledBy() : undefined;

  const ariaDescribedBy = () =>
    mergeAriaIds(
      componentProps['aria-describedby'],
      (labelable.getDescriptionProps({}) as any)['aria-describedby'],
    );

  const validationConfig = () => getOTPValidationConfig(validationType());
  const pattern = () => validationConfig()?.slotPattern;
  const hiddenInputPattern = () => validationConfig()?.getRootPattern(length());
  const inputMode = () => componentProps.inputMode ?? validationConfig()?.inputMode;
  const hasValidLength = () => Number.isInteger(length()) && length() > 0;

  const value = createMemo(() =>
    normalizeOTPValue(valueUnwrapped(), length(), validationType(), componentProps.normalizeValue),
  );
  const filled = () => value() !== '';

  const [inputCount, setInputCount] = createSignal(0, { ownedWrite: true });
  const [focusedIndex, setFocusedIndex] = createSyncSignal(
    untrack(() => Math.min(value().length, length() - 1)),
  );
  const [focused, setFocusedState] = createSyncSignal(false);

  const activeIndex = () =>
    focused()
      ? Math.min(focusedIndex(), Math.max(length() - 1, 0))
      : Math.min(value().length, length() - 1);

  createEffect(filled, (isFilled) => {
    field.setFilled(isFilled);
  });

  if (process.env.NODE_ENV !== 'production') {
    createEffect(
      () => [inputCount(), length()] as const,
      ([count, len]) => {
        if (!Number.isInteger(len) || len <= 0 || count === 0 || count === len) {
          return;
        }

        warn(
          '<OTPField.Root> `length` must match the number of rendered ' +
            `<OTPField.Input /> parts. Received \`length={${len}}\` but rendered ` +
            `${count} input${count === 1 ? '' : 's'}.`,
        );
      },
    );

    createEffect(length, (len) => {
      if (Number.isInteger(len) && len > 0) {
        return;
      }

      warn(
        `<OTPField.Root> \`length\` must be a positive integer. Received \`length={${String(len)}}\`.`,
      );
    });
  }

  useRegisterFieldControl(
    firstInputRef as any,
    id as any,
    value,
    undefined,
    () => !disabled(),
    () => componentProps.name,
  );

  const focusInput = (index: number) => {
    const targetIndex = clamp(index, 0, Math.max(inputRefs.current.length - 1, 0));
    const target = inputRefs.current[targetIndex];
    target?.focus();
    target?.select();
  };

  const queueFocusInput = (index: number, nextValue: string) => {
    pendingFocus = { index, value: nextValue };
  };

  function requestSubmit() {
    // Not `validation.inputRef`: outside a Field, every control shares it.
    let formElement = hiddenInputElement?.form ?? inputRefs.current[0]?.form ?? null;

    const form = untrack(() => componentProps.form);
    if (form) {
      const associatedElement = ownerDocument(rootElement).getElementById(form);
      if (associatedElement?.tagName === 'FORM') {
        formElement = associatedElement as HTMLFormElement;
      }
    }

    if (formElement && typeof formElement.requestSubmit === 'function') {
      formElement.requestSubmit();
    }
  }

  function completeValue(completedValue: string, eventDetails: OTPFieldRoot.CompleteEventDetails) {
    componentProps.onValueComplete?.(completedValue, eventDetails);

    if (untrack(() => componentProps.autoSubmit ?? false)) {
      requestSubmit();
    }
  }

  useValueChanged(value, () => {
    const currentValue = untrack(value);
    clearErrors(untrack(name));
    field.setDirty(currentValue !== field.validityData.initialValue);
    validation.change(currentValue);

    const focusRequest = pendingFocus;
    if (focusRequest != null) {
      pendingFocus = null;
      if (focusRequest.value === currentValue) {
        focusInput(focusRequest.index);
      }
    }

    // When the value shrinks externally, move focus off slots past the first empty one so typing
    // and Backspace keep working.
    const focusedElement = activeElement(ownerDocument(rootElement));
    if (
      focusedElement &&
      inputRefs.current.indexOf(focusedElement as HTMLInputElement) > currentValue.length
    ) {
      focusInput(currentValue.length);
      setFocusedIndex(currentValue.length);
    }

    const completeRequest = pendingCompleteValue;
    if (completeRequest != null) {
      pendingCompleteValue = null;
      if (completeRequest.value === currentValue) {
        completeValue(currentValue, completeRequest.eventDetails);
      }
    }
  });

  const setValue = (nextValue: string, details: OTPFieldRoot.ChangeEventDetails) => {
    const len = untrack(length);
    const normalizedValue = normalizeOTPValue(
      nextValue,
      len,
      untrack(validationType),
      untrack(() => componentProps.normalizeValue),
    );
    const currentValue = untrack(value);
    const canComplete =
      details.reason === REASONS.inputChange || details.reason === REASONS.inputPaste;
    const completeEventDetails =
      canComplete &&
      normalizedValue.length === len &&
      (currentValue.length !== len || details.reason === REASONS.inputPaste)
        ? (createGenericEventDetails(details.reason, details.event) as any)
        : null;

    if (normalizedValue === currentValue) {
      if (completeEventDetails != null) {
        completeValue(normalizedValue, completeEventDetails);
      }
      return null;
    }

    componentProps.onValueChange?.(normalizedValue, details);

    if (details.isCanceled) {
      return null;
    }

    setValueUnwrapped(normalizedValue);

    if (completeEventDetails != null) {
      pendingCompleteValue = {
        value: normalizedValue,
        eventDetails: completeEventDetails,
      };
    } else if (normalizedValue.length !== len) {
      pendingCompleteValue = null;
    }

    return normalizedValue;
  };

  const reportValueInvalid = (invalidValue: string, details: OTPFieldRoot.InvalidEventDetails) => {
    componentProps.onValueInvalid?.(invalidValue, details);
  };

  const handleInputFocus = (index: number, event: FocusEvent) => {
    const currentValue = untrack(value);
    if (index > currentValue.length) {
      focusInput(Math.min(currentValue.length, untrack(length) - 1));
      return;
    }

    setFocusedIndex(index);
    (event.currentTarget as HTMLInputElement).select();
  };

  const handleInputBlur = (event: FocusEvent) => {
    if (contains(rootElement, event.relatedTarget as Element | null)) {
      return;
    }

    field.setTouched(true);
    setFocusedState(false);
    field.setFocused(false);

    if (field.validationMode === 'onBlur') {
      validation.commit(untrack(value));
    }
  };

  const getInputId = (index: number) => {
    const currentId = id();
    if (currentId == null) {
      return undefined;
    }

    return index === 0 ? currentId : `${currentId}-${index + 1}`;
  };

  const state = createMemo<OTPFieldRootState>(() => ({
    ...field.state,
    complete: value().length === length(),
    disabled: disabled(),
    filled: filled(),
    focused: focused(),
    length: length(),
    readOnly: readOnly(),
    required: required(),
    value: value(),
  }));

  const contextValue: OTPFieldRootContext = {
    get autoComplete() {
      return autoComplete();
    },
    get activeIndex() {
      return activeIndex();
    },
    get disabled() {
      return disabled();
    },
    get form() {
      return componentProps.form;
    },
    focusInput,
    queueFocusInput,
    getInputId,
    handleInputBlur,
    handleInputFocus,
    get inputMode() {
      return inputMode() as any;
    },
    get inputAriaLabelledBy() {
      return inputAriaLabelledBy();
    },
    get invalid() {
      return field.invalid;
    },
    get length() {
      return length();
    },
    get mask() {
      return componentProps.mask ?? false;
    },
    get pattern() {
      return pattern();
    },
    reportValueInvalid,
    get readOnly() {
      return readOnly();
    },
    get required() {
      return required();
    },
    get normalizeValue() {
      return componentProps.normalizeValue;
    },
    setValue,
    setFocused: setFocusedState as OTPFieldRootContext['setFocused'],
    get state() {
      return state();
    },
    get validationType() {
      return validationType();
    },
    get value() {
      return value();
    },
  } as OTPFieldRootContext;

  const hiddenInputProps = createMemo(() =>
    validation.getValidationProps(disabled(), {
      onFocus() {
        focusInput(0);
      },
      onInput(event: Event) {
        if (event.defaultPrevented || untrack(disabled) || untrack(readOnly)) {
          return;
        }

        const rawValue = (event.currentTarget as HTMLInputElement).value;
        const [normalizedValue, didRejectCharacters] = normalizeOTPValueWithDetails(
          rawValue,
          untrack(length),
          untrack(validationType),
          untrack(() => componentProps.normalizeValue),
        );

        if (didRejectCharacters) {
          reportValueInvalid(
            rawValue,
            createGenericEventDetails(REASONS.inputChange, event) as any,
          );
        }

        const committedValue = setValue(
          normalizedValue,
          createChangeEventDetails(REASONS.inputChange, event) as any,
        );

        if (committedValue != null && committedValue !== '') {
          queueFocusInput(committedValue.length - 1, committedValue);
        }
      },
    } as any),
  );

  return (
    <CompositeList
      elementsRef={inputRefs}
      onMapChange={(newMap: Map<any, any>) => {
        setInputCount(newMap.size);
        setFirstInputVersion(0);
      }}
    >
      <OTPFieldRootContext value={contextValue}>
        {untrack(() =>
          useRenderElement('div', componentProps, {
            ref: (el: HTMLDivElement | null) => {
              rootElement = el;
            },
            state,
            props: [
              {
                role: 'group',
                get 'aria-describedby'() {
                  return ariaDescribedBy();
                },
                get 'aria-labelledby'() {
                  return ariaLabelledBy();
                },
              },
              elementProps,
            ],
            stateAttributesMapping: rootStateAttributesMapping as any,
          }),
        )}
        <Show when={hasValidLength()}>
          <input
            {...(hiddenInputProps() as any)}
            ref={(el: HTMLInputElement) => {
              hiddenInputElement = el;
              assignRefs(validation.inputRef as any, el);
            }}
            type="text"
            id={id() && name() == null ? `${id()}-hidden-input` : undefined}
            form={componentProps.form}
            name={name()}
            value={value()}
            autocomplete={autoComplete()}
            inputmode={inputMode() as any}
            minlength={length()}
            maxlength={length()}
            pattern={hiddenInputPattern()}
            disabled={disabled()}
            readonly={readOnly()}
            required={required()}
            aria-hidden="true"
            tabindex={-1}
            style={name() ? visuallyHiddenInput : visuallyHiddenInputPinned}
            onInvalid={handleHiddenInputInvalid as any}
          />
        </Show>
      </OTPFieldRootContext>
    </CompositeList>
  );
}

export interface OTPFieldRootProps extends Omit<
  BaseUIComponentProps<'div', OTPFieldRootState>,
  'onChange'
> {
  /**
   * The id of the first input element.
   * Subsequent inputs derive their ids from it (`{id}-2`, `{id}-3`, and so on).
   */
  id?: string | undefined;
  /**
   * The input autocomplete attribute. Applied to the first slot and hidden validation input.
   * @default 'one-time-code'
   */
  autoComplete?: string | undefined;
  /**
   * A string specifying the `form` element with which the hidden input is associated.
   * This string's value must match the id of a `form` element in the same document.
   */
  form?: string | undefined;
  /**
   * The number of OTP input slots.
   * Required so the root can clamp values, detect completion, and generate
   * consistent validation markup before all slots hydrate.
   */
  length: number;
  /**
   * Whether to submit the owning form when the OTP becomes complete.
   * @default false
   */
  autoSubmit?: boolean | undefined;
  /**
   * Whether the slot inputs should mask entered characters.
   * Pass `type` directly to individual `<OTPField.Input>` parts to use a custom
   * input type.
   * @default false
   */
  mask?: boolean | undefined;
  /**
   * The virtual keyboard hint applied to the slot inputs and hidden validation input.
   *
   * Built-in validation modes provide sensible defaults, but you can override them when needed.
   */
  inputMode?: JSX.HTMLAttributes<HTMLInputElement>['inputMode'] | undefined;
  /**
   * The type of input validation to apply to the OTP value.
   * @default 'numeric'
   */
  validationType?: OTPFieldRoot.ValidationType | undefined;
  /**
   * Function that normalizes the OTP value after whitespace and `validationType` filtering.
   * It runs whenever OTP Field normalizes a value, including initial/default values, controlled
   * values, and user edits.
   *
   * The returned value is filtered by `validationType` again, then clamped to `length`.
   * It should be idempotent because OTP Field may normalize the same value more than once while
   * handling edits, storing state, and rendering controlled or uncontrolled values. Non-idempotent
   * normalizers can compound across those normalization passes. Characters rejected while
   * normalizing typed or pasted text are reported through `onValueInvalid`.
   */
  normalizeValue?: ((value: string) => string) | undefined;
  /**
   * Whether the user must enter a value before submitting a form.
   * @default false
   */
  required?: boolean | undefined;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Whether the user should be unable to change the field value.
   * @default false
   */
  readOnly?: boolean | undefined;
  /**
   * Identifies the field when a form is submitted.
   */
  name?: string | undefined;
  /**
   * The OTP value.
   */
  value?: string | undefined;
  /**
   * The uncontrolled OTP value when the component is initially rendered.
   */
  defaultValue?: string | undefined;
  /**
   * Callback fired when the OTP value changes.
   *
   * The `eventDetails.reason` indicates what triggered the change:
   * - `'input-change'` for typing or autofill
   * - `'input-clear'` when a character is removed by text input
   * - `'input-paste'` for paste interactions
   * - `'keyboard'` for keyboard interactions that change the value
   */
  onValueChange?:
    ((value: string, eventDetails: OTPFieldRoot.ChangeEventDetails) => void) | undefined;
  /**
   * Callback fired when entered text contains characters that are rejected by validation or
   * normalization before the OTP value updates.
   *
   * The `value` argument is the attempted user-entered string before normalization.
   */
  onValueInvalid?:
    ((value: string, eventDetails: OTPFieldRoot.InvalidEventDetails) => void) | undefined;
  /**
   * Callback function that is fired when the OTP value becomes complete, or when a complete value
   * is pasted while the OTP is already complete.
   *
   * When the value changes, it runs later than `onValueChange`, after the internal value update is
   * applied. If a complete pasted value matches the current value, `onValueChange` does not fire.
   *
   * If `autoSubmit` is enabled, it runs immediately before the owning form is submitted.
   */
  onValueComplete?:
    ((value: string, eventDetails: OTPFieldRoot.CompleteEventDetails) => void) | undefined;
}

export interface OTPFieldRootState extends FieldRootState {
  /**
   * Whether all slots are filled.
   */
  complete: boolean;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  /**
   * The number of OTP input slots.
   */
  length: number;
  /**
   * Whether the user should be unable to change the field value.
   */
  readOnly: boolean;
  /**
   * Whether the user must enter a value before submitting a form.
   */
  required: boolean;
  /**
   * The OTP value.
   */
  value: string;
}

export type OTPFieldRootChangeEventReason =
  | typeof REASONS.inputChange
  | typeof REASONS.inputClear
  | typeof REASONS.inputPaste
  | typeof REASONS.keyboard;
export type OTPFieldRootChangeEventDetails =
  BaseUIChangeEventDetails<OTPFieldRoot.ChangeEventReason>;

export type OTPFieldRootInvalidEventReason = typeof REASONS.inputChange | typeof REASONS.inputPaste;
export type OTPFieldRootInvalidEventDetails =
  BaseUIGenericEventDetails<OTPFieldRoot.InvalidEventReason>;

export type OTPFieldRootCompleteEventReason =
  typeof REASONS.inputChange | typeof REASONS.inputPaste;
export type OTPFieldRootCompleteEventDetails =
  BaseUIGenericEventDetails<OTPFieldRoot.CompleteEventReason>;

export namespace OTPFieldRoot {
  export type State = OTPFieldRootState;
  export type Props = OTPFieldRootProps;
  export type ValidationType = OTPValidationType;
  export type ChangeEventReason = OTPFieldRootChangeEventReason;
  export type ChangeEventDetails = OTPFieldRootChangeEventDetails;
  export type InvalidEventReason = OTPFieldRootInvalidEventReason;
  export type InvalidEventDetails = OTPFieldRootInvalidEventDetails;
  export type CompleteEventReason = OTPFieldRootCompleteEventReason;
  export type CompleteEventDetails = OTPFieldRootCompleteEventDetails;
}

function mergeAriaIds(...values: Array<string | undefined>) {
  const ids = values.flatMap((value) => value?.split(/\s+/).filter(Boolean) ?? []);
  return ids.length > 0 ? Array.from(new Set(ids)).join(' ') : undefined;
}

