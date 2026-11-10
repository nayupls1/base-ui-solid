import type { JSX } from '@solidjs/web';
import { createEffect, createMemo, omit, untrack } from 'solid-js';
import { ownerDocument } from 'base-ui-solidjs-utils/owner';
import { useTimeout } from 'base-ui-solidjs-utils/useTimeout';
import { contains, getTarget } from 'base-ui-solidjs-utils/shadowDom';
import { createSyncSignal } from 'base-ui-solidjs-utils/createSyncSignal';
import { useSelectRootContext } from '../root/SelectRootContext';
import type { BaseUIComponentProps, HTMLProps, NativeButtonProps } from '../../internals/types';
import { useFieldRootContext } from '../../internals/field-root-context/FieldRootContext';
import { useSetFieldFocused } from '../../internals/field-root-context/useSetFieldFocused';
import { useLabelableContext } from '../../internals/labelable-provider/LabelableContext';
import { pressableTriggerOpenStateMapping } from '../../utils/popups/popupStateMapping';
import { fieldValidityMapping } from '../../internals/field-constants/constants';
import { useRenderElement } from '../../internals/useRenderElement';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import { isMouseWithinBounds } from '../../utils/getPseudoElementBounds';
import { getFloatingFocusElement } from '../../utils/popups/element';
import { mergeProps } from '../../merge-props';
import { useButton } from '../../internals/use-button';
import type { FieldRootState } from '../../field/root/FieldRoot';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { useLabelableId } from '../../internals/labelable-provider/useLabelableId';
import { resolveAriaLabelledBy } from '../../utils/resolveAriaLabelledBy';
import type { Side } from '../../internals/useAnchorPositioning';
import * as SelectTriggerDataAttributes from './SelectTriggerDataAttributes';
import { ownedProps } from '../../internals/ownedProps';

const SELECTED_DELAY = 400;

const stateAttributesMapping: StateAttributesMapping<SelectTriggerState> = {
  ...pressableTriggerOpenStateMapping,
  ...fieldValidityMapping,
  popupSide: (side: Side | null) =>
    side ? { [SelectTriggerDataAttributes.popupSide]: side } : null,
  value: () => null,
} as any;

/**
 * A button that opens the select popup.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Select](https://base-ui.com/react/components/select)
 */
