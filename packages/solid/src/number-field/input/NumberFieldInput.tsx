import type { JSX } from '@solidjs/web';
import { createEffect, createMemo, omit, untrack } from 'solid-js';
import { warn } from 'base-ui-solidjs-utils/warn';
import { formatNumber } from 'base-ui-solidjs-utils/formatNumber';
import { useNumberFieldRootContext } from '../root/NumberFieldRootContext';
import type { BaseUIComponentProps } from '../../internals/types';
import { useFieldRootContext } from '../../internals/field-root-context/FieldRootContext';
import { useSetFieldFocused } from '../../internals/field-root-context/useSetFieldFocused';
import { useRegisterFieldControl } from '../../internals/field-register-control/useRegisterFieldControl';
import { useFormContext } from '../../internals/form-context/FormContext';
import { useLabelableContext } from '../../internals/labelable-provider/LabelableContext';
import {
  getNumberLocaleDetails,
  isNumeralChar,
  parseNumber,
  ANY_MINUS_RE,
  ANY_PLUS_RE,
  ANY_MINUS_DETECT_RE,
  ANY_PLUS_DETECT_RE,
  FORMAT_CONTROL_DETECT_RE,
} from '../utils/parse';
import type { NumberFieldRootState } from '../root/NumberFieldRoot';
import { stateAttributesMapping } from '../utils/stateAttributesMapping';
import { useRenderElement } from '../../internals/useRenderElement';
import {
  createChangeEventDetails,
  createGenericEventDetails,
} from '../../internals/createBaseUIEventDetails';
import { useValueChanged } from '../../internals/useValueChanged';
import { REASONS } from '../../internals/reasons';
import { hasNumberFormatRoundingOptions, removeFloatingPointErrors } from '../utils/validate';
import { ownedProps } from '../../internals/ownedProps';

const NAVIGATE_KEYS = new Set([
  'Backspace',
  'Delete',
  'ArrowLeft',
  'ArrowRight',
  'Tab',
  'Enter',
  'Escape',
]);

/**
 * The native input control in the number field.
 * Renders an `<input>` element.
 *
 * Documentation: [Base UI Number Field](https://base-ui.com/react/components/number-field)
 */
