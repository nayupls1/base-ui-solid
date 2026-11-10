import { createEffect, createMemo, omit, Show, untrack } from 'solid-js';
import { useControlled } from 'base-ui-solidjs-utils/useControlled';
import { createSyncSignal } from 'base-ui-solidjs-utils/createSyncSignal';
import { visuallyHiddenInput, visuallyHiddenInputPinned } from 'base-ui-solidjs-utils/visuallyHidden';
import { assignRefs, useRenderElement, type RefInput } from '../../internals/useRenderElement';
import type { BaseUIComponentProps, NonNativeButtonProps } from '../../internals/types';
import { useBaseUiId } from '../../internals/useBaseUiId';
import { useButton } from '../../internals/use-button';
import { SwitchRootContext } from './SwitchRootContext';
import { stateAttributesMapping } from '../stateAttributesMapping';
import { dispatchClickWithModifiers } from '../../utils/dispatchClickWithModifiers';
import type { FieldRootState } from '../../field/root/FieldRoot';
import { useFieldRootContext } from '../../internals/field-root-context/FieldRootContext';
import { useSetFieldFocused } from '../../internals/field-root-context/useSetFieldFocused';
import { useRegisterFieldControl } from '../../internals/field-register-control/useRegisterFieldControl';
import { useFormContext } from '../../internals/form-context/FormContext';
import { useLabelableContext } from '../../internals/labelable-provider/LabelableContext';
import { useAriaLabelledBy } from '../../internals/labelable-provider/useAriaLabelledBy';
import { resolveRenderedAriaLabel } from '../../internals/resolveRenderedAriaLabel';
import { useLabelableId } from '../../internals/labelable-provider/useLabelableId';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import type { BaseUIChangeEventDetails } from '../../types';
import { useValueChanged } from '../../internals/useValueChanged';
import { handleHiddenInputInvalid } from '../../internals/handleHiddenInputInvalid';
import { syncCheckedState } from '../../internals/syncCheckedState';
import { spread } from '@solidjs/web';
import { ownedProps } from '../../internals/ownedProps';

/**
 * Represents the switch itself.
 * Renders a `<span>` element and a hidden `<input>` beside.
 *
 * Documentation: [Base UI Switch](https://base-ui.com/react/components/switch)
 */
