import { createEffect, createMemo, omit, Show, untrack } from 'solid-js';
import { spread } from '@solidjs/web';
import { EMPTY_OBJECT } from '@base-ui-solid/utils/empty';
import { useControlled } from '@base-ui-solid/utils/useControlled';
import { createSyncSignal } from '@base-ui-solid/utils/createSyncSignal';
import { visuallyHiddenInput, visuallyHiddenInputPinned } from '@base-ui-solid/utils/visuallyHidden';
import { ownerWindow } from '@base-ui-solid/utils/owner';
import { getDefaultFormSubmitter } from '@base-ui-solid/utils/getDefaultFormSubmitter';
import { getCheckboxStateAttributesMapping } from '../utils/getCheckboxStateAttributesMapping';
import { dispatchClickWithModifiers } from '../../utils/dispatchClickWithModifiers';
import { assignRefs, useRenderElement, type RefInput } from '../../internals/useRenderElement';
import { useBaseUiId } from '../../internals/useBaseUiId';
import type {
  BaseUIComponentProps,
  BaseUIEvent,
  NonNativeButtonProps,
} from '../../internals/types';
import { mergeProps } from '../../merge-props';
import { useButton } from '../../internals/use-button/useButton';
import type { FieldRootState } from '../../field/root/FieldRoot';
import { useFieldRootContext } from '../../internals/field-root-context/FieldRootContext';
import { useSetFieldFocused } from '../../internals/field-root-context/useSetFieldFocused';
import { useRegisterFieldControl } from '../../internals/field-register-control/useRegisterFieldControl';
import { useFieldItemContext } from '../../field/item/FieldItemContext';
import { useFormContext } from '../../internals/form-context/FormContext';
import { useLabelableContext } from '../../internals/labelable-provider/LabelableContext';
import { useAriaLabelledBy } from '../../internals/labelable-provider/useAriaLabelledBy';
import { resolveRenderedAriaLabel } from '../../internals/resolveRenderedAriaLabel';
import { useLabelableId } from '../../internals/labelable-provider/useLabelableId';
import { useCheckboxGroupContext } from '../../checkbox-group/CheckboxGroupContext';
import { CheckboxRootContext } from './CheckboxRootContext';
import type { BaseUIChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { useValueChanged } from '../../internals/useValueChanged';
import { handleHiddenInputInvalid } from '../../internals/handleHiddenInputInvalid';
import { syncCheckedState } from '../../internals/syncCheckedState';

export const PARENT_CHECKBOX = 'data-parent';

/**
 * Represents the checkbox itself.
 * Renders a `<span>` element and a hidden `<input>` beside.
 *
 * Documentation: [Base UI Checkbox](https://base-ui.com/react/components/checkbox)
 */
export function CheckboxRoot(componentProps: CheckboxRoot.Props) {
  const elementProps = omit(
    componentProps,
    'checked',
    'class',
    'defaultChecked',
    'aria-labelledby',
    'disabled',
    'form',
    'id',
    'indeterminate',
    'inputRef',
    'name',
    'onCheckedChange',
    'parent',
    'readOnly',
    'render',
    'required',
    'uncheckedValue',
    'value',
    'nativeButton',
    'style',
    'children',
    'ref',
  );

  const formContext = useFormContext();
  const field = useFieldRootContext();
  const fieldItemContext = useFieldItemContext();
  const labelable = useLabelableContext();

  const groupContext = useCheckboxGroupContext();
  const parentContext = groupContext?.allValues === undefined ? undefined : groupContext.parent;
  const isGroupedWithParent = parentContext !== undefined;

  const parent = () => componentProps.parent ?? false;
  const readOnly = () => componentProps.readOnly ?? false;
  const required = () => componentProps.required ?? false;
  const nativeButton = () => componentProps.nativeButton ?? false;
  const indeterminate = () => componentProps.indeterminate ?? false;

  const disabled = () =>
    Boolean(
      field.disabled ||
        fieldItemContext.disabled ||
        groupContext?.disabled ||
        (componentProps.disabled ?? false),
    );
  const name = () => field.name ?? componentProps.name;
  const value = () => componentProps.value ?? name();

  const id = useBaseUiId();

  const ownsControlId = groupContext?.registerControlId !== labelable.registerControlId;

  const controlId = useLabelableId({
    get id() {
      return componentProps.id || undefined;
    },
    enabled: ownsControlId,
  });

  const rootId = () => (nativeButton() ? controlId() : id());

  const groupProps = createMemo<Record<string, any>>(() => {
    if (isGroupedWithParent) {
      if (parent()) {
        return parentContext.getParentProps();
      }
      const currentValue = value();
      if (currentValue !== undefined) {
        return parentContext.getChildProps(currentValue);
      }
    }
    return {};
  });

  const groupChecked = () => groupProps().checked ?? componentProps.checked;
  const groupIndeterminate = () => groupProps().indeterminate ?? indeterminate();
  const otherGroupProps = () => {
    const { checked: _c, indeterminate: _i, onCheckedChange: _o, ...rest } = groupProps();
    return rest;
  };

  const groupValue = () => groupContext?.value;

  const controlRef = { current: null as HTMLElement | null };
  const [controlElement, setControlElement] = createSyncSignal<HTMLElement | null>(null);
  const setFocused = useSetFieldFocused(disabled, controlElement);

  const { getButtonProps, buttonRef } = useButton({
    get disabled() {
      return disabled();
    },
    get native() {
      return nativeButton();
    },
  });

  const validation = groupContext?.validation ?? field.validation;

  const [checked, setCheckedState] = useControlled({
    controlled: () => {
      const currentValue = value();
      const currentGroupValue = groupValue();
      return currentValue !== undefined && currentGroupValue !== undefined && !parent()
        ? currentGroupValue.includes(currentValue)
        : groupChecked();
    },
    default: () => componentProps.defaultChecked ?? false,
    name: 'Checkbox',
    state: 'checked',
  });

  const computedChecked = () => (isGroupedWithParent ? Boolean(groupChecked()) : checked());
  const computedIndeterminate = () =>
    isGroupedWithParent ? groupIndeterminate() || indeterminate() : indeterminate();

  useRegisterFieldControl(
    controlRef,
    id,
    checked,
    undefined,
    () => !groupContext && !disabled(),
    () => componentProps.name,
  );

  const registerChildId = parentContext?.registerChildId;

  const [inputElement, setInputElement] = createSyncSignal<HTMLInputElement | null>(null);
  let unregisterInput: void | (() => void);
  const mergedInputRef = (element: HTMLInputElement | null) => {
    assignRefs(componentProps.inputRef as RefInput<HTMLInputElement | null>, element);
    setInputElement(element);
    if (unregisterInput) {
      unregisterInput();
      unregisterInput = undefined;
    }
    if (element && !untrack(parent)) {
      unregisterInput = validation.registerInput(element, {
        controlRef,
        value: groupContext ? untrack(value) : undefined,
      });
    }
  };

  const ariaLabelledBy = useAriaLabelledBy(
    () => componentProps['aria-labelledby'],
    () => labelable.labelId,
    inputElement,
    () => !nativeButton(),
    controlId,
    () => resolveRenderedAriaLabel(componentProps),
  );

  createEffect(
    () => [checked(), computedIndeterminate(), inputElement()] as const,
    ([isChecked, isIndeterminate, input]) => {
      if (input) {
        input.indeterminate = isIndeterminate;
      }
      if (!groupContext) {
        field.setFilled(isChecked);
      }
    },
  );

  useValueChanged(checked, () => {
    if (groupContext) {
      return;
    }

    formContext.clearErrors(name());
    field.setDirty(checked() !== field.validityData.initialValue);

    validation.change(checked());
  });

  createEffect(
    () => [disabled(), value()] as const,
    ([isDisabled, currentValue]) => {
      if (!parentContext || currentValue === undefined) {
        return undefined;
      }

      const disabledStates = parentContext.disabledStatesRef.current;
      disabledStates.set(currentValue, isDisabled);

      return () => {
        disabledStates.delete(currentValue);
      };
    },
  );

  const state = createMemo<CheckboxRootState>(() => ({
    ...field.state,
    checked: computedChecked(),
    disabled: disabled(),
    readOnly: readOnly(),
    required: required(),
    indeterminate: computedIndeterminate(),
  }));

  const stateAttributesMapping = getCheckboxStateAttributesMapping({
    get indeterminate() {
      return state().indeterminate;
    },
  } as CheckboxRootState);

  const element = () =>
    useRenderElement('span', componentProps, {
      state,
      ref: [
        buttonRef,
        (el: HTMLElement | null) => {
          controlRef.current = el;
          setControlElement(el);
        },
      ],
      props: [
        {
          get id() {
            return rootId();
          },
          role: 'checkbox',
          get 'aria-checked'() {
            return computedIndeterminate() ? 'mixed' : computedChecked();
          },
          get 'aria-readonly'() {
            return readOnly() || undefined;
          },
          get 'aria-required'() {
            return required() || undefined;
          },
          get 'aria-labelledby'() {
            return ariaLabelledBy();
          },
          get [PARENT_CHECKBOX]() {
            return parent() ? '' : undefined;
          },
          onFocus() {
            setFocused(true);
          },
          onBlur() {
            const inputEl = inputElement();
            if (!inputEl) {
              return;
            }

            field.setTouched(true);
            setFocused(false);

            if (field.validationMode === 'onBlur') {
              validation.commit(groupContext ? groupValue() : inputEl.checked);
            }
          },
          onKeyDown(event: BaseUIEvent<KeyboardEvent>) {
            if (event.key !== 'Enter') {
              return;
            }

            event.preventBaseUIHandler();

            if (event.defaultPrevented) {
              return;
            }

            const formToSubmit = inputElement()?.form ?? null;
            const currentTarget = event.currentTarget as Element;
            const originalPreventDefault = event.preventDefault;
            let preventDefaultCalledAfterPropagation = false;

            event.preventDefault = () => {
              preventDefaultCalledAfterPropagation = true;
              originalPreventDefault.call(event);
            };

            originalPreventDefault.call(event);

            ownerWindow(currentTarget).queueMicrotask(() => {
              event.preventDefault = originalPreventDefault;

              if (!preventDefaultCalledAfterPropagation) {
                getDefaultFormSubmitter(formToSubmit)?.click();
              }
            });
          },
          onClick(event: MouseEvent) {
            if (readOnly() || disabled()) {
              return;
            }

            event.preventDefault();

            const input = inputElement();
            if (!input) {
              return;
            }

            dispatchClickWithModifiers(input, event);
          },
        },
        elementProps,
        (props: Record<string, any>) => mergeProps(props, otherGroupProps()),
        getButtonProps,
        labelable.getDescriptionProps,
        (props: Record<string, any>) => validation.getValidationProps(disabled(), props),
      ],
      stateAttributesMapping,
    });

  createEffect(
    () => [parent(), value(), rootId()] as const,
    ([isParent, currentValue, renderedId]) => {
      if (!registerChildId || isParent || currentValue === undefined || renderedId === undefined) {
        return undefined;
      }

      return registerChildId(currentValue, renderedId);
    },
  );

  const input = document.createElement('input');
  spread(
    input,
    () =>
      mergeProps(
        {
          checked: checked(),
          disabled: disabled(),
          form: componentProps.form,
          name: parent() ? undefined : name(),
          id: nativeButton() ? undefined : controlId(),
          required: required(),
          style: name() ? visuallyHiddenInput : visuallyHiddenInputPinned,
          onInvalid: handleHiddenInputInvalid,
          tabindex: -1,
          type: 'checkbox',
          'aria-hidden': 'true',
          onChange(event: Event & { currentTarget: HTMLInputElement }) {
            if (event.defaultPrevented) {
              return;
            }

            const target = event.currentTarget;

            if (readOnly()) {
              event.preventDefault();
              syncCheckedState(target, checked);
              return;
            }

            const nextChecked = target.checked;
            const details = createChangeEventDetails(REASONS.none, event);

            componentProps.onCheckedChange?.(nextChecked, details);

            if (details.isCanceled) {
              syncCheckedState(target, () => computedChecked());
              return;
            }

            groupProps().onCheckedChange?.(nextChecked, details);

            if (details.isCanceled) {
              syncCheckedState(target, () => computedChecked());
              return;
            }

            setCheckedState(nextChecked);

            const currentValue = value();
            if (
              currentValue !== undefined &&
              groupContext !== undefined &&
              !parent() &&
              !isGroupedWithParent
            ) {
              const nextGroupValue = nextChecked
                ? [...groupContext.value, currentValue]
                : groupContext.value.filter((item) => item !== currentValue);

              groupContext.setValue(nextGroupValue, details);
            }

            syncCheckedState(target, () => computedChecked());
          },
          onClick(event: MouseEvent) {
            event.stopPropagation();
          },
          onFocus() {
            controlRef.current?.focus();
          },
        },
        componentProps.value !== undefined
          ? {
              value: (groupContext ? checked() && componentProps.value : componentProps.value) || '',
            }
          : EMPTY_OBJECT,
        labelable.getDescriptionProps,
        (props: Record<string, any>) => validation.getValidationProps(disabled(), props),
        (props: Record<string, any>) => ({ ...props, ref: mergedInputRef }),
      ),
    true,
  );

  return (
    <CheckboxRootContext value={state}>
      {untrack(element)}
      <Show
        when={
          !checked() &&
          !groupContext &&
          name() &&
          !parent() &&
          componentProps.uncheckedValue !== undefined
        }
      >
        <input
          type="hidden"
          form={componentProps.form}
          name={name()}
          value={componentProps.uncheckedValue}
          disabled={disabled()}
        />
      </Show>
      {untrack(() => input)}
    </CheckboxRootContext>
  );
}

export interface CheckboxRootState extends FieldRootState {
  /**
   * Whether the checkbox is currently ticked.
   */
  checked: boolean;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Whether the user should be unable to tick or untick the checkbox.
   */
  readOnly: boolean;
  /**
   * Whether the user must tick the checkbox before submitting a form.
   */
  required: boolean;
  /**
   * Whether the checkbox is in a mixed state: neither ticked, nor unticked.
   */
  indeterminate: boolean;
}

export interface CheckboxRootProps
  extends
    NonNativeButtonProps,
    Omit<BaseUIComponentProps<'span', CheckboxRootState>, 'onChange' | 'value'> {
  /**
   * The id of the input element.
   */
  id?: string | undefined;
  /**
   * Identifies the field when a form is submitted.
   * @default undefined
   */
  name?: string | undefined;
  /**
   * Identifies the form that owns the hidden input.
   * Useful when the checkbox is rendered outside the form.
   */
  form?: string | undefined;
  /**
   * Whether the checkbox is currently ticked.
   *
   * To render an uncontrolled checkbox, use the `defaultChecked` prop instead.
   * @default undefined
   */
  checked?: boolean | undefined;
  /**
   * Whether the checkbox is initially ticked.
   *
   * To render a controlled checkbox, use the `checked` prop instead.
   * @default false
   */
  defaultChecked?: boolean | undefined;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Event handler called when the checkbox is ticked or unticked.
   */
  onCheckedChange?:
    | ((checked: boolean, eventDetails: CheckboxRootChangeEventDetails) => void)
    | undefined;
  /**
   * Whether the user should be unable to tick or untick the checkbox.
   * @default false
   */
  readOnly?: boolean | undefined;
  /**
   * Whether the user must tick the checkbox before submitting a form.
   * @default false
   */
  required?: boolean | undefined;
  /**
   * Whether the checkbox is in a mixed state: neither ticked, nor unticked.
   * @default false
   */
  indeterminate?: boolean | undefined;
  /**
   * A ref to access the hidden `<input>` element.
   */
  inputRef?: RefInput<HTMLInputElement> | undefined;
  /**
   * Whether the checkbox controls a group of child checkboxes.
   *
   * Must be used in a [Checkbox Group](https://base-ui.com/react/components/checkbox-group).
   * @default false
   */
  parent?: boolean | undefined;
  /**
   * The value submitted with the form when the checkbox is unchecked.
   * By default, unchecked checkboxes do not submit any value, matching native checkbox behavior.
   */
  uncheckedValue?: string | undefined;
  /**
   * The checkbox's value. Identifies it within a [Checkbox Group](https://base-ui.com/react/components/checkbox-group), falling back to `name` when omitted.
   * When submitting a form, a checked box submits `value`; with no `value`, it submits the native "on".
   */
  value?: string | undefined;
}

export type CheckboxRootChangeEventReason = typeof REASONS.none;
export type CheckboxRootChangeEventDetails =
  BaseUIChangeEventDetails<CheckboxRoot.ChangeEventReason>;

export namespace CheckboxRoot {
  export type State = CheckboxRootState;
  export type Props = CheckboxRootProps;
  export type ChangeEventReason = CheckboxRootChangeEventReason;
  export type ChangeEventDetails = CheckboxRootChangeEventDetails;
}
