import { createEffect, createMemo, createSignal, omit, untrack } from 'solid-js';
import { warn } from 'base-ui-solidjs-utils/warn';
import { platform } from 'base-ui-solidjs-utils/platform';
import { createSyncSignal } from 'base-ui-solidjs-utils/createSyncSignal';
import { stopEvent } from '../../utils/popups/event';
import { useCompositeListItem } from '../../internals/composite/list/useCompositeListItem';
import type { BaseUIComponentProps } from '../../internals/types';
import { useDirection } from '../../internals/direction-context/DirectionContext';
import { useSetFieldFocused } from '../../internals/field-root-context/useSetFieldFocused';
import { useRenderElement } from '../../internals/useRenderElement';
import {
  createChangeEventDetails,
  createGenericEventDetails,
} from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { useOTPFieldRootContext, getOTPFieldInputState } from '../root/OTPFieldRootContext';
import type { OTPFieldRootState } from '../root/OTPFieldRoot';
import { inputStateAttributesMapping } from '../utils/stateAttributesMapping';
import { normalizeOTPValueWithDetails, removeOTPCharacter, replaceOTPValue } from '../utils/otp';
import { ownedProps } from '../../internals/ownedProps';

/**
 * An individual OTP character input.
 * Renders an `<input>` element.
 *
 * Documentation: [Base UI OTP Field](https://base-ui.com/react/components/otp-field)
 */
