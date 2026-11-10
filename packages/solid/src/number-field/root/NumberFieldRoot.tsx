import type { JSX } from '@solidjs/web';
import type { RefObject } from 'base-ui-solidjs-utils/types';
import { createEffect, createMemo, createSignal, omit, untrack } from 'solid-js';
import { addEventListener } from 'base-ui-solidjs-utils/addEventListener';
import { useControlled } from 'base-ui-solidjs-utils/useControlled';
import { visuallyHiddenInput, visuallyHiddenInputPinned } from 'base-ui-solidjs-utils/visuallyHidden';
import { ownerDocument } from 'base-ui-solidjs-utils/owner';
import { platform } from 'base-ui-solidjs-utils/platform';
import { formatNumber } from 'base-ui-solidjs-utils/formatNumber';
import { activeElement } from 'base-ui-solidjs-utils/shadowDom';
import { createSyncSignal } from 'base-ui-solidjs-utils/createSyncSignal';
import type { InputMode } from './NumberFieldRootContext';
import { NumberFieldRootContext } from './NumberFieldRootContext';
import { useFieldRootContext } from '../../internals/field-root-context/FieldRootContext';
import { useFormContext } from '../../internals/form-context/FormContext';
import type { FieldRootState } from '../../field/root/FieldRoot';
import { useLabelableId } from '../../internals/labelable-provider/useLabelableId';
import type { BaseUIComponentProps } from '../../internals/types';
import { stateAttributesMapping } from '../utils/stateAttributesMapping';
import { assignRefs, useRenderElement } from '../../internals/useRenderElement';
import type { RefInput } from '../../internals/useRenderElement';
import {
  getAllFormatParts,
  getLocaleDigits,
  getNumberLocaleDetails,
  PERMILLE,
  PERCENTAGES,
  SPACE_SEPARATOR_RE,
  BASE_NON_NUMERIC_SYMBOLS,
  MINUS_SIGNS_WITH_ASCII,
  PLUS_SIGNS_WITH_ASCII,
} from '../utils/parse';
import { toValidatedNumber } from '../utils/validate';
import type {
  EventWithOptionalKeyState,
  ChangeEventCustomProperties,
  IncrementValueParameters,
} from '../utils/types';
import {
  createChangeEventDetails,
  createGenericEventDetails,
} from '../../internals/createBaseUIEventDetails';
import type {
  BaseUIChangeEventDetails,
  BaseUIGenericEventDetails,
  ReasonToEvent,
} from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { handleHiddenInputInvalid } from '../../internals/handleHiddenInputInvalid';
import { ownedProps } from '../../internals/ownedProps';

/**
 * Groups all parts of the number field and manages its state.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Number Field](https://base-ui.com/react/components/number-field)
 */
