import { createMemo, omit, untrack } from 'solid-js';
import { useTimeout } from 'base-ui-solidjs-utils/useTimeout';
import { ownerDocument } from 'base-ui-solidjs-utils/owner';
import { contains, getTarget } from 'base-ui-solidjs-utils/shadowDom';
import type { BaseUIComponentProps, NativeButtonProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useButton } from '../../internals/use-button';
import { useComboboxInputValueContext, useComboboxRootContext } from '../root/ComboboxRootContext';
import { triggerStateAttributesMapping } from '../utils/stateAttributesMapping';
import { useFieldRootContext } from '../../internals/field-root-context/FieldRootContext';
import { useSetFieldFocused } from '../../internals/field-root-context/useSetFieldFocused';
import { useLabelableContext } from '../../internals/labelable-provider/LabelableContext';
import { stopEvent } from '../../utils/popups/event';
import { isMouseWithinBounds } from '../../utils/getPseudoElementBounds';
import type { FieldRootState } from '../../field/root/FieldRoot';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { useClick } from '../../utils/popups/interactions/useClick';
import { useTypeahead } from '../../utils/popups/interactions/useTypeahead';
import type { Side } from '../../internals/useAnchorPositioning';
import { useLabelableId } from '../../internals/labelable-provider/useLabelableId';
import { resolveAriaLabelledBy } from '../../utils/resolveAriaLabelledBy';
import { getComboboxPopupId } from '../root/utils';
import { useListEmpty, usePopupSide } from '../utils/parts';
import { mergeProps } from '../../merge-props';
import { ownedProps } from '../../internals/ownedProps';

