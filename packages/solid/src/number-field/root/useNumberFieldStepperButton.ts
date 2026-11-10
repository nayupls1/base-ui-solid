import type { JSX } from '@solidjs/web';
import { createMemo, omit, untrack } from 'solid-js';
import type { BaseUIComponentProps, NativeButtonProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useButton } from '../../internals/use-button';
import { isTouchLikePointerType, usePressAndHold } from '../../internals/usePressAndHold';
import { parseNumber } from '../utils/parse';
import {
  createChangeEventDetails,
  createGenericEventDetails,
} from '../../internals/createBaseUIEventDetails';
import type { EventWithOptionalKeyState } from '../utils/types';
import type { NumberFieldRoot, NumberFieldRootState } from './NumberFieldRoot';
import { REASONS } from '../../internals/reasons';
import { useNumberFieldRootContext } from './NumberFieldRootContext';
import { stateAttributesMapping } from '../utils/stateAttributesMapping';
import { ownedProps } from '../../internals/ownedProps';

const SELECT_NONE_STYLE: JSX.CSSProperties = {
  '-webkit-user-select': 'none',
  'user-select': 'none',
};

type StepperButtonProps = NativeButtonProps & BaseUIComponentProps<'button', NumberFieldRootState>;

/**
 * Shared implementation for the increment and decrement stepper buttons. They differ only in the
 * direction they step and the boundary (`max` vs `min`) at which they become disabled.
 */
export function useNumberFieldStepperButton(
  componentProps: StepperButtonProps,
  isIncrement: boolean,
) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'disabled',
    'nativeButton',
    'style',
    'children',
    'ref',
  );

  const ctx = useNumberFieldRootContext();

  const isAtBoundary = () => {
    const value = ctx.state.value;
    return value != null && (isIncrement ? value >= ctx.maxWithDefault : value <= ctx.minWithDefault);
  };
  const disabled = () =>
    ((componentProps.disabled as boolean | undefined) ?? false) ||
    ctx.state.disabled ||
    isAtBoundary();

  const pressReason: NumberFieldRoot.ChangeEventReason = isIncrement
    ? REASONS.incrementPress
    : REASONS.decrementPress;

  function commitValue(nativeEvent: MouseEvent) {
    const shouldCommitInputValue = !ctx.allowInputSyncRef.current;
    ctx.allowInputSyncRef.current = true;

    if (!shouldCommitInputValue) {
      // The input is already synced, so step from the authoritative numeric value rather than
      // re-parsing the rounded display text. Refresh the commit ref to the current value so a
      // subsequent canceled step can't commit a stale `lastChangedValueRef`.
      ctx.lastChangedValueRef.current = ctx.valueRef.current;
      return;
    }

    // The input is dirty but not yet blurred, so the value won't have been committed.
    const parsedValue = parseNumber(ctx.state.inputValue, ctx.locale, ctx.formatOptionsRef.current);
    if (parsedValue !== null) {
      // Sync the dirty typed value with no direction so it isn't directionally snapped
      // (`snapOnStep`) before the real increment/decrement runs.
      const details = createChangeEventDetails(pressReason, nativeEvent);
      ctx.setValue(parsedValue, details as any);
      // Only sync the ref base when the commit wasn't canceled.
      if (!details.isCanceled) {
        ctx.valueRef.current = parsedValue;
      }
    }
  }

  const { pointerHandlers, shouldSkipClick } = usePressAndHold({
    get disabled() {
      return disabled() || ctx.state.readOnly;
    },
    elementRef: ctx.inputRef,
    tick(triggerEvent) {
      const amount = ctx.getStepAmount(triggerEvent as EventWithOptionalKeyState);
      return ctx.incrementValue(amount, {
        direction: isIncrement ? 1 : -1,
        event: triggerEvent,
        reason: pressReason,
      } as any);
    },
    onStop(nativeEvent: PointerEvent) {
      // `onStop` fires on every release; fall back to the current value when no tick changed it.
      const committed = ctx.lastChangedValueRef.current ?? ctx.valueRef.current;
      ctx.onValueCommitted(committed, createGenericEventDetails(pressReason, nativeEvent) as any);
    },
  });

  const props = {
    get disabled() {
      return disabled();
    },
    'aria-label': isIncrement ? 'Increase' : 'Decrease',
    get 'aria-controls'() {
      return ctx.id;
    },
    // Keyboard users shouldn't have access to the buttons, since they can use the input element
    // to change the value. `aria-hidden` is not applied because touch screen readers should be
    // able to use the buttons.
    tabindex: -1,
    style: SELECT_NONE_STYLE,
    ...pointerHandlers,
    onClick(event: MouseEvent) {
      const isDisabled = untrack(disabled) || ctx.state.readOnly;
      if (event.defaultPrevented || isDisabled || shouldSkipClick(event)) {
        return;
      }

      commitValue(event);

      const amount = ctx.getStepAmount(event);
      const prev = ctx.valueRef.current;

      ctx.incrementValue(amount, {
        direction: isIncrement ? 1 : -1,
        event,
        reason: pressReason,
      } as any);

      const committed = ctx.lastChangedValueRef.current ?? ctx.valueRef.current;
      if (committed !== prev) {
        ctx.onValueCommitted(committed, createGenericEventDetails(pressReason, event) as any);
      }
    },
    onPointerDown(event: PointerEvent) {
      if (event.defaultPrevented || ctx.state.readOnly || event.button || untrack(disabled)) {
        return;
      }

      // Sync dirty input value before starting the hold sequence.
      commitValue(event);

      // Treat `lastChangedValueRef` as a per-hold result slot. If the first tick is a no-op or is
      // canceled, `onStop` should fall back to the current value, not a previous interaction.
      ctx.lastChangedValueRef.current = null;

      if (!isTouchLikePointerType(event.pointerType)) {
        // Focus the input so the user can continue with keyboard interactions.
        ctx.focusInput();
      }

      pointerHandlers.onPointerDown(event);
    },
  };

  const { getButtonProps, buttonRef } = useButton({
    // Read-only steppers are exposed as unavailable through button disabled semantics, while
    // `data-readonly` (from `state`) is preserved for styling.
    get disabled() {
      return disabled() || ctx.state.readOnly;
    },
    get native() {
      return componentProps.nativeButton ?? true;
    },
    focusableWhenDisabled: true,
  });

  const buttonState = createMemo(() => ({ ...ctx.state, disabled: disabled() }));

  return useRenderElement('button', componentProps, {
    ref: buttonRef,
    state: buttonState,
    props: [props, elementProps, getButtonProps],
    stateAttributesMapping,
  });
}