export function NumberFieldRoot(componentProps: NumberFieldRoot.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(
    componentProps,
    'id',
    'min',
    'max',
    'smallStep',
    'step',
    'largeStep',
    'required',
    'disabled',
    'readOnly',
    'form',
    'name',
    'defaultValue',
    'value',
    'onValueChange',
    'onValueCommitted',
    'allowWheelScrub',
    'snapOnStep',
    'allowOutOfRange',
    'format',
    'locale',
    'render',
    'class',
    'inputRef',
    'style',
    'ref',
  );

  const field = useFieldRootContext();
  const { validation } = field;
  const { clearErrors } = useFormContext();

  const disabled = () => field.disabled || (componentProps.disabled ?? false);
  const readOnly = () => componentProps.readOnly ?? false;
  const required = () => componentProps.required ?? false;
  const name = () => field.name ?? componentProps.name;
  const step = () => (componentProps.step === 'any' ? 1 : (componentProps.step ?? 1));
  const smallStep = () => componentProps.smallStep ?? 0.1;
  const largeStep = () => componentProps.largeStep ?? 10;

  const [isScrubbing, setIsScrubbing] = createSignal(false, { ownedWrite: true });

  const minWithDefaultFn = () => componentProps.min ?? Number.MIN_SAFE_INTEGER;
  const maxWithDefaultFn = () => componentProps.max ?? Number.MAX_SAFE_INTEGER;
  const minWithZeroDefault = () => componentProps.min ?? 0;

  const inputRef: RefObject<HTMLInputElement | null> = { current: null };

  const id = useLabelableId({
    get id() {
      return componentProps.id;
    },
  } as any);

  const [value, setValueUnwrapped] = useControlled<number | null>({
    controlled: () => componentProps.value,
    default: untrack(() => componentProps.defaultValue ?? null),
    name: 'NumberField',
    state: 'value',
  });

  // Synced after changes like upstream's `useValueAsRef`; the stepper buttons also write to it.
  const valueRef: RefObject<number | null> = { current: untrack(value) };
  createEffect(value, (currentValue) => {
    valueRef.current = currentValue;
  });

  createEffect(value, (currentValue) => {
    field.setFilled(currentValue !== null);
  });

  const formatOptionsRef = {
    get current() {
      return untrack(() => componentProps.format);
    },
  } as RefObject<Intl.NumberFormatOptions | undefined>;

  const hasPendingCommitRef: RefObject<boolean> = { current: false };

  const onValueCommitted = (
    nextValue: number | null,
    eventDetails: NumberFieldRoot.CommitEventDetails,
  ) => {
    hasPendingCommitRef.current = false;
    componentProps.onValueCommitted?.(nextValue, eventDetails);
  };

  const allowInputSyncRef: RefObject<boolean | null> = { current: true };
  const lastChangedValueRef: RefObject<number | null> = { current: null };

  const [inputValue, setInputValue] = createSyncSignal(
    untrack(() => formatNumber(value(), componentProps.locale, componentProps.format)),
  );
  const [inputMode, setInputMode] = createSignal<InputMode>('numeric', { ownedWrite: true });

  const getAllowedNonNumericKeys = () => {
    const locale = untrack(() => componentProps.locale);
    const format = untrack(() => componentProps.format);
    const formatStyle = format?.style;
    const minWithDefault = untrack(minWithDefaultFn);
    const allowOutOfRange = untrack(() => componentProps.allowOutOfRange ?? false);
    const parts = getAllFormatParts(locale, format);

    const keys = new Set<string>(BASE_NON_NUMERIC_SYMBOLS);
    const addAll = (chars: readonly string[]) => chars.forEach((char) => keys.add(char));

    // Integer formats omit the decimal from `parts`, so fall back to the locale's separator in that
    // case; it must stay typeable regardless of whether the format renders a fraction.
    const decimal =
      parts.find((part) => part.type === 'decimal')?.value ??
      getNumberLocaleDetails(locale, format).decimal;
    keys.add(decimal);

    // Allow every non-digit character the formatter renders — separators, currency symbols, units
    // (e.g. `km/h`, `°C`), exponent separators, and locale literals — decomposed per character
    // because the input validates the typed string one character at a time. Deriving these from
    // the formatter covers multi-character and locale-specific symbols of every part type
    // uniformly. `compact` suffixes (e.g. `K`/`M`) are excluded because `parseNumber` can't reverse
    // them, so allowing them would yield a silently incorrect value.
    parts.forEach((part) => {
      if (
        part.type === 'integer' ||
        part.type === 'fraction' ||
        part.type === 'exponentInteger' ||
        part.type === 'compact'
      ) {
        return;
      }
      addAll(Array.from(part.value));
      if (SPACE_SEPARATOR_RE.test(part.value)) {
        keys.add(' ');
      }
    });
    // Digits follow the locale's numbering system, such as `১২` in bn-BD
    addAll(getLocaleDigits(locale, format));

    const allowPercentSymbols =
      formatStyle === 'percent' || (formatStyle === 'unit' && format?.unit === 'percent');
    const allowPermilleSymbols =
      formatStyle === 'percent' || (formatStyle === 'unit' && format?.unit === 'permille');

    // Tolerate percent/permille variants the formatter doesn't emit but users may type or paste.
    if (allowPercentSymbols) {
      addAll(PERCENTAGES);
    }
    if (allowPermilleSymbols) {
      addAll(PERMILLE);
    }

    // Allow plus sign in all cases; minus sign when negatives are valid, or when out-of-range
    // entry is allowed so native underflow validation can be triggered from the keyboard.
    // Exponent notations already allow it above for negative exponents (`2E-2`).
    addAll(PLUS_SIGNS_WITH_ASCII);
    if (minWithDefault < 0 || allowOutOfRange) {
      addAll(MINUS_SIGNS_WITH_ASCII);
      // Accounting formats show negatives in parentheses, such as `($1.00)`
      if (format?.currencySign === 'accounting') {
        addAll(['(', ')']);
      }
    }

    return keys;
  };

  const getStepAmount = (event?: EventWithOptionalKeyState) => {
    if (event?.altKey) {
      return untrack(smallStep);
    }
    if (event?.shiftKey) {
      return untrack(largeStep);
    }
    return untrack(step);
  };

  const setValue = (
    unvalidatedValue: number | null,
    details: NumberFieldRoot.ChangeEventDetails,
  ): boolean => {
    const eventWithOptionalKeyState = details.event as EventWithOptionalKeyState;
    const dir = details.direction;
    const currentValue = untrack(value);
    const allowOutOfRange = untrack(() => componentProps.allowOutOfRange ?? false);

    // Direct text entry (typing, pasting, clearing, autofill) behaves natively; step-based
    // interactions (keyboard arrows, buttons, wheel, scrub) do not.
    const isInputReason = details.reason.startsWith('input-') || details.reason === REASONS.none;
    // Only allow out-of-range values for direct text entry. Step-based interactions still clamp.
    const shouldClampValue = !allowOutOfRange || !isInputReason;

    const validatedValue = toValidatedNumber(
      unvalidatedValue,
      dir ? getStepAmount(eventWithOptionalKeyState) * dir : undefined,
      untrack(minWithDefaultFn),
      untrack(maxWithDefaultFn),
      untrack(minWithZeroDefault),
      formatOptionsRef.current,
      untrack(() => componentProps.snapOnStep ?? false),
      eventWithOptionalKeyState?.altKey ?? false,
      shouldClampValue,
    );

    // Notify about a change even when the numeric value is unchanged for input reasons.
    const shouldFireChange =
      validatedValue !== currentValue ||
      (isInputReason && (unvalidatedValue !== currentValue || allowInputSyncRef.current === false));

    if (shouldFireChange) {
      componentProps.onValueChange?.(validatedValue, details);

      if (details.isCanceled) {
        // Report a vetoed change as not applied, so callers don't commit a value never stored.
        return false;
      }

      setValueUnwrapped(validatedValue);
      field.setDirty(validatedValue !== field.validityData.initialValue);
      hasPendingCommitRef.current = true;
    }

    lastChangedValueRef.current = validatedValue;

    // Keep the visible input in sync immediately when programmatic changes occur
    // (increment/decrement, wheel, etc). During direct typing we don't want
    // to overwrite the user-provided text until blur, so we gate on
    // `allowInputSyncRef`.
    if (allowInputSyncRef.current) {
      setInputValue(
        formatNumber(
          validatedValue,
          untrack(() => componentProps.locale),
          untrack(() => componentProps.format),
        ),
      );
    }

    return shouldFireChange;
  };

  const incrementValue = (
    amount: number,
    { direction, currentValue, event, reason }: IncrementValueParameters,
  ) => {
    const prevValue = currentValue == null ? valueRef.current : currentValue;
    const nativeEvent = event as ReasonToEvent<IncrementValueParameters['reason']> | undefined;

    if (typeof prevValue !== 'number') {
      // Seed an empty field with 0; `setValue` clamps it to the in-range value nearest 0.
      return setValue(0, createChangeEventDetails(reason, nativeEvent) as any);
    }

    return setValue(
      prevValue + amount * direction,
      createChangeEventDetails(reason, nativeEvent, undefined, {
        direction,
      }) as any,
    );
  };

  // Update the input value when the external `value` prop (or format) changes.
  createEffect(
    () => [value(), componentProps.locale, componentProps.format] as const,
    function syncFormattedInputValueOnValueChange([currentValue, locale, format]) {
      // This ensures the value is only updated on blur rather than every keystroke, but still
      // allows the input value to be updated when the value is changed externally.
      if (!allowInputSyncRef.current) {
        return;
      }

      const nextInputValue = formatNumber(currentValue, locale, format);

      if (nextInputValue !== inputValue()) {
        setInputValue(nextInputValue);
      }
    },
  );

  createEffect(minWithDefaultFn, function setDynamicInputModeForIOS(minWithDefault) {
    if (!platform.os.ios) {
      return;
    }

    // iOS numeric software keyboard doesn't have a minus key, so we need to use the default
    // keyboard to let the user input a negative number.
    let computedInputMode: InputMode = 'text';

    if (minWithDefault >= 0) {
      // iOS numeric software keyboard doesn't have a decimal key for "numeric" input mode, but
      // this is better than the "text" input if possible to use.
      computedInputMode = 'decimal';
    }

    setInputMode(computedInputMode);
  });

  // Programmatic focus leaves the caret at the start (Chrome/Firefox) or selects the whole value
  // (Safari). Store the caret at the end before focusing.
  const focusInput = () => {
    const input = inputRef.current;
    if (!input) {
      return;
    }

    const length = input.value.length;
    input.setSelectionRange(length, length);
    input.focus();
  };

  // Attach a native (non-passive) `wheel` listener to the input to prevent page scrolling.
  const [inputElement, setInputElement] = createSyncSignal<HTMLInputElement | null>(null);
  Object.defineProperty(inputRef, 'current', {
    get: () => untrack(inputElement),
    set: (element: HTMLInputElement | null) => setInputElement(element),
  });

  createEffect(
    () =>
      [
        disabled(),
        readOnly(),
        componentProps.allowWheelScrub ?? false,
        inputElement(),
      ] as const,
    function registerElementWheelListener([isDisabled, isReadOnly, allowWheelScrub, element]) {
      if (isDisabled || isReadOnly || !allowWheelScrub || !element) {
        return undefined;
      }

      function handleWheel(event: WheelEvent) {
        if (
          // Allow pinch-zooming.
          event.ctrlKey ||
          activeElement(ownerDocument(element)) !== element
        ) {
          return;
        }

        // Some browsers deliver shift + wheel on the horizontal axis.
        const isHorizontal = Math.abs(event.deltaX) > Math.abs(event.deltaY);
        const delta = event.shiftKey && isHorizontal ? event.deltaX : event.deltaY;

        // Ignore horizontal gestures so the page can scroll instead of scrubbing.
        if (delta === 0 || (!event.shiftKey && isHorizontal)) {
          return;
        }

        // Prevent the default behavior to avoid scrolling the page.
        event.preventDefault();

        allowInputSyncRef.current = true;

        const amount = getStepAmount(event);

        // Each wheel turn is a discrete, final change, so commit it immediately.
        const changed = incrementValue(amount, {
          direction: delta > 0 ? -1 : 1,
          event,
          reason: REASONS.wheel,
        });

        if (changed) {
          onValueCommitted(
            lastChangedValueRef.current,
            createGenericEventDetails(REASONS.wheel, event) as any,
          );
        }
      }

      return addEventListener(element, 'wheel', handleWheel);
    },
  );

  const state = createMemo<NumberFieldRootState>(() => ({
    ...field.state,
    disabled: disabled(),
    readOnly: readOnly(),
    required: required(),
    value: value(),
    inputValue: inputValue(),
    scrubbing: isScrubbing(),
  }));

  const contextValue: NumberFieldRootContext = {
    inputRef,
    focusInput,
    get minWithDefault() {
      return minWithDefaultFn();
    },
    get maxWithDefault() {
      return maxWithDefaultFn();
    },
    get id() {
      return id();
    },
    get form() {
      return componentProps.form;
    },
    setValue,
    incrementValue,
    getStepAmount,
    allowInputSyncRef,
    formatOptionsRef,
    valueRef,
    lastChangedValueRef,
    hasPendingCommitRef,
    get name() {
      return name();
    },
    get nameProp() {
      return componentProps.name;
    },
    get inputMode() {
      return inputMode();
    },
    getAllowedNonNumericKeys,
    get min() {
      return componentProps.min;
    },
    get max() {
      return componentProps.max;
    },
    setInputValue,
    get locale() {
      return componentProps.locale;
    },
    setIsScrubbing,
    get state() {
      return state();
    },
    onValueCommitted,
  } as NumberFieldRootContext;

  const hiddenInputProps = createMemo(() =>
    validation.getValidationProps(disabled(), {
      onFocus() {
        focusInput();
      },
      onChange(event: Event) {
        if (event.defaultPrevented || untrack(disabled) || untrack(readOnly)) {
          return;
        }

        // Handle browser autofill.
        const nextValue = (event.currentTarget as HTMLInputElement).valueAsNumber;
        const parsedValue = Number.isNaN(nextValue) ? null : nextValue;
        const details = createChangeEventDetails(REASONS.none, event);

        // `setValue` updates the dirty flag from the stored (clamped) value, so validate with
        // that same value rather than the raw autofilled one.
        setValue(parsedValue, details as any);
        clearErrors(untrack(name));
        validation.change(lastChangedValueRef.current ?? parsedValue);
      },
    } as any),
  );

  return (
    <NumberFieldRootContext value={contextValue}>
      {untrack(() =>
        useRenderElement('div', componentProps, {
          state,
          props: elementProps,
          stateAttributesMapping,
        }),
      )}
      <input
        {...(hiddenInputProps() as any)}
        ref={(el: HTMLInputElement) => {
          assignRefs(componentProps.inputRef as RefInput<HTMLInputElement>, el);
          assignRefs(validation.inputRef as any, el);
        }}
        type="number"
        form={componentProps.form}
        name={name()}
        value={value() ?? ''}
        min={componentProps.min}
        max={componentProps.max}
        step={componentProps.step}
        disabled={disabled()}
        readonly={readOnly()}
        required={required()}
        aria-hidden="true"
        tabindex={-1}
        style={name() ? visuallyHiddenInput : visuallyHiddenInputPinned}
        onInvalid={handleHiddenInputInvalid as any}
      />
    </NumberFieldRootContext>
  );
}