export function OTPFieldInput(componentProps: OTPFieldInput.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(
    componentProps,
    'aria-label',
    'aria-labelledby',
    'render',
    'class',
    'style',
    'children',
    'ref',
  );

  const ctx = useOTPFieldRootContext();
  const { ref: listItemRef, index } = useCompositeListItem({ guess: true });

  const [input, setInput] = createSyncSignal<HTMLInputElement | null>(null);
  const setFocused = useSetFieldFocused(() => ctx.disabled, input, ctx.setFocused as any);
  const direction = useDirection();

  // While an IME composition is active, Safari exposes the in-progress text through input events
  // as an accumulating string. Committing those intermediate values would fill too many slots,
  // so the text is only buffered here and committed once on `compositionend`.
  const [composingValue, setComposingValue] = createSyncSignal<string | null>(null);

  const slotValue = () => ctx.value[index()] ?? '';
  const inputState = createMemo(() => getOTPFieldInputState(ctx.state, slotValue(), index()));

  const inheritedLabel = () => componentProps['aria-labelledby'] ?? ctx.inputAriaLabelledBy;
  const ariaLabel = () => (index() === 0 ? undefined : componentProps['aria-label']);

  if (process.env.NODE_ENV !== 'production') {
    createEffect(
      () => [index(), componentProps['aria-label'], input()] as const,
      ([currentIndex, slotAriaLabel, inputElement]) => {
        if (currentIndex !== 0 || slotAriaLabel == null || inputElement?.labels?.length) {
          return;
        }

        warn(
          '<OTPField.Input> ignores `aria-label` on the first input. Use a `<label>` or `<Field.Label>` to label the OTP field.',
        );
      },
    );
  }

  function commitValue(
    rawValue: string,
    reason: typeof REASONS.inputChange | typeof REASONS.inputPaste,
    event: Event & { currentTarget: HTMLInputElement },
  ) {
    const [nextDigits, didRejectCharacters] = normalizeOTPValueWithDetails(
      rawValue,
      ctx.length,
      ctx.validationType,
      ctx.normalizeValue,
    );

    if (didRejectCharacters) {
      ctx.reportValueInvalid(rawValue, createGenericEventDetails(reason, event) as any);
    }

    if (nextDigits === '') {
      // Typed input edits the slot in place: clear it, or restore its character when every
      // typed character was rejected. An empty or fully rejected paste changes nothing.
      if (reason === REASONS.inputChange) {
        if (rawValue === '') {
          ctx.setValue(
            removeOTPCharacter(ctx.value, index()),
            createChangeEventDetails(REASONS.inputClear, event) as any,
          );
        } else if (slotValue() !== '') {
          event.currentTarget.value = slotValue();
          event.currentTarget.select();
        }
      }
      return;
    }

    const committedValue = ctx.setValue(
      replaceOTPValue(ctx.value, index(), nextDigits, ctx.length, ctx.validationType, ctx.normalizeValue),
      createChangeEventDetails(reason, event) as any,
    );

    if (committedValue != null) {
      ctx.queueFocusInput(Math.min(index() + nextDigits.length, ctx.length - 1), committedValue);
    }
  }

  const inputProps = {
    get id() {
      return ctx.getInputId(index());
    },
    get value() {
      return composingValue() ?? slotValue();
    },
    get type() {
      return ctx.mask ? 'password' : 'text';
    },
    get inputmode() {
      return ctx.inputMode;
    },
    get autocomplete() {
      return index() === 0 ? ctx.autoComplete : 'off';
    },
    autocorrect: 'off',
    spellcheck: 'false',
    get enterkeyhint() {
      return index() === ctx.length - 1 ? 'done' : 'next';
    },
    // Only the first slot has a max length to avoid password manager bubbles appearing after
    // later inputs.
    get maxlength() {
      return index() === 0 ? ctx.length : undefined;
    },
    get tabindex() {
      return ctx.activeIndex === index() ? 0 : -1;
    },
    get disabled() {
      return ctx.disabled;
    },
    get form() {
      return ctx.form;
    },
    get pattern() {
      return ctx.pattern;
    },
    get readonly() {
      return ctx.readOnly;
    },
    get required() {
      return ctx.required;
    },
    get 'aria-labelledby'() {
      return ariaLabel() == null ? inheritedLabel() : undefined;
    },
    get 'aria-invalid'() {
      return !ctx.disabled && ctx.invalid ? true : undefined;
    },
    get 'aria-label'() {
      return ariaLabel();
    },
    onMouseDown(event: MouseEvent) {
      if (event.defaultPrevented || ctx.disabled) {
        return;
      }

      event.preventDefault();
      ctx.focusInput(index());
    },
    onFocus(event: FocusEvent) {
      if (event.defaultPrevented || ctx.disabled) {
        return;
      }

      setFocused(true);
      ctx.handleInputFocus(index(), event);
    },
    onBlur(event: FocusEvent) {
      if (event.defaultPrevented) {
        return;
      }

      // Focus moving to a sibling slot stays inside the root; `ctx.handleInputBlur` clears the
      // focused state only when focus leaves the root, so slot-to-slot moves don't churn it.
      ctx.handleInputBlur(event);
    },
    onCompositionStart() {
      // Some Android keyboards report all text as always-composing, so Android keeps
      // committing through `onChange`.
      if (!platform.os.android) {
        setComposingValue(slotValue());
      }
    },
    onCompositionEnd(event: CompositionEvent & { currentTarget: HTMLInputElement }) {
      if (composingValue() == null) {
        return;
      }

      setComposingValue(null);

      if (!ctx.disabled && !ctx.readOnly) {
        commitValue(event.currentTarget.value, REASONS.inputChange, event);
      }
    },
    onInput(event: InputEvent & { currentTarget: HTMLInputElement }) {
      if (event.defaultPrevented || ctx.disabled || ctx.readOnly) {
        return;
      }

      if (composingValue() != null) {
        setComposingValue(event.currentTarget.value);
        return;
      }

      commitValue(event.currentTarget.value, REASONS.inputChange, event);
      // Solid doesn't revert a controlled input, so resync the slot with the committed value.
      const expected = ctx.value[index()] ?? '';
      if (event.currentTarget.value !== expected) {
        event.currentTarget.value = expected;
      }
    },
    onKeyDown(event: KeyboardEvent & { currentTarget: HTMLInputElement }) {
      // Browsers deliver real key names (such as `Backspace`) for keydowns inside a composition.
      // The IME owns editing until `compositionend`, so OTP commands must not run on them.
      if (event.defaultPrevented || ctx.disabled || composingValue() != null) {
        return;
      }

      const firstIndex = 0;
      const lastIndex = Math.max(ctx.length - 1, firstIndex);
      const endTargetIndex = Math.min(ctx.value.length, lastIndex);
      const hasBoundaryModifier = (event.ctrlKey || event.metaKey) && !event.altKey;
      const isRtl = direction() === 'rtl';
      const previousKey = isRtl ? 'ArrowRight' : 'ArrowLeft';
      const nextKey = isRtl ? 'ArrowLeft' : 'ArrowRight';

      if (event.key === previousKey) {
        stopEvent(event);
        ctx.focusInput(hasBoundaryModifier ? firstIndex : Math.max(firstIndex, index() - 1));
        return;
      }

      if (event.key === nextKey) {
        stopEvent(event);
        ctx.focusInput(hasBoundaryModifier ? endTargetIndex : Math.min(lastIndex, index() + 1));
        return;
      }

      if (event.key === 'Home' || event.key === 'ArrowUp') {
        stopEvent(event);
        ctx.focusInput(firstIndex);
        return;
      }

      if (event.key === 'End' || event.key === 'ArrowDown') {
        stopEvent(event);
        ctx.focusInput(endTargetIndex);
        return;
      }

      if (ctx.readOnly) {
        return;
      }

      function setKeyboardValue(nextValue: string, targetIndex: number) {
        const committedValue = ctx.setValue(
          nextValue,
          createChangeEventDetails(REASONS.keyboard, event) as any,
        );

        if (committedValue != null) {
          ctx.queueFocusInput(targetIndex, committedValue);
        }
      }

      if (event.key === 'Backspace' && hasBoundaryModifier) {
        stopEvent(event);
        setKeyboardValue('', firstIndex);
        return;
      }

      if (event.key === 'Delete') {
        stopEvent(event);
        setKeyboardValue(removeOTPCharacter(ctx.value, index()), index());
        return;
      }

      const inputValue = event.currentTarget.value;
      const fullSelection =
        event.currentTarget.selectionStart === 0 &&
        event.currentTarget.selectionEnd === inputValue.length;

      if (event.key.length === 1 && fullSelection && slotValue() === event.key) {
        stopEvent(event);
        if (index() < ctx.length - 1) {
          ctx.focusInput(index() + 1);
        }
        return;
      }

      if (event.key === 'Backspace') {
        stopEvent(event);
        const targetIndex = Math.max(firstIndex, index() - 1);
        const deleteIndex = slotValue() === '' ? targetIndex : index();
        setKeyboardValue(removeOTPCharacter(ctx.value, deleteIndex), targetIndex);
      }
    },
    onPaste(event: ClipboardEvent & { currentTarget: HTMLInputElement }) {
      if (event.defaultPrevented || ctx.disabled || ctx.readOnly) {
        return;
      }

      let rawValue = '';

      try {
        rawValue = event.clipboardData?.getData('text/plain') ?? '';
      } catch {
        /* istanbul ignore else -- `process.env.NODE_ENV` is a build-time constant under test */
        if (process.env.NODE_ENV !== 'production') {
          warn(
            '<OTPField.Input> could not read clipboard text during paste handling.',
          );
        }

        return;
      }

      event.preventDefault();
      commitValue(rawValue, REASONS.inputPaste, event);
    },
  } as any;

  return useRenderElement('input', componentProps, {
    ref: [
      listItemRef,
      (el: HTMLInputElement | null) => {
        setInput(el);
      },
    ],
    state: inputState,
    props: [inputProps, elementProps],
    stateAttributesMapping: inputStateAttributesMapping as any,
  });
}

export interface OTPFieldInputState extends Omit<OTPFieldRootState, 'filled' | 'value'> {
  /**
   * Whether this input contains a character.
   */
  filled: boolean;
  /**
   * The input index.
   */
  index: number;
  /**
   * The character rendered in this slot.
   */
  value: string;
}

export interface OTPFieldInputProps extends BaseUIComponentProps<
  'input',
  OTPFieldInputState,
  JSX.IntrinsicElements['input']
> {}

export namespace OTPFieldInput {
  export type State = OTPFieldInputState;
  export type Props = OTPFieldInputProps;
}
