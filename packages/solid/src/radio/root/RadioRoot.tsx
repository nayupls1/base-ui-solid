import { createEffect, createMemo, omit, untrack } from 'solid-js';
import { spread } from '@solidjs/web';
import { createSyncSignal } from '@base-ui-solid/utils/createSyncSignal';
import { visuallyHiddenInput, visuallyHiddenInputPinned } from '@base-ui-solid/utils/visuallyHidden';
import { EMPTY_OBJECT } from '@base-ui-solid/utils/empty';
import type { BaseUIComponentProps, HTMLProps, NonNativeButtonProps } from '../../internals/types';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { NOOP } from '../../internals/noop';
import { stateAttributesMapping } from '../utils/stateAttributesMapping';
import { dispatchClickWithModifiers } from '../../utils/dispatchClickWithModifiers';
import { useBaseUiId } from '../../internals/useBaseUiId';
import { assignRefs, useRenderElement, type RefInput } from '../../internals/useRenderElement';
import { useButton } from '../../internals/use-button';
import { ACTIVE_COMPOSITE_ITEM } from '../../internals/composite/constants';
import { CompositeItem } from '../../internals/composite/item/CompositeItem';
import type { FieldRootState } from '../../field/root/FieldRoot';
import { useFieldRootContext } from '../../internals/field-root-context/FieldRootContext';
import { useSetFieldFocused } from '../../internals/field-root-context/useSetFieldFocused';
import { useFieldItemContext } from '../../field/item/FieldItemContext';
import { useLabelableContext } from '../../internals/labelable-provider/LabelableContext';
import { useAriaLabelledBy } from '../../internals/labelable-provider/useAriaLabelledBy';
import { resolveRenderedAriaLabel } from '../../internals/resolveRenderedAriaLabel';
import { useLabelableId } from '../../internals/labelable-provider/useLabelableId';
import { useRadioGroupContext } from '../../radio-group/RadioGroupContext';
import { serializeValue } from '../../internals/serializeValue';
import { handleHiddenInputInvalid } from '../../internals/handleHiddenInputInvalid';
import { syncCheckedState } from '../../internals/syncCheckedState';
import { RadioRootContext } from './RadioRootContext';

/**
 * Represents the radio button itself.
 * Renders a `<span>` element and a hidden `<input>` beside.
 *
 * Documentation: [Base UI Radio](https://base-ui.com/react/components/radio-group)
 */