export interface NumberFieldRootProps extends Omit<
  BaseUIComponentProps<'div', NumberFieldRootState>,
  'onChange'
> {
  /**
   * The id of the input element.
   */
  id?: string | undefined;
  /**
   * The minimum value of the input element.
   */
  min?: number | undefined;
  /**
   * The maximum value of the input element.
   */
  max?: number | undefined;
  /**
   * When true, direct text entry may be outside the `min`/`max` range without clamping,
   * so native range underflow/overflow validation can occur.
   * Step-based interactions (keyboard arrows, buttons, wheel, scrub) still clamp.
   * @default false
   */
  allowOutOfRange?: boolean | undefined;
  /**
   * The small step value of the input element when incrementing while the alt key is held.
   * Snaps to multiples of this value when `snapOnStep` is enabled.
   * @default 0.1
   */
  smallStep?: number | undefined;
  /**
   * Amount to increment and decrement with the buttons and arrow keys, or to scrub with pointer movement in the scrub area.
   * To always enable step validation on form submission, specify the `min` prop explicitly in conjunction with this prop.
   * Specify `step="any"` to always disable step validation; interactive stepping then uses a base amount of `1`, while the alt and shift keys still step by `smallStep` and `largeStep`.
   * @default 1
   */
  step?: number | 'any' | undefined;
  /**
   * The large step value of the input element when incrementing while the shift key is held.
   * Snaps to multiples of this value when `snapOnStep` is enabled.
   * @default 10
   */
  largeStep?: number | undefined;
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
   * Identifies the form that owns the hidden input.
   * Useful when the number field is rendered outside the form.
   */
  form?: string | undefined;
  /**
   * The raw numeric value of the field.
   */
  value?: number | null | undefined;
  /**
   * The uncontrolled value of the field when it's initially rendered.
   *
   * To render a controlled number field, use the `value` prop instead.
   */
  defaultValue?: number | undefined;
  /**
   * Whether to allow the user to scrub the input value with the mouse wheel while focused and
   * hovering over the input.
   * @default false
   */
  allowWheelScrub?: boolean | undefined;
  /**
   * Whether the value should snap to the nearest step when incrementing or decrementing.
   * @default false
   */
  snapOnStep?: boolean | undefined;
  /**
   * Options to format the input value.
   */
  format?: Intl.NumberFormatOptions | undefined;
  /**
   * Callback fired when the number value changes.
   *
   * The `eventDetails.reason` indicates what triggered the change:
   * - `'input-change'` for parseable typing or programmatic text updates
   * - `'input-clear'` when the field becomes empty
   * - `'input-blur'` when formatting (and clamping, if enabled) occurs on blur
   * - `'input-paste'` for paste interactions
   * - `'keyboard'` for arrow-key/Home/End stepping (typing digits uses `'input-change'`/`'input-clear'`)
   * - `'increment-press'` / `'decrement-press'` for button presses on the increment and decrement controls
   * - `'wheel'` for wheel-based scrubbing
   * - `'scrub'` for scrub area drags
   */
  onValueChange?:
    ((value: number | null, eventDetails: NumberFieldRoot.ChangeEventDetails) => void) | undefined;
  /**
   * Callback function that is fired when the value is committed.
   * It runs later than `onValueChange`, when:
   * - The input is blurred after typing a value.
   * - The pointer is released after scrubbing or pressing the increment/decrement buttons.
   *
   * It runs simultaneously with `onValueChange` when interacting with the keyboard or the
   * mouse wheel.
   *
   * **Warning**: This is a generic event not a change event.
   */
  onValueCommitted?:
    ((value: number | null, eventDetails: NumberFieldRoot.CommitEventDetails) => void) | undefined;
  /**
   * The locale of the input element.
   * Defaults to the user's runtime locale.
   */
  locale?: Intl.LocalesArgument | undefined;
  /**
   * A ref to access the hidden input element.
   */
  inputRef?: RefInput<HTMLInputElement> | undefined;
}