export function SelectTrigger(componentProps: SelectTrigger.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'id',
    'disabled',
    'nativeButton',
    'style',
    'children',
    'ref',
  );

  const field = useFieldRootContext();
  const { validation } = field;
  const labelable = useLabelableContext();

  const store = useSelectRootContext();

  const readOnly = store.useState('readOnly');
  const required = store.useState('required');
  const selectDisabled = store.useState('disabled');
  const disabled = () => field.disabled || selectDisabled() || (componentProps.disabled ?? false);

  const open = store.useState('open');
  const mounted = store.useState('mounted');
  const value = store.useState('selectedValue');
  const triggerProps = store.useState('triggerProps', true);
  const positionerElement = store.useState('positionerElement');
  const listElement = store.useState('listElement');
  const popupSideValue = store.useState('popupSide');
  const rootId = store.useState('id');
  const selectLabelId = store.useState('labelId');
  const hasSelectedValue = store.useState('hasSelectedValue');

  const popupSide = () => (mounted() && positionerElement() ? popupSideValue() : null);
  const id = () => componentProps.id ?? rootId();
  const ariaLabelledBy = () => resolveAriaLabelledBy(labelable.labelId, selectLabelId());

  useLabelableId({
    get id() {
      return componentProps.id;
    },
  } as any);

  const [trigger, setTrigger] = createSyncSignal<HTMLElement | null>(null);

  const setFocused = useSetFieldFocused(disabled, trigger);

  const { getButtonProps, buttonRef } = useButton({
    get disabled() {
      return disabled();
    },
    get native() {
      return componentProps.nativeButton ?? true;
    },
  });

  const setTriggerElement = store.useStateSetter('triggerElement');

  const timeoutFocus = useTimeout();
  const timeoutMouseDown = useTimeout();
  const selectedDelayTimeout = useTimeout();

  createEffect(open, (isOpen) => {
    if (isOpen) {
      // A mousedown on the trigger can open the popup under the cursor. Keep mouseup selection
      // disabled briefly so releasing over either the selected item or a neighboring item doesn't
      // commit an accidental selection.
      selectedDelayTimeout.start(SELECTED_DELAY, () => {
        store.context.selectionRef.current.allowUnselectedMouseUp = true;
        store.context.selectionRef.current.allowSelectedMouseUp = true;
      });

      return () => {
        selectedDelayTimeout.clear();
      };
    }

    store.context.selectionRef.current = {
      allowSelectedMouseUp: false,
      allowUnselectedMouseUp: false,
      dragY: 0,
    };

    timeoutMouseDown.clear();

    return undefined;
  });

  const ownProps: HTMLProps = {
    get id() {
      return id();
    },
    role: 'combobox',
    get 'aria-expanded'() {
      return open();
    },
    'aria-haspopup': 'listbox',
    get 'aria-controls'() {
      return open()
        ? (listElement()?.id ?? getFloatingFocusElement(positionerElement())?.id)
        : undefined;
    },
    get 'aria-labelledby'() {
      return ariaLabelledBy();
    },
    get 'aria-readonly'() {
      return readOnly() || undefined;
    },
    get 'aria-required'() {
      return required() || undefined;
    },
    get tabindex() {
      return disabled() ? -1 : 0;
    },
    onFocus(event: FocusEvent) {
      setFocused(true);
      // The popup element shouldn't obscure the focused trigger.
      if (store.select('open') && store.context.alignItemWithTriggerActiveRef.current) {
        store.setOpen(false, createChangeEventDetails(REASONS.none, event) as any);
      }

      // Saves a re-render on initial click: `forceMounted === true` mounts
      // the items before `open === true`.
      timeoutFocus.start(0, () => {
        store.set('forceMounted', true);
      });
    },
    onBlur(event: FocusEvent) {
      // If focus is moving into the popup, don't count it as a blur.
      if (contains(store.select('positionerElement'), event.relatedTarget as Element | null)) {
        return;
      }

      field.setTouched(true);
      setFocused(false);

      if (field.validationMode === 'onBlur') {
        validation.commit(store.select('selectedValue'));
      }
    },
    onMouseDown(event: MouseEvent) {
      if (store.select('open')) {
        return;
      }

      const doc = ownerDocument(event.currentTarget as Element);

      function handleMouseUp(mouseEvent: MouseEvent) {
        const triggerElement = trigger();
        if (!triggerElement) {
          return;
        }

        const mouseUpTarget = getTarget(mouseEvent) as Element | null;

        // Don't treat the release as an outside press when it lands on the trigger or inside
        // the popup positioner (or their children).
        if (
          contains(triggerElement, mouseUpTarget) ||
          contains(store.select('positionerElement'), mouseUpTarget)
        ) {
          return;
        }

        if (isMouseWithinBounds(mouseEvent, triggerElement)) {
          return;
        }

        store.setOpen(false, createChangeEventDetails(REASONS.cancelOpen, mouseEvent) as any);
      }

      // Firefox can fire this upon mousedown
      timeoutMouseDown.start(0, () => {
        doc.addEventListener('mouseup', handleMouseUp, { once: true });
      });
    },
  } as any;

  const state = createMemo<SelectTriggerState>(() => ({
    ...field.state,
    open: open(),
    disabled: disabled(),
    value: value(),
    readOnly: readOnly(),
    popupSide: popupSide(),
    placeholder: !hasSelectedValue(),
  }));

  return useRenderElement('button', componentProps, {
    ref: [
      (el: HTMLElement | null) => {
        setTrigger(el);
      },
      buttonRef,
      setTriggerElement as (el: HTMLElement | null) => void,
    ],
    state,
    stateAttributesMapping,
    props: [
      (merged: Record<string, any>) => {
        const props = validation.getValidationProps(
          disabled(),
          mergeProps(triggerProps(), ownProps, elementProps, getButtonProps) as any,
        ) as Record<string, any>;
        // ensure nested useButton does not overwrite the combobox role:
        // <Toolbar.Button render={<Select.Trigger />} />
        props.role = 'combobox';
        return mergeProps(merged, props);
      },
    ],
  });
}

export interface SelectTriggerState extends FieldRootState {
  /**
   * Whether the select popup is currently open.
   */
  open: boolean;
  /**
   * Whether the select popup is readonly.
   */
  readOnly: boolean;
  /**
   * Indicates which side the corresponding popup is positioned relative to its anchor.
   */
  popupSide: Side | null;
  /**
   * The value of the currently selected item.
   */
  value: any;
  /**
   * Whether the select doesn't have a value.
   */
  placeholder: boolean;
}

export interface SelectTriggerProps
  extends NativeButtonProps, BaseUIComponentProps<'button', SelectTriggerState> {
  children?: JSX.Element;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled?: boolean | undefined;
}

export namespace SelectTrigger {
  export type State = SelectTriggerState;
  export type Props = SelectTriggerProps;
}