export function SwitchRoot(componentProps: SwitchRoot.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(
    componentProps,
    'checked',
    'class',
    'defaultChecked',
    'aria-labelledby',
    'form',
    'id',
    'inputRef',
    'name',
    'nativeButton',
    'onCheckedChange',
    'readOnly',
    'required',
    'disabled',
    'render',
    'uncheckedValue',
    'value',
    'style',
    'children',
    'ref',
  );

  const formContext = useFormContext();
  const field = useFieldRootContext();
  const validation = field.validation;
  const labelable = useLabelableContext();

  const nativeButton = () => componentProps.nativeButton ?? false;
  const readOnly = () => componentProps.readOnly ?? false;
  const required = () => componentProps.required ?? false;
  const disabled = () => Boolean(field.disabled || (componentProps.disabled ?? false));
  const name = () => field.name ?? componentProps.name;

  const [inputElement, setInputElement] = createSyncSignal<HTMLInputElement | null>(null);
  const handleInputRef = (el: HTMLInputElement | null) => {
    setInputElement(el);
    assignRefs(componentProps.inputRef as RefInput<HTMLInputElement | null>, el);
    validation.inputRef.current = el;
  };

  const switchRef = { current: null as HTMLElement | null };
  const [switchElement, setSwitchElement] = createSyncSignal<HTMLElement | null>(null);
  const setFocused = useSetFieldFocused(disabled, switchElement);

  const id = useBaseUiId();

  const controlId = useLabelableId({
    get id() {
      return componentProps.id;
    },
  });
  const hiddenInputId = () => (nativeButton() ? undefined : controlId());

  const [checked, setCheckedState] = useControlled({
    controlled: () => componentProps.checked,
    default: () => Boolean(componentProps.defaultChecked),
    name: 'Switch',
    state: 'checked',
  });

  useRegisterFieldControl(
    switchRef,
    id,
    checked,
    undefined,
    () => !disabled(),
    () => componentProps.name,
  );

  createEffect(checked, (isChecked) => {
    field.setFilled(isChecked);
  });

  useValueChanged(checked, () => {
    formContext.clearErrors(name());
    field.setDirty(checked() !== field.validityData.initialValue);

    validation.change(checked());
  });

  const { getButtonProps, buttonRef } = useButton({
    get disabled() {
      return disabled();
    },
    get native() {
      return nativeButton();
    },
  });

  const ariaLabelledBy = useAriaLabelledBy(
    () => componentProps['aria-labelledby'],
    () => labelable.labelId,
    inputElement,
    () => !nativeButton(),
    hiddenInputId,
    () => resolveRenderedAriaLabel(componentProps),
  );

  const rootProps = {
    get id() {
      return nativeButton() ? controlId() : id();
    },
    role: 'switch',
    get 'aria-checked'() {
      return checked();
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
    onFocus() {
      setFocused(true);
    },
    onBlur() {
      const element = inputElement();
      if (!element || disabled()) {
        return;
      }

      field.setTouched(true);
      setFocused(false);

      if (field.validationMode === 'onBlur') {
        validation.commit(element.checked);
      }
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
  };

  const state = createMemo<SwitchRootState>(() => ({
    ...field.state,
    checked: checked(),
    disabled: disabled(),
    readOnly: readOnly(),
    required: required(),
  }));

  const element = () => useRenderElement('span', componentProps, {
    state,
    ref: [
      (el: HTMLElement | null) => {
        switchRef.current = el;
        setSwitchElement(el);
      },
      buttonRef,
    ],
    props: [
      rootProps,
      elementProps,
      getButtonProps,
      (props: Record<string, any>) => validation.getValidationProps(disabled(), props),
    ],
    stateAttributesMapping,
  });

  const input = document.createElement('input');
  spread(
    input,
    () => ({
      ...validation.getValidationProps(disabled()),
      checked: checked(),
      disabled: disabled(),
      form: componentProps.form,
      id: hiddenInputId(),
      name: name(),
      required: required(),
      style: name() ? visuallyHiddenInput : visuallyHiddenInputPinned,
      onInvalid: handleHiddenInputInvalid,
      tabindex: -1,
      type: 'checkbox',
      'aria-hidden': 'true',
      ref: handleInputRef,
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
        const eventDetails = createChangeEventDetails(REASONS.none, event);

        componentProps.onCheckedChange?.(nextChecked, eventDetails);

        if (!eventDetails.isCanceled) {
          setCheckedState(nextChecked);
        }

        syncCheckedState(target, checked);
      },
      onClick(event: MouseEvent) {
        event.stopPropagation();
      },
      onFocus() {
        switchRef.current?.focus();
      },
      ...(componentProps.value !== undefined ? { value: componentProps.value } : {}),
    }),
    true,
  );

  return (
    <SwitchRootContext value={state}>
      {untrack(element)}
      <Show when={!checked() && name() && componentProps.uncheckedValue !== undefined}>
        <input
          type="hidden"
          form={componentProps.form}
          name={name()}
          value={componentProps.uncheckedValue}
          disabled={disabled()}
        />
      </Show>
      {untrack(() => input)}
    </SwitchRootContext>
  );
}

export interface SwitchRootState extends FieldRootState {
  /**
   * Whether the switch is currently active.
   */
  checked: boolean;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Whether the user should be unable to activate or deactivate the switch.
   */
  readOnly: boolean;
  /**
   * Whether the user must activate the switch before submitting a form.
   */
  required: boolean;
}

export interface SwitchRootProps
  extends NonNativeButtonProps, Omit<BaseUIComponentProps<'span', SwitchRootState>, 'onChange'> {
  /**
   * The id of the hidden input element.
   *
   * When `nativeButton` is `true`, the id is applied to the root element.
   */
  id?: string | undefined;
  /**
   * Whether the switch is currently active.
   *
   * To render an uncontrolled switch, use the `defaultChecked` prop instead.
   */
  checked?: boolean | undefined;
  /**
   * Whether the switch is initially active.
   *
   * To render a controlled switch, use the `checked` prop instead.
   * @default false
   */
  defaultChecked?: boolean | undefined;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * A ref to access the hidden `<input>` element.
   */
  inputRef?: RefInput<HTMLInputElement> | undefined;
  /**
   * Identifies the field when a form is submitted.
   */
  name?: string | undefined;
  /**
   * Identifies the form that owns the hidden input.
   * Useful when the switch is rendered outside the form.
   */
  form?: string | undefined;
  /**
   * Event handler called when the switch is activated or deactivated.
   */
  onCheckedChange?:
    | ((checked: boolean, eventDetails: SwitchRoot.ChangeEventDetails) => void)
    | undefined;
  /**
   * Whether the user should be unable to activate or deactivate the switch.
   * @default false
   */
  readOnly?: boolean | undefined;
  /**
   * Whether the user must activate the switch before submitting a form.
   * @default false
   */
  required?: boolean | undefined;
  /**
   * The value submitted with the form when the switch is on.
   * By default, switch submits the "on" value, matching native checkbox behavior.
   */
  value?: string | undefined;
  /**
   * The value submitted with the form when the switch is off.
   * By default, unchecked switches do not submit any value, matching native checkbox behavior.
   */
  uncheckedValue?: string | undefined;
}

export type SwitchRootChangeEventReason = typeof REASONS.none;
export type SwitchRootChangeEventDetails = BaseUIChangeEventDetails<SwitchRoot.ChangeEventReason>;

export namespace SwitchRoot {
  export type State = SwitchRootState;
  export type Props = SwitchRootProps;
  export type ChangeEventReason = SwitchRootChangeEventReason;
  export type ChangeEventDetails = SwitchRootChangeEventDetails;
}