export interface NumberFieldRootState extends FieldRootState {
  /**
   * The raw numeric value of the field.
   */
  value: number | null;
  /**
   * The formatted string value presented in the input element.
   */
  inputValue: string;
  /**
   * Whether the user must enter a value before submitting a form.
   */
  required: boolean;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Whether the user should be unable to change the field value.
   */
  readOnly: boolean;
  /**
   * Whether the user is currently scrubbing the field.
   */
  scrubbing: boolean;
}

export type NumberFieldRootChangeEventReason =
  | typeof REASONS.inputChange
  | typeof REASONS.inputClear
  | typeof REASONS.inputBlur
  | typeof REASONS.inputPaste
  | typeof REASONS.keyboard
  | typeof REASONS.incrementPress
  | typeof REASONS.decrementPress
  | typeof REASONS.wheel
  | typeof REASONS.scrub
  | typeof REASONS.none;
export type NumberFieldRootChangeEventDetails = BaseUIChangeEventDetails<
  NumberFieldRootChangeEventReason,
  ChangeEventCustomProperties
>;

// `none` is kept for consistency with other components even though the number field never
// commits with it.
export type NumberFieldRootCommitEventReason =
  | typeof REASONS.inputBlur
  | typeof REASONS.inputClear
  | typeof REASONS.keyboard
  | typeof REASONS.incrementPress
  | typeof REASONS.decrementPress
  | typeof REASONS.wheel
  | typeof REASONS.scrub
  | typeof REASONS.none;
export type NumberFieldRootCommitEventDetails =
  BaseUIGenericEventDetails<NumberFieldRoot.CommitEventReason>;

export namespace NumberFieldRoot {
  export type State = NumberFieldRootState;
  export type Props = NumberFieldRootProps;
  export type ChangeEventReason = NumberFieldRootChangeEventReason;
  export type ChangeEventDetails = NumberFieldRootChangeEventDetails;
  export type CommitEventReason = NumberFieldRootCommitEventReason;
  export type CommitEventDetails = NumberFieldRootCommitEventDetails;
}
