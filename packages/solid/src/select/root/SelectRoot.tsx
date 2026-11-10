import type { JSX } from '@solidjs/web';
import type { RefObject } from 'base-ui-solidjs-utils/types';
import { createEffect, createMemo, For, Show, untrack } from 'solid-js';
import { visuallyHiddenInput, visuallyHiddenInputPinned } from 'base-ui-solidjs-utils/visuallyHidden';
import { isElementDisabled } from 'base-ui-solidjs-utils/isElementDisabled';
import { useControlled } from 'base-ui-solidjs-utils/useControlled';
import { EMPTY_ARRAY, EMPTY_OBJECT } from 'base-ui-solidjs-utils/empty';
import { useClick } from '../../utils/popups/interactions/useClick';
import { useDismiss } from '../../utils/popups/interactions/useDismiss';
import { useListNavigation } from '../../utils/popups/interactions/useListNavigation';
import { useTypeahead } from '../../utils/popups/interactions/useTypeahead';
import { SelectRootContext, SelectSelectionContext } from './SelectRootContext';
import { useFieldRootContext } from '../../internals/field-root-context/FieldRootContext';
import { useRegisterFieldControl } from '../../internals/field-register-control/useRegisterFieldControl';
import { useLabelableId } from '../../internals/labelable-provider/useLabelableId';
import { SelectStore, selectors } from '../store';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import type { BaseUIChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { FOCUSABLE_POPUP_PROPS } from '../../utils/popups/popupStoreUtils';
import { useFormContext } from '../../internals/form-context/FormContext';
import { stringifyAsLabel, stringifyAsValue } from '../../internals/resolveValueLabel';
import type { Group } from '../../internals/resolveValueLabel';
import {
  defaultItemEquality,
  findSelectionIndex,
  isSelectedValueDirty,
} from '../../internals/itemEquality';
import { useValueChanged } from '../../internals/useValueChanged';
import { useOpenInteractionType } from '../../utils/popups/interactions/useOpenInteractionType';
import { getMaxScrollOffset, normalizeScrollOffset } from '../../utils/scrollEdges';
import { mergeProps } from '../../merge-props';
import { NOOP } from '../../internals/noop';
import { getHiddenInputType } from '../../internals/getHiddenInputType';
import { useSingleAnchorPopupRoot } from '../../utils/popups/popupRoot';
import { createInitialPopupStoreState, createPopupStoreContext } from '../../utils/popups/store';
import { handleHiddenInputInvalid } from '../../internals/handleHiddenInputInvalid';
import type { RefInput } from '../../internals/useRenderElement';
import { assignRefs } from '../../internals/useRenderElement';
import { ownedProps } from '../../internals/ownedProps';

/**
 * Groups all parts of the select.
 * Doesn't render its own HTML element.
 *
 * Documentation: [Base UI Select](https://base-ui.com/react/components/select)
 */
export function SelectRoot<Value, Multiple extends boolean | undefined = false>(
  props: SelectRoot.Props<Value, Multiple>,
): JSX.Element {
  props = ownedProps(props);
  const multiple = () => (props.multiple ?? false) as boolean;
  const readOnly = () => props.readOnly ?? false;
  const required = () => props.required ?? false;
  const modal = () => props.modal ?? true;
  const highlightItemOnHover = () => props.highlightItemOnHover ?? true;
  const isItemEqualToValue = () => props.isItemEqualToValue ?? defaultItemEquality;

  const { clearErrors } = useFormContext();
  const field = useFieldRootContext();
  const { validation } = field;

  const generatedId = useLabelableId({
    get id() {
      return props.id;
    },
  } as any) as () => string | undefined;

  const disabled = () => field.disabled || (props.disabled ?? false);
  const name = () => field.name ?? props.name;

  const [value, setValueUnwrapped] = useControlled<any>({
    controlled: () => props.value,
    default: untrack(() =>
      multiple() ? (props.defaultValue ?? EMPTY_ARRAY) : (props.defaultValue ?? null),
    ),
    name: 'Select',
    state: 'value',
  });

  const listRef: RefObject<Array<HTMLElement | null>> = { current: [] };
  const labelsRef: RefObject<Array<string | null>> = { current: [] };
  const popupRef: RefObject<HTMLDivElement | null> = { current: null };
  const scrollHandlerRef: RefObject<((el: HTMLDivElement) => void) | null> = { current: null };
  const scrollArrowsMountedCountRef: RefObject<number> = { current: 0 };
  const valueRef: RefObject<HTMLSpanElement | null> = { current: null };
  const valuesRef: RefObject<Array<any>> = { current: [] };
  const typingRef: RefObject<boolean> = { current: false };
  const firstItemTextRef: RefObject<HTMLElement | null> = { current: null };
  const selectedItemTextRef: RefObject<HTMLElement | null> = { current: null };
  const selectionRef = {
    current: {
      allowSelectedMouseUp: false,
      allowUnselectedMouseUp: false,
      dragY: 0,
    },
  };
  const alignItemWithTriggerActiveRef: RefObject<boolean> = { current: false };
  const initialValueRef: RefObject<any> = { current: untrack(value) };

  // Calls `onOpenChange` for every open change that isn't ignored, then applies the select's own
  // handling of an accepted change before the store commits it.
  const handleOpenChange = (nextOpen: boolean, eventDetails: SelectRoot.OpenChangeEventDetails) => {
    props.onOpenChange?.(nextOpen, eventDetails);

    if (eventDetails.isCanceled) {
      return;
    }

    if (
      !nextOpen &&
      (eventDetails.reason === REASONS.focusOut || eventDetails.reason === REASONS.outsidePress)
    ) {
      field.setTouched(true);
      field.setFocused(false);

      if (field.validationMode === 'onBlur') {
        validation.commit(untrack(value));
      }
    }
  };

  const { store, open } = useSingleAnchorPopupRoot(
    {
      get open() {
        return props.open;
      },
      get defaultOpen() {
        return props.defaultOpen ?? false;
      },
      onOpenChange: handleOpenChange,
      get onOpenChangeComplete() {
        return props.onOpenChangeComplete;
      },
      get actionsRef() {
        return props.actionsRef;
      },
    } as any,
    (initialState, defaultPopupId) =>
      new SelectStore(
        {
          ...createInitialPopupStoreState(defaultPopupId),
          ...initialState,
          id: generatedId(),
          labelId: undefined,
          modal: modal(),
          selectionMode: multiple() ? 'multiple' : 'single',
          disabled: disabled(),
          readOnly: readOnly(),
          required: required(),
          highlightItemOnHover: highlightItemOnHover(),
          itemToStringLabel: props.itemToStringLabel,
          itemToStringValue: props.itemToStringValue,
          isItemEqualToValue: isItemEqualToValue(),
          selectedValue: value(),
          items: props.items,
          forceMounted: false,
          openMethod: null,
          activeIndex: null,
          selectedIndex: null,
          itemRoot: {
            props: EMPTY_OBJECT,
            multiple: multiple(),
            disabled: disabled(),
            readOnly: readOnly(),
            isItemEqualToValue: isItemEqualToValue(),
          },
          triggerElement: null,
          listElement: null,
          popupSide: null,
          scrollUpArrowVisible: false,
          scrollDownArrowVisible: false,
          hasScrollArrows: false,
        } as any,
        {
          ...createPopupStoreContext(),
          isItemEqualToValue: isItemEqualToValue(),
          setValue: NOOP,
          handleScrollArrowVisibility: NOOP,
          listRef,
          popupRef,
          scrollHandlerRef,
          scrollArrowsMountedCountRef,
          valueRef,
          valuesRef,
          labelsRef,
          typingRef,
          selectionRef,
          firstItemTextRef,
          selectedItemTextRef,
          alignItemWithTriggerActiveRef,
          initialValueRef,
        } as any,
        selectors,
      ),
  ) as unknown as { store: SelectStore; open: () => boolean };

  const { openMethod, triggerProps: interactionTypeProps } = useOpenInteractionType(open);

  const activeIndex = store.useState('activeIndex');
  const selectedIndex = store.useState('selectedIndex');
  const triggerElement = store.useState('triggerElement');

  // Keep the last open method while the popup closes, like `usePreviousValue`.
  let previousOpenMethod: ReturnType<typeof openMethod> = null;
  const renderedOpenMethod = createMemo(() => {
    const current = openMethod();
    const rendered = current ?? previousOpenMethod;
    previousOpenMethod = current;
    return rendered;
  });

  const serializedValue = createMemo(() => {
    // In multiple mode the shared input is nameless; per-value entries are submitted via
    // `hiddenInputs`. Its value is therefore irrelevant.
    if (multiple()) {
      return '';
    }
    return stringifyAsValue(value(), props.itemToStringValue);
  });

  const fieldStringValue = createMemo(() => {
    const currentValue = value();
    if (multiple() && Array.isArray(currentValue)) {
      return currentValue.map((item) => stringifyAsValue(item, props.itemToStringValue));
    }
    return stringifyAsValue(currentValue, props.itemToStringValue);
  });

  const controlRef = {
    get current() {
      return untrack(triggerElement);
    },
  };

  useRegisterFieldControl(
    controlRef as any,
    generatedId as any,
    value,
    () => untrack(fieldStringValue),
    () => !disabled(),
    () => props.name,
  );

  // Mirror the `hasSelectedValue` store selector so the Field's filled state agrees with the
  // trigger/value placeholder semantics (a value serializing to `''` counts as empty).
  const hasSelectedValue = () => {
    const currentValue = value();
    return multiple()
      ? Array.isArray(currentValue) && currentValue.length > 0
      : currentValue != null && serializedValue() !== '';
  };

  createEffect(hasSelectedValue, (filled) => {
    field.setFilled(filled);
  });

  createEffect(
    () => [multiple(), open(), value(), isItemEqualToValue()] as const,
    function syncSelectedIndex([isMultiple, isOpen, currentValue, equality]) {
      const nextIndex = findSelectionIndex(valuesRef.current, currentValue, equality, isMultiple);

      if (nextIndex === null) {
        selectedItemTextRef.current = null;
      }

      if (isOpen) {
        return;
      }

      store.set('selectedIndex', nextIndex);
    },
  );

  useValueChanged(value, () => {
    const currentValue = untrack(value);
    clearErrors(untrack(name));
    field.setDirty(
      isSelectedValueDirty(
        currentValue,
        field.validityData.initialValue,
        untrack(isItemEqualToValue),
      ),
    );

    validation.change(currentValue);
  });

  const setValue = (nextValue: any, eventDetails: SelectRoot.ChangeEventDetails) => {
    props.onValueChange?.(nextValue, eventDetails as any);

    if (eventDetails.isCanceled) {
      return;
    }

    setValueUnwrapped(nextValue);
  };

  const handleScrollArrowVisibility = (scroller: HTMLElement) => {
    const maxScrollTop = getMaxScrollOffset(scroller.scrollHeight, scroller.clientHeight);
    const scrollTop = normalizeScrollOffset(scroller.scrollTop, maxScrollTop);
    const shouldShowUp = scrollTop > 0;
    const shouldShowDown = scrollTop < maxScrollTop;

    store.set('scrollUpArrowVisible', shouldShowUp);
    store.set('scrollDownArrowVisible', shouldShowDown);
  };

  // `readOnly` locks the value, not the interaction: the popup can be opened and browsed so the
  // user can see the available options and which one is selected.
  const click = useClick(store as any, {
    get enabled() {
      return !disabled();
    },
    event: 'mousedown',
  } as any);

  const dismiss = useDismiss(store as any);

  const listNavigation = useListNavigation(store as any, {
    get enabled() {
      return !disabled();
    },
    listRef,
    get activeIndex() {
      return activeIndex();
    },
    get selectedIndex() {
      return selectedIndex();
    },
    disabledIndices: EMPTY_ARRAY,
    onNavigate(nextActiveIndex) {
      // Retain the highlight while transitioning out.
      if (nextActiveIndex === null && !store.select('open')) {
        return;
      }

      store.set('activeIndex', nextActiveIndex);
    },
    get focusItemOnHover() {
      return highlightItemOnHover();
    },
  });

  const typeahead = useTypeahead(store as any, {
    // Typeahead on an open popup only moves the highlight, so it remains available while
    // `readOnly`. The closed-trigger variant commits a value instead, so it doesn't.
    get enabled() {
      return !disabled() && (open() || (!readOnly() && !multiple()));
    },
    listRef: labelsRef,
    get activeIndex() {
      return activeIndex();
    },
    get selectedIndex() {
      return selectedIndex();
    },
    // Skip disabled items while matching so typeahead advances to the next selectable item.
    disabledIndices: (index) => isElementDisabled(listRef.current[index]),
    onMatch(index) {
      if (store.select('open')) {
        store.set('activeIndex', index);
      } else {
        setValue(valuesRef.current[index], createChangeEventDetails(REASONS.none) as any);
      }
    },
    onTyping(typing) {
      typingRef.current = typing;
    },
  });

  // `Select.Trigger` applies the id itself from the store, so it's deliberately not merged here.
  const mergedTriggerProps = createMemo(() =>
    mergeProps(
      typeahead.reference,
      listNavigation.reference,
      dismiss.reference,
      click.reference,
      interactionTypeProps,
    ),
  );

  const popupProps = createMemo(() =>
    mergeProps(FOCUSABLE_POPUP_PROPS, typeahead.floating, listNavigation.floating, dismiss.floating),
  );

  const itemRoot = createMemo(() => ({
    props: (listNavigation.item as any) ?? EMPTY_OBJECT,
    multiple: multiple(),
    disabled: disabled(),
    readOnly: readOnly(),
    isItemEqualToValue: isItemEqualToValue(),
  }));

  store.useContextCallback('isItemEqualToValue', isItemEqualToValue as any);
  store.useContextCallback('setValue', () => setValue);
  store.useContextCallback('handleScrollArrowVisibility', () => handleScrollArrowVisibility);

  // The prop bags must be in the store before the parts render.
  store.update({
    popupProps: untrack(popupProps),
    activeTriggerProps: untrack(mergedTriggerProps),
    itemRoot: untrack(itemRoot),
  } as any);

  store.useSyncedValues(
    () =>
      ({
        id: generatedId(),
        modal: modal(),
        selectionMode: multiple() ? 'multiple' : 'single',
        disabled: disabled(),
        readOnly: readOnly(),
        required: required(),
        highlightItemOnHover: highlightItemOnHover(),
        selectedValue: value(),
        popupProps: popupProps(),
        activeTriggerProps: mergedTriggerProps(),
        itemRoot: itemRoot(),
        items: props.items,
        itemToStringLabel: props.itemToStringLabel,
        itemToStringValue: props.itemToStringValue,
        isItemEqualToValue: isItemEqualToValue(),
        openMethod: renderedOpenMethod(),
      }) as any,
  );

  const hiddenInputName = () => (multiple() ? undefined : name());

  const hiddenInputValues = createMemo(() => {
    const currentValue = value();
    if (!multiple() || !Array.isArray(currentValue) || !name()) {
      return [] as string[];
    }

    return currentValue.map((item) => stringifyAsValue(item, props.itemToStringValue));
  });

  const selection = {
    get value() {
      return value();
    },
    get multiple() {
      return multiple();
    },
  };

  const validationProps = createMemo(() =>
    validation.getValidationProps(disabled(), {
      onFocus() {
        // Move focus to the trigger element when the hidden input is focused.
        store.state.triggerElement?.focus({
          // Supported in Chrome from 144 (January 2026)
          focusVisible: true,
        } as FocusOptions);
      },
      // Handle browser autofill.
      onChange(event: Event) {
        if (event.defaultPrevented || untrack(disabled) || untrack(readOnly)) {
          return;
        }

        const nextValue = (event.currentTarget as HTMLInputElement).value;
        const details = createChangeEventDetails(REASONS.none, event);

        function handleChange() {
          if (untrack(multiple)) {
            // Browser autofill only writes a single scalar value.
            return;
          }

          // Preserve the original serialized matching, then fall back to rendered text,
          // which browsers can autofill for primitive values like
          // `value="US">United States`.
          const nextValueLower = nextValue.toLowerCase();
          let matchingIndex = valuesRef.current.findIndex(
            (candidate) =>
              stringifyAsValue(candidate, props.itemToStringValue).toLowerCase() ===
                nextValueLower ||
              stringifyAsLabel(candidate, props.itemToStringLabel).toLowerCase() ===
                nextValueLower,
          );

          if (matchingIndex === -1) {
            matchingIndex = valuesRef.current.findIndex((_, index) => {
              const renderedLabel = labelsRef.current[index];
              return renderedLabel != null && renderedLabel.toLowerCase() === nextValueLower;
            });
          }

          const matchingValue = valuesRef.current[matchingIndex];
          if (matchingValue != null) {
            setValue(matchingValue, details as any);
          }
        }

        store.set('forceMounted', true);
        queueMicrotask(handleChange);
      },
    }),
  );

  return (
    <SelectRootContext value={store}>
      <SelectSelectionContext value={selection}>{props.children}</SelectSelectionContext>
      <input
        {...(validationProps() as any)}
        id={generatedId() && hiddenInputName() == null ? `${generatedId()}-hidden-input` : undefined}
        form={props.form}
        name={hiddenInputName()}
        type={getHiddenInputType(
          field.setValidityData !== NOOP,
          name(),
          props.autoComplete,
          required(),
          props.inputRef as any,
        )}
        autocomplete={props.autoComplete}
        value={serializedValue()}
        disabled={disabled()}
        required={required() && !(multiple() && hasSelectedValue())}
        readonly={readOnly()}
        ref={(el: HTMLInputElement) => {
          assignRefs(props.inputRef as RefInput<HTMLInputElement>, el);
          assignRefs(validation.inputRef as any, el);
        }}
        style={name() ? visuallyHiddenInput : visuallyHiddenInputPinned}
        onInvalid={handleHiddenInputInvalid as any}
        tabindex={-1}
        aria-hidden="true"
      />
      <For each={hiddenInputValues()}>
        {(serialized) => (
          <input
            type="hidden"
            form={props.form}
            name={name()}
            value={serialized}
            disabled={disabled()}
          />
        )}
      </For>
    </SelectRootContext>
  );
}

type SelectInputValue<Value, Multiple extends boolean | undefined> = Multiple extends true
  ? readonly Value[]
  : Value;

type SelectOutputValue<Value, Multiple extends boolean | undefined> = Multiple extends true
  ? Value[]
  : Value;

export interface SelectRootProps<Value, Multiple extends boolean | undefined = false> {
  children?: JSX.Element;
  /**
   * A ref to access the hidden input element.
   */
  inputRef?: RefInput<HTMLInputElement> | undefined;
  /**
   * Identifies the field when a form is submitted.
   */
  name?: string | undefined;
  /**
   * Identifies the form that owns the hidden input.
   * Useful when the select is rendered outside the form.
   */
  form?: string | undefined;
  /**
   * Provides a hint to the browser for autofill.
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/autocomplete
   */
  autoComplete?: string | undefined;
  /**
   * The id of the Select.
   */
  id?: string | undefined;
  /**
   * Whether the user must choose a value before submitting a form.
   * @default false
   */
  required?: boolean | undefined;
  /**
   * Whether the user should be unable to choose a different option from the select popup.
   * @default false
   */
  readOnly?: boolean | undefined;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Whether multiple items can be selected.
   * @default false
   */
  multiple?: Multiple | undefined;
  /**
   * Whether moving the pointer over items should highlight them.
   * Disabling this prop allows CSS `:hover` to be differentiated from the `:focus` (`data-highlighted`) state.
   * @default true
   */
  highlightItemOnHover?: boolean | undefined;
  /**
   * Whether the select popup is initially open.
   *
   * To render a controlled select popup, use the `open` prop instead.
   * @default false
   */
  defaultOpen?: boolean | undefined;
  /**
   * Event handler called when the select popup is opened or closed.
   */
  onOpenChange?:
    ((open: boolean, eventDetails: SelectRootOpenChangeEventDetails) => void) | undefined;
  /**
   * Event handler called after any animations complete when the select popup is opened or closed.
   */
  onOpenChangeComplete?: ((open: boolean) => void) | undefined;
  /**
   * Whether the select popup is currently open.
   */
  open?: boolean | undefined;
  /**
   * Determines if the select enters a modal state when open.
   * - `true`: user interaction is limited to the select: document page scroll is locked and pointer interactions on outside elements are disabled.
   * - `false`: user interaction with the rest of the document is allowed.
   *
   * On touch devices, a `true` modal blocks outside taps but leaves the page scrollable unless the popup spans nearly the full viewport width, matching native iOS behavior.
   * @default true
   */
  modal?: boolean | undefined;
  /**
   * A ref to imperative actions.
   * - `unmount`: Ends the closing phase of the select after an externally controlled closing animation finishes.
   * Call `preventUnmountOnClose()` in `onOpenChange` first, otherwise the select completes closing on its own.
   * Whether it leaves the DOM is decided by `keepMounted` on the portal.
   * - `close`: Closes the select imperatively when called.
   */
  actionsRef?: RefObject<SelectRootActions | null> | undefined;
  /**
   * Data structure of the items rendered in the select popup.
   * When specified, `<Select.Value>` renders the label of the selected item instead of the raw value.
   * @example
   * ```tsx
   * const items = {
   *   sans: 'Sans-serif',
   *   serif: 'Serif',
   *   mono: 'Monospace',
   *   cursive: 'Cursive',
   * };
   * <Select.Root items={items} />
   * ```
   */
  items?:
    | Record<string, JSX.Element>
    | ReadonlyArray<{ label: JSX.Element; value: any }>
    | ReadonlyArray<Group<any>>
    | undefined;
  /**
   * When the item values are objects (`<Select.Item value={object}>`), this function converts the object value to a string representation for display in the trigger.
   * If the shape of the object is `{ value, label }`, the label will be used automatically without needing to specify this prop.
   */
  itemToStringLabel?: ((itemValue: Value) => string) | undefined;
  /**
   * When the item values are objects (`<Select.Item value={object}>`), this function converts the object value to a string representation for form submission.
   * If the shape of the object is `{ value, label }`, the value will be used automatically without needing to specify this prop.
   */
  itemToStringValue?: ((itemValue: Value) => string) | undefined;
  /**
   * Custom comparison logic used to determine if a select item value matches the current selected value. Useful when item values are objects without matching referentially.
   * Defaults to `Object.is` comparison.
   */
  isItemEqualToValue?: ((itemValue: Value, value: Value) => boolean) | undefined;
  /**
   * The uncontrolled value of the select when it's initially rendered.
   *
   * To render a controlled select, use the `value` prop instead.
   */
  defaultValue?: SelectInputValue<Value, Multiple> | null | undefined;
  /**
   * The value of the select. Use when controlled.
   */
  value?: SelectInputValue<Value, Multiple> | null | undefined;
  /**
   * Event handler called when the value of the select changes.
   */
  onValueChange?:
    | ((
        value: SelectOutputValue<Value, Multiple> | (Multiple extends true ? never : null),
        eventDetails: SelectRootChangeEventDetails,
      ) => void)
    | undefined;
}

export interface SelectRootState {}

export interface SelectRootActions {
  unmount: () => void;
  close: () => void;
}

export type SelectRootChangeEventReason =
  | typeof REASONS.triggerPress
  | typeof REASONS.outsidePress
  | typeof REASONS.escapeKey
  | typeof REASONS.windowResize
  | typeof REASONS.itemPress
  | typeof REASONS.focusOut
  | typeof REASONS.listNavigation
  | typeof REASONS.cancelOpen
  | typeof REASONS.imperativeAction
  | typeof REASONS.none;

export type SelectRootOpenChangeEventDetails = SelectRootChangeEventDetails & {
  /** Prevents the popup from unmounting until the `unmount` action is called. */
  preventUnmountOnClose: () => void;
};

export type SelectRootChangeEventDetails = BaseUIChangeEventDetails<SelectRootChangeEventReason>;

export namespace SelectRoot {
  export type Props<Value, Multiple extends boolean | undefined = false> = SelectRootProps<
    Value,
    Multiple
  >;
  export type State = SelectRootState;
  export type Actions = SelectRootActions;
  export type ChangeEventReason = SelectRootChangeEventReason;
  export type ChangeEventDetails = SelectRootChangeEventDetails;
  export type OpenChangeEventDetails = SelectRootOpenChangeEventDetails;
}