export function NumberFieldInput(componentProps: NumberFieldInput.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'children', 'ref');

  const ctx = useNumberFieldRootContext();
  const { clearErrors } = useFormContext();
  const field = useFieldRootContext();
  const labelable = useLabelableContext();

  const disabled = () => ctx.state.disabled;
  const setFocused = useSetFieldFocused(disabled, () => ctx.inputRef.current);

  let blockRevalidation = false;
  const blockRevalidationRef = {
    get current() {
      return blockRevalidation;
    },
    set current(value: boolean) {
      blockRevalidation = value;
    },
  };
  let pendingCaret: number | null = null;
  const pendingCaretRef = {
    get current() {
      return pendingCaret;
    },
    set current(value: number | null) {
      pendingCaret = value;
    },
  };

  useRegisterFieldControl(
    ctx.inputRef as any,
    () => ctx.id as any,
    () => ctx.state.value,
    undefined,
    () => !ctx.state.disabled,
    () => ctx.nameProp,
  );

  // After a paste splices text into the controlled value, the browser would otherwise drop the
  // caret at the end of the new value. Restore it just after the inserted text.
  createEffect(
    () => ctx.state.inputValue,
    () => {
      if (pendingCaret != null) {
        const caret = pendingCaret;
        pendingCaret = null;
        ctx.inputRef.current?.setSelectionRange(caret, caret);
      }
    },
  );

  useValueChanged(
    () => ctx.state.value,
    () => {
      clearErrors(ctx.name);

      if (blockRevalidation && !field.shouldValidateOnChange()) {
        blockRevalidation = false;
        return;
      }

      field.validation.change(untrack(() => ctx.state.value));
    },
  );

  const inputProps = {
    get id() {
      return ctx.id;
    },
    get form() {
      return ctx.form;
    },
    get required() {
      return ctx.state.required;
    },
    get disabled() {
      return ctx.state.disabled;
    },
    get readonly() {
      return ctx.state.readOnly;
    },
    get inputmode() {
      return ctx.inputMode;
    },
    get value() {
      return ctx.state.inputValue;
    },
    type: 'text',
    autocomplete: 'off',
    autocorrect: 'off',
    spellcheck: 'false',
    'aria-roledescription': 'Number field',
    get 'aria-invalid'() {
      return !ctx.state.disabled && field.invalid ? true : undefined;
    },
    get 'aria-labelledby'() {
      return labelable.labelId;
    },
    onFocus(event: FocusEvent) {
      // Read-only inputs are still focusable; only the ctx.state.value-changing handlers stay gated on it.
      if (event.defaultPrevented || ctx.state.disabled) {
        return;
      }

      setFocused(true);
    },
    onBlur(event: FocusEvent) {
      if (event.defaultPrevented || ctx.state.disabled) {
        return;
      }

      field.setTouched(true);
      setFocused(false);

      if (ctx.state.readOnly) {
        return;
      }

      const hadManualInput = !ctx.allowInputSyncRef.current;
      const hadPendingProgrammaticChange = ctx.hasPendingCommitRef.current;

      ctx.allowInputSyncRef.current = true;

      if (ctx.state.inputValue.trim() === '') {
        const clearDetails = createChangeEventDetails(REASONS.inputClear, event) as any;
        ctx.setValue(null, clearDetails);
        // Respect a canceled clear, mirroring the non-empty blur path below.
        if (clearDetails.isCanceled) {
          return;
        }
        if (field.validationMode === 'onBlur') {
          field.validation.commit(null);
        }
        // Don't report a commit when blurring an already-empty field that the user never
        // interacted with: nothing was cleared and no programmatic change is pending.
        if (hadManualInput || hadPendingProgrammaticChange || ctx.state.value !== null) {
          ctx.onValueCommitted(null, createGenericEventDetails(REASONS.inputClear, event) as any);
        }
        return;
      }

      const formatOptions = ctx.formatOptionsRef.current;

      // Without a manual edit, the visible text is purely formatted display, so keep the
      // authoritative numeric ctx.state.value rather than re-parsing it: rounded text discards precision,
      // and compact text (`1.2K`) can't be reversed (e.g. focus/blur with no edits, or blur after
      // a programmatic change).
      let committed = hadManualInput ? parseNumber(ctx.state.inputValue, ctx.locale, formatOptions) : ctx.state.value;
      if (hadManualInput && committed === null) {
        return;
      }

      // Explicit rounding options apply to the committed ctx.state.value, whether typed or external. Avoid
      // applying Intl's default precision unless the format opts into rounding.
      if (committed !== null && hasNumberFormatRoundingOptions(formatOptions)) {
        committed = removeFloatingPointErrors(committed, formatOptions);
      }

      const nextEventDetails = createGenericEventDetails(REASONS.inputBlur, event) as any;
      // A `NaN` ctx.state.value never equals itself, so don't treat it as changed on every blur
      const shouldUpdateValue = ctx.state.value !== committed && !Number.isNaN(committed);
      const shouldCommit = hadManualInput || shouldUpdateValue || hadPendingProgrammaticChange;

      // Use the stored ctx.state.value after `ctx.setValue` clamps it.
      let committedValue = committed;
      if (shouldUpdateValue) {
        const changeDetails = createChangeEventDetails(REASONS.inputBlur, event) as any;
        blockRevalidationRef.current = true;
        ctx.setValue(committed, changeDetails);
        if (changeDetails.isCanceled) {
          blockRevalidationRef.current = false;
          return;
        }
        committedValue = ctx.lastChangedValueRef.current;
        // If field.validation normalized back to the current ctx.state.value, `useValueChanged` won't fire to
        // reset the flag, so reset it here or the next external change won't revalidate.
        if (committedValue === ctx.state.value) {
          blockRevalidationRef.current = false;
        }
      }
      if (field.validationMode === 'onBlur') {
        field.validation.commit(committedValue);
      }
      if (shouldCommit) {
        ctx.onValueCommitted(committedValue, nextEventDetails);
      }

      // Normalize only the displayed text
      const canonicalText = formatNumber(committedValue, ctx.locale, formatOptions);
      if (ctx.state.inputValue !== canonicalText) {
        ctx.setInputValue(canonicalText);
      }
    },
    onInput(event: InputEvent) {
      // Workaround for https://github.com/react/react/issues/9023
      if (event.defaultPrevented) {
        return;
      }

      const targetValue = (event.currentTarget as HTMLInputElement).value;

      if (targetValue.trim() === '') {
        ctx.allowInputSyncRef.current = false;
        ctx.setInputValue(targetValue);
        ctx.setValue(null, createChangeEventDetails(REASONS.inputClear, event) as any);
        return;
      }

      // Update the input text immediately and only fire onValueChange if the typed ctx.state.value is
      // currently parseable into a number. This preserves good UX for IME
      // composition/partial input while still providing live numeric updates when possible.
      const allowedNonNumericKeys = ctx.getAllowedNonNumericKeys();
      const isValidCharacterString = Array.from(targetValue).every(
        (ch) =>
          isNumeralChar(ch) ||
          ANY_MINUS_DETECT_RE.test(ch) ||
          allowedNonNumericKeys.has(ch) ||
          // Bidi/format controls are stripped by `parseNumber`; don't let them reject the string
          // (RTL locales insert them around exponent/currency signs, e.g. scientific notation).
          FORMAT_CONTROL_DETECT_RE.test(ch),
      );

      // A rejected change leaves the synced text in place, so it doesn't count as a manual edit.
      // Solid doesn't revert a controlled input, so restore the text manually.
      if (!isValidCharacterString) {
        (event.currentTarget as HTMLInputElement).value = ctx.state.inputValue;
        return;
      }

      ctx.allowInputSyncRef.current = false;
      const parsedValue = parseNumber(targetValue, ctx.locale, ctx.formatOptionsRef.current);

      ctx.setInputValue(targetValue);

      if (parsedValue !== null) {
        ctx.setValue(parsedValue, createChangeEventDetails(REASONS.inputChange, event) as any);
      }
    },
    onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || ctx.state.readOnly || ctx.state.disabled) {
        return;
      }

      const nativeEvent = event;

      // Snapshot the dirty state without clearing it: navigation/allowed keys (ArrowLeft, Tab,
      // Enter, Escape, …) return early without changing the ctx.state.value, so marking the input synced
      // here would wrongly discard dirty-input authority. Only the ctx.state.value-changing branches below
      // mark it synced.
      const hadManualInput = !ctx.allowInputSyncRef.current;

      const allowedNonNumericKeys = ctx.getAllowedNonNumericKeys();

      let isAllowedNonNumericKey = allowedNonNumericKeys.has(event.key);

      const { decimal, currency, percentSign } = getNumberLocaleDetails(
        ctx.locale,
        ctx.formatOptionsRef.current,
      );

      const selectionStart = (event.currentTarget as HTMLInputElement).selectionStart;
      const selectionEnd = (event.currentTarget as HTMLInputElement).selectionEnd;
      const isAllSelected = selectionStart === 0 && selectionEnd === ctx.state.inputValue.length;

      const selectionContainsIndex = (index: number) =>
        selectionStart != null &&
        selectionEnd != null &&
        index >= selectionStart &&
        index < selectionEnd;

      // Only allow a single sign character: permit it when there is no existing sign of either
      // kind, when all text is selected, or when the selection covers the existing sign so it's
      // being replaced.
      const signGroups = [
        [ANY_MINUS_DETECT_RE, ANY_MINUS_RE],
        [ANY_PLUS_DETECT_RE, ANY_PLUS_RE],
      ] as const;
      signGroups.forEach(([detectRe, globalRe]) => {
        if (
          detectRe.test(event.key) &&
          Array.from(allowedNonNumericKeys).some((k) => detectRe.test(k))
        ) {
          const existingIndex = ctx.state.inputValue.search(globalRe);
          const isReplacingExisting = existingIndex !== -1 && selectionContainsIndex(existingIndex);
          isAllowedNonNumericKey =
            !(ANY_MINUS_DETECT_RE.test(ctx.state.inputValue) || ANY_PLUS_DETECT_RE.test(ctx.state.inputValue)) ||
            isAllSelected ||
            isReplacingExisting;
        }
      });

      // Only allow one of each symbol.
      [decimal, currency, percentSign].forEach((symbol) => {
        if (event.key === symbol) {
          const symbolIndex = ctx.state.inputValue.indexOf(symbol);
          const isSymbolHighlighted = selectionContainsIndex(symbolIndex);
          isAllowedNonNumericKey = symbolIndex === -1 || isAllSelected || isSymbolHighlighted;
        }
      });

      const isNavigateKey = NAVIGATE_KEYS.has(event.key);
      // Alt+ArrowUp/ArrowDown selects smallStep, so don't treat it as a bypass modifier.
      const isStepKey = event.key === 'ArrowUp' || event.key === 'ArrowDown';

      if (
        // Allow composition events (e.g., pinyin)
        // event.isComposing does not work in Safari:
        // https://bugs.webkit.org/show_bug.cgi?id=165004
        event.which === 229 ||
        (event.altKey && !isStepKey) ||
        event.ctrlKey ||
        event.metaKey ||
        isAllowedNonNumericKey ||
        isNumeralChar(event.key) ||
        isNavigateKey
      ) {
        return;
      }

      // Home/End jump to the corresponding bound, but only when that bound is defined.
      let boundaryValue: number | null = null;
      if (event.key === 'Home' && ctx.min != null) {
        boundaryValue = ctx.min;
      } else if (event.key === 'End' && ctx.max != null) {
        boundaryValue = ctx.max;
      }

      // Let the browser handle multi-character keys we don't act on (PageUp, Insert, F-keys,
      // Home/End without ctx.min/ctx.max); invalid single characters are still blocked below.
      if (event.key.length > 1 && !isStepKey && boundaryValue === null) {
        return;
      }

      // Step from the authoritative numeric ctx.state.value unless the input has unsaved manual edits.
      // When the text is already synced, parsing the rounded display would collapse precision,
      // so pass no `currentValue` and let `ctx.incrementValue` fall back to the numeric state
      // (mirrors the button path).
      const currentValue = hadManualInput
        ? parseNumber(ctx.state.inputValue, ctx.locale, ctx.formatOptionsRef.current)
        : null;

      const amount = ctx.getStepAmount(event);

      // Prevent insertion of text or caret from moving.
      event.preventDefault();
      event.stopPropagation();

      const commitDetails = createGenericEventDetails(REASONS.keyboard, nativeEvent) as any;

      let changed = false;
      if (isStepKey || boundaryValue !== null) {
        ctx.allowInputSyncRef.current = true;
      }
      if (isStepKey) {
        // When stepping from the synced numeric state, refresh the commit ref to the current
        // ctx.state.value so a canceled step can't commit a stale `ctx.lastChangedValueRef` left over from an
        // earlier change (mirrors the button path).
        if (!hadManualInput) {
          ctx.lastChangedValueRef.current = ctx.valueRef.current;
        }

        changed = ctx.incrementValue(amount, {
          direction: event.key === 'ArrowUp' ? 1 : -1,
          currentValue,
          event: nativeEvent,
          reason: REASONS.keyboard,
        });
      } else if (boundaryValue !== null) {
        changed = ctx.setValue(boundaryValue, createChangeEventDetails(REASONS.keyboard, nativeEvent) as any);
      }

      // `changed` is only true when `ctx.setValue` applied the change, which records the stored
      // (clamped/snapped) ctx.state.value, so commit that rather than the pre-field.validation input.
      if (changed) {
        ctx.onValueCommitted(ctx.lastChangedValueRef.current, commitDetails);
      }
    },
    onPaste(event: ClipboardEvent) {
      if (event.defaultPrevented || ctx.state.readOnly || ctx.state.disabled) {
        return;
      }

      let pastedData = '';

      try {
        pastedData = event.clipboardData?.getData('text/plain') ?? '';
      } catch {
        /* istanbul ignore else -- `process.env.NODE_ENV` is a build-time constant under test */
        if (process.env.NODE_ENV !== 'production') {
          warn(
            '<NumberField.Input> could not read clipboard text during paste handling.',
          );
        }

        return;
      }

      // Prevent `onChange` from being called.
      event.preventDefault();

      // Insert the pasted text at the caret/selection instead of replacing the entire ctx.state.value,
      // matching native input behavior (e.g. pasting "5" into "123|" yields "1235").
      // The component renders `type="text"`, which always reports a selection range. Overriding
      // `type` with a selection-less one (`email`, `number`) is unsupported either way: the caret
      // restore above throws on those, so there is no working behavior to preserve here.
      const input = event.currentTarget as HTMLInputElement;
      const selectionStart = input.selectionStart!;
      const selectionEnd = input.selectionEnd!;
      const nextText =
        ctx.state.inputValue.slice(0, selectionStart) + pastedData + ctx.state.inputValue.slice(selectionEnd);

      const parsedValue = parseNumber(nextText, ctx.locale, ctx.formatOptionsRef.current);

      if (parsedValue !== null) {
        ctx.allowInputSyncRef.current = false;
        pendingCaretRef.current = selectionStart + pastedData.length;
        ctx.setValue(parsedValue, createChangeEventDetails(REASONS.inputPaste, event) as any);
        ctx.setInputValue(nextText);
      }
    },
  } as any;

  return useRenderElement('input', componentProps, {
    ref: (el: HTMLInputElement | null) => {
      ctx.inputRef.current = el;
    },
    state: () => ctx.state,
    props: [
      inputProps,
      elementProps,
      (props: any) => field.validation.getValidationProps(ctx.state.disabled, props),
    ],
    stateAttributesMapping,
  });
}

export interface NumberFieldInputState extends NumberFieldRootState {}

export interface NumberFieldInputProps extends BaseUIComponentProps<
  'input',
  NumberFieldInputState,
  JSX.IntrinsicElements['input']
> {
  /**
   * A user-friendly description of the input's role for assistive tech. This is a role
   * description, not an accessible name — use `Field.Label` or `aria-label` to name the control.
   * @default 'Number field'
   */
  'aria-roledescription'?: string | undefined;
}

export namespace NumberFieldInput {
  export type State = NumberFieldInputState;
  export type Props = NumberFieldInputProps;
}