export function RadioRoot<Value>(componentProps: RadioRoot.Props<Value>) {
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'disabled',
    'readOnly',
    'required',
    'aria-labelledby',
    'value',
    'inputRef',
    'nativeButton',
    'id',
    'style',
    'children',
    'ref',
  );

  const groupContext = useRadioGroupContext();
  const setCheckedValue = groupContext?.setCheckedValue ?? NOOP;
  const setTouched = groupContext?.setTouched ?? NOOP;
  const registerInputRef = groupContext?.registerInputRef ?? NOOP;
  const validation = groupContext?.validation;

  const field = useFieldRootContext();
  const fieldItemContext = useFieldItemContext();
  const labelable = useLabelableContext();

  const nativeButton = () => componentProps.nativeButton ?? false;
  const disabled = () =>
    Boolean(
      field.disabled ||
        fieldItemContext.disabled ||
        groupContext?.disabled ||
        (componentProps.disabled ?? false),
    );
  const readOnly = () => Boolean(groupContext?.readOnly || (componentProps.readOnly ?? false));
  const required = () => Boolean(groupContext?.required || (componentProps.required ?? false));
  const form = () => groupContext?.form;
  const name = () => groupContext?.name;

  const checked = createMemo(() =>
    groupContext ? groupContext.checkedValue === componentProps.value : componentProps.value === '',
  );

  const radioRef = { current: null as HTMLElement | null };
  const [radioElement, setRadioElement] = createSyncSignal<HTMLElement | null>(null);
  const setFieldFocused = useSetFieldFocused(disabled, radioElement);
  const [inputElement, setInputElement] = createSyncSignal<HTMLInputElement | null>(null);

  let unregisterFieldInput: void | (() => void);
  let unregisterGroupInput: void | (() => void);
  const mergedInputRef = (element: HTMLInputElement | null) => {
    assignRefs(componentProps.inputRef as RefInput<HTMLInputElement | null>, element);
    setInputElement(element);
    unregisterFieldInput?.();
    unregisterFieldInput = undefined;
    if (element) {
      unregisterFieldInput = validation?.registerInput(element, {
        controlRef: radioRef,
        value: undefined,
      });
    }
  };

  createEffect(inputElement, (input) => {
    if (input?.checked) {
      field.setFilled(true);
    }
  });

  createEffect(
    () => [checked(), disabled(), inputElement()] as const,
    ([isChecked, isDisabled, input]) => {
      if (!input) {
        return undefined;
      }

      unregisterGroupInput?.();
      unregisterGroupInput = undefined;

      if (isDisabled && isChecked) {
        registerInputRef(null);
        return undefined;
      }

      unregisterGroupInput = registerInputRef(input);
      return () => {
        unregisterGroupInput?.();
        unregisterGroupInput = undefined;
      };
    },
  );

  const id = useBaseUiId();
  const inputId = useLabelableId({
    get id() {
      return componentProps.id;
    },
  });
  const hiddenInputId = () => (nativeButton() ? undefined : inputId());
  const ariaLabelledBy = useAriaLabelledBy(
    () => componentProps['aria-labelledby'],
    () => labelable.labelId,
    inputElement,
    () => !nativeButton(),
    hiddenInputId,
    () => resolveRenderedAriaLabel(componentProps),
  );

  const rootProps: HTMLProps = {
    role: 'radio',
    get 'aria-checked'() {
      return checked();
    },
    get 'aria-labelledby'() {
      return ariaLabelledBy();
    },
    get [ACTIVE_COMPOSITE_ITEM]() {
      return checked() ? '' : undefined;
    },
    get id() {
      return nativeButton() ? inputId() : id();
    },
    onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Enter') {
        event.preventDefault();
      }
    },
    onClick(event: MouseEvent) {
      if (event.defaultPrevented || disabled() || readOnly()) {
        return;
      }

      event.preventDefault();

      const input = inputElement();
      if (!input) {
        return;
      }

      dispatchClickWithModifiers(input, event);
    },
    onFocus(event: FocusEvent) {
      setFieldFocused(true);

      if (event.defaultPrevented || disabled() || readOnly() || !(groupContext?.touched ?? false)) {
        return;
      }

      inputElement()?.click();

      setTouched(false);
    },
    onBlur() {
      if (!groupContext) {
        setFieldFocused(false);
      }
    },
  };

  const groupDisabledProps = {
    get tabindex() {
      return groupContext?.disabled ? -1 : undefined;
    },
  };

  const { getButtonProps, buttonRef } = useButton({
    get disabled() {
      return disabled();
    },
    get native() {
      return nativeButton();
    },
    composite: false,
  });

  const state = createMemo<RadioRootState>(() => ({
    ...field.state,
    required: required(),
    disabled: disabled(),
    readOnly: readOnly(),
    checked: checked(),
  }));

  const isRadioGroup = groupContext !== undefined;

  const refs = [
    (el: HTMLElement | null) => {
      radioRef.current = el;
      setRadioElement(el);
    },
    buttonRef,
  ];
  const props = [
    rootProps,
    (merged: HTMLProps) => {
      if (!groupContext?.disabled) {
        return merged;
      }
      return { ...merged, tabindex: groupDisabledProps.tabindex };
    },
    elementProps,
    getButtonProps,
    labelable.getDescriptionProps,
    validation
      ? (validationProps: HTMLProps) => validation.getValidationProps(disabled(), validationProps)
      : EMPTY_OBJECT,
  ];

  const input = document.createElement('input');
  spread(
    input,
    () => ({
      type: 'radio',
      ref: mergedInputRef,
      form: form(),
      id: hiddenInputId(),
      name: name(),
      tabindex: -1,
      style: name() ? visuallyHiddenInput : visuallyHiddenInputPinned,
      onInvalid: handleHiddenInputInvalid,
      'aria-hidden': 'true',
      ...(componentProps.value !== undefined
        ? { value: serializeValue(componentProps.value) }
        : EMPTY_OBJECT),
      disabled: disabled(),
      checked: checked(),
      required: required(),
      readonly: readOnly(),
      onChange(event: Event & { currentTarget: HTMLInputElement }) {
        if (event.defaultPrevented) {
          return;
        }

        const target = event.currentTarget;

        if (disabled() || readOnly() || componentProps.value === undefined) {
          syncCheckedState(target, checked);
          return;
        }

        const details = createChangeEventDetails(REASONS.none, event);

        setCheckedValue(componentProps.value, details);

        syncCheckedState(target, checked);

        if (details.isCanceled) {
          return;
        }

        field.setTouched(true);
      },
      onClick(event: MouseEvent) {
        event.stopPropagation();
      },
      onFocus() {
        radioRef.current?.focus();
      },
    }),
    true,
  );

  const element = () =>
    isRadioGroup ? (
      <CompositeItem
        tag="span"
        render={componentProps.render}
        class={componentProps.class}
        style={componentProps.style}
        state={state()}
        refs={[...refs, componentProps.ref]}
        props={props}
        stateAttributesMapping={stateAttributesMapping}
      >
        {componentProps.children}
      </CompositeItem>
    ) : (
      useRenderElement('span', componentProps, {
        state,
        ref: refs,
        props,
        stateAttributesMapping,
      })
    );

  return (
    <RadioRootContext value={state}>
      {untrack(element)}
      {untrack(() => input)}
    </RadioRootContext>
  );
}

export interface RadioRootState extends FieldRootState {
  /**
   * Whether the radio button is currently selected.
   */
  checked: boolean;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Whether the user should be unable to select the radio button.
   */
  readOnly: boolean;
  /**
   * Whether the user must choose a value before submitting a form.
   */
  required: boolean;
  /**
   * Whether the radio button has been touched (when wrapped in Field.Root).
   */
  touched: boolean;
  /**
   * Whether the radio button's value has changed from its initial value (when wrapped in Field.Root).
   */
  dirty: boolean;
  /**
   * Whether the radio button is in a valid state (when wrapped in Field.Root).
   */
  valid: boolean | null;
  /**
   * Whether the radio button has a value (when wrapped in Field.Root).
   */
  filled: boolean;
  /**
   * Whether the radio button is focused (when wrapped in Field.Root).
   */
  focused: boolean;
}

export interface RadioRootProps<Value = any>
  extends NonNativeButtonProps, Omit<BaseUIComponentProps<'span', RadioRootState>, 'value'> {
  /**
   * The unique identifying value of the radio in a group.
   */
  value: Value;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled?: boolean | undefined;
  /**
   * Whether the user must choose a value before submitting a form.
   */
  required?: boolean | undefined;
  /**
   * Whether the user should be unable to select the radio button.
   */
  readOnly?: boolean | undefined;
  /**
   * A ref to access the hidden input element.
   */
  inputRef?: RefInput<HTMLInputElement> | undefined;
}

export namespace RadioRoot {
  export type State = RadioRootState;
  export type Props<TValue = any> = RadioRootProps<TValue>;
}