/**
 * A button that opens the popup.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export function ComboboxTrigger(componentProps: ComboboxTrigger.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'nativeButton',
    'disabled',
    'id',
    'style',
    'children',
    'ref',
  );

  const field = useFieldRootContext();
  const { setTouched, validation } = field;
  const labelable = useLabelableContext();
  const store = useComboboxRootContext();

  const selectionMode = store.useState('selectionMode');
  const comboboxDisabled = store.useState('disabled');
  const readOnly = store.useState('readOnly');
  const required = store.useState('required');
  const listElement = store.useState('listElement');
  const storedPopupId = store.useState('popupElementId');
  const triggerProps = store.useState('triggerProps', true);
  const inputInsidePopup = store.useState('inputInsidePopup');
  const rootId = store.useState('id');
  const comboboxLabelId = store.useState('labelId');
  const open = store.useState('open');
  const activeIndex = store.useState('activeIndex');
  const selectedIndex = store.useState('selectedIndex');
  const hasSelectedValue = store.useState('hasSelectedValue');

  const inputValue = useComboboxInputValueContext();

  const focusTimeout = useTimeout();

  const disabled = () => field.disabled || comboboxDisabled() || (componentProps.disabled ?? false);
  const listEmpty = useListEmpty();
  const popupSide = usePopupSide(store);

  let triggerElement: HTMLElement | null = null;
  const setFocused = useSetFieldFocused(disabled, () => triggerElement);

  useLabelableId({
    get id() {
      return inputInsidePopup() ? (componentProps.id as string | undefined) : undefined;
    },
  } as any);
  const id = () =>
    inputInsidePopup()
      ? ((componentProps.id as string | undefined) ?? rootId())
      : (componentProps.id as string | undefined);
  const ariaLabelledBy = () => resolveAriaLabelledBy(labelable.labelId, comboboxLabelId());

  const ariaControls = () => {
    if (open() && inputInsidePopup()) {
      // Fall back to the default id while the popup registers its own, so `aria-controls` is set
      // as soon as `open` becomes `true`.
      return storedPopupId() ?? getComboboxPopupId(rootId());
    }
    if (open()) {
      return (listElement() as HTMLElement | null)?.id;
    }
    return undefined;
  };

  let currentPointerType = '';

  function trackPointerType(event: PointerEvent) {
    currentPointerType = event.pointerType;
  }

  const typeahead = useTypeahead(
    store.interactions as any,
    {
      // Typeahead on a closed trigger commits a value rather than moving a highlight, so it stays
      // gated on `readOnly`.
      get enabled() {
        return !open() && !readOnly() && !comboboxDisabled() && selectionMode() === 'single';
      },
      listRef: store.context.labelsRef,
      get activeIndex() {
        return activeIndex();
      },
      get selectedIndex() {
        return selectedIndex();
      },
      onMatch(index: number) {
        const nextSelectedValue = store.context.valuesRef.current[index];
        if (nextSelectedValue !== undefined) {
          store.context.setSelectedValue(nextSelectedValue, createChangeEventDetails(REASONS.none));
        }
      },
    } as any,
  );

  const click = useClick(
    store.interactions as any,
    {
      get enabled() {
        return !comboboxDisabled();
      },
      event: 'mousedown',
      // A Combobox never opens on hover or focus, so a press always toggles it, even when a key
      // press, such as typing or an arrow key, opened it.
      stickIfOpen: false,
    } as any,
  );

  const { buttonRef, getButtonProps } = useButton({
    get native() {
      return componentProps.nativeButton ?? true;
    },
    get disabled() {
      return disabled();
    },
  });

  const state = createMemo<ComboboxTriggerState>(() => ({
    ...field.state,
    readOnly: readOnly(),
    open: open(),
    disabled: disabled(),
    popupSide: popupSide(),
    listEmpty: listEmpty(),
    placeholder: selectionMode() === 'none' ? false : !hasSelectedValue(),
  }));

  const setTriggerElement = store.useStateSetter('triggerElement');

  return useRenderElement('button', componentProps, {
    ref: [
      buttonRef,
      (el: HTMLElement | null) => {
        triggerElement = el;
      },
      setTriggerElement as any,
    ],
    state,
    props: [
      (merged: Record<string, any>) => mergeProps(merged, triggerProps() as any),
      (merged: Record<string, any>) => mergeProps(merged, click.reference as any),
      (merged: Record<string, any>) => mergeProps(merged, typeahead.reference as any),
      {
        get id() {
          return id();
        },
        get tabindex() {
          return inputInsidePopup() ? 0 : -1;
        },
        get role() {
          return inputInsidePopup() ? 'combobox' : undefined;
        },
        get 'aria-expanded'() {
          return open();
        },
        get 'aria-haspopup'() {
          return inputInsidePopup() ? 'dialog' : 'listbox';
        },
        get 'aria-controls'() {
          return ariaControls();
        },
        get 'aria-required'() {
          return inputInsidePopup() ? required() || undefined : undefined;
        },
        // Only valid alongside the `combobox` role; without it the trigger is a plain button, and
        // the `Combobox.Input` outside the popup already carries `aria-readonly`.
        get 'aria-readonly'() {
          return inputInsidePopup() ? readOnly() || undefined : undefined;
        },
        get 'aria-labelledby'() {
          return ariaLabelledBy();
        },
        onPointerDown: trackPointerType,
        onPointerEnter: trackPointerType,
        onFocus() {
          setFocused(true);

          if (untrack(disabled)) {
            return;
          }

          focusTimeout.start(0, store.context.forceMount);
        },
        onBlur(event: FocusEvent) {
          // If focus is moving into the popup, don't count it as a blur.
          if (contains(store.state.positionerElement, event.relatedTarget as Element | null)) {
            return;
          }

          setTouched(true);
          setFocused(false);

          if (field.validationMode === 'onBlur') {
            const valueToValidate =
              store.state.selectionMode === 'none'
                ? untrack(inputValue)
                : store.state.selectedValue;
            validation.commit(valueToValidate);
          }
        },
        onMouseDown(event: MouseEvent) {
          if (untrack(disabled)) {
            return;
          }

          const currentTarget = event.currentTarget as HTMLElement;
          const insidePopup = store.state.inputInsidePopup;

          if (!insidePopup) {
            store.interactions.set('anchorElement', currentTarget);
          }

          // Ensure items are registered for initial selection highlight.
          store.context.forceMount();

          if (currentPointerType !== 'touch') {
            store.context.inputRef.current?.focus();

            if (!insidePopup) {
              event.preventDefault();
            }
          }

          if (store.select('open')) {
            return;
          }

          const doc = ownerDocument(currentTarget);

          function handleMouseUp(mouseEvent: MouseEvent) {
            const currentTriggerElement = store.state.triggerElement;
            if (!currentTriggerElement) {
              return;
            }

            const mouseUpTarget = getTarget(mouseEvent) as Element | null;
            const positioner = store.state.positionerElement;
            const list = store.state.listElement;

            if (
              contains(currentTriggerElement, mouseUpTarget) ||
              contains(positioner, mouseUpTarget) ||
              contains(list, mouseUpTarget)
            ) {
              return;
            }

            if (isMouseWithinBounds(mouseEvent, currentTriggerElement)) {
              return;
            }

            store.setOpen(false, createChangeEventDetails(REASONS.cancelOpen, mouseEvent) as any);
          }

          if (insidePopup) {
            doc.addEventListener('mouseup', handleMouseUp, { once: true });
          }
        },
        onKeyDown(event: KeyboardEvent) {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            stopEvent(event);
            store.setOpen(true, createChangeEventDetails(REASONS.listNavigation, event) as any);
            store.context.inputRef.current?.focus();
          }
        },
      } as any,
      (merged: Record<string, any>) =>
        mergeProps(merged, validation.getValidationProps(disabled(), elementProps as any)),
      getButtonProps,
    ],
    stateAttributesMapping: triggerStateAttributesMapping,
  });
}

export interface ComboboxTriggerState extends FieldRootState {
  /**
   * Whether the popup is open.
   */
  open: boolean;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Whether the component should ignore user edits.
   */
  readOnly: boolean;
  /**
   * Indicates which side the corresponding popup is positioned relative to its anchor.
   */
  popupSide: Side | null;
  /**
   * Present when the corresponding items list is empty.
   */
  listEmpty: boolean;
  /**
   * Whether the combobox doesn't have a value.
   */
  placeholder: boolean;
}

export interface ComboboxTriggerProps
  extends NativeButtonProps, BaseUIComponentProps<'button', ComboboxTriggerState> {
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
}

export namespace ComboboxTrigger {
  export type State = ComboboxTriggerState;
  export type Props = ComboboxTriggerProps;
}
