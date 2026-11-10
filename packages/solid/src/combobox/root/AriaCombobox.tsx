import type { JSX } from '@solidjs/web';
import type { RefObject } from 'base-ui-solidjs-utils/types';
import { createEffect, createMemo, createSignal, For, Show, untrack } from 'solid-js';
import { useControlled } from 'base-ui-solidjs-utils/useControlled';
import {
  visuallyHiddenInput,
  visuallyHiddenInputPinned,
} from 'base-ui-solidjs-utils/visuallyHidden';
import { EMPTY_ARRAY, EMPTY_OBJECT } from 'base-ui-solidjs-utils/empty';
import { activeElement, closest, contains, getTarget } from 'base-ui-solidjs-utils/shadowDom';
import { isHTMLElement } from '@floating-ui/utils/dom';
import { getOverflowAncestors } from '@floating-ui/dom';
import type { ElementProps } from '../../utils/popups/types';
import { useDismiss } from '../../utils/popups/interactions/useDismiss';
import { useSingleAnchorPopupRoot } from '../../utils/popups/popupRoot';
import { createInitialPopupStoreState, createPopupStoreContext } from '../../utils/popups/store';
import { useListNavigation } from '../../utils/popups/interactions/useListNavigation';
import { useClick } from '../../utils/popups/interactions/useClick';
import { gridNavigation } from '../../utils/popups/interactions/gridNavigation';
import {
  createChangeEventDetails,
  createGenericEventDetails,
} from '../../internals/createBaseUIEventDetails';
import type {
  BaseUIChangeEventDetails,
  BaseUIHighlightEventDetails,
} from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { getHighlightReason } from '../../utils/getHighlightReason';
import {
  ComboboxDerivedItemsContext,
  ComboboxHasItemsContext,
  ComboboxRootContext,
  ComboboxInputValueContext,
} from './ComboboxRootContext';
import { ComboboxStore, selectors } from '../store';
import type { State as StoreState } from '../store';
import { FOCUSABLE_POPUP_PROPS } from '../../utils/popups/popupStoreUtils';
import { useFieldRootContext } from '../../internals/field-root-context/FieldRootContext';
import { useRegisterFieldControl } from '../../internals/field-register-control/useRegisterFieldControl';
import { useFormContext } from '../../internals/form-context/FormContext';
import { useLabelableId } from '../../internals/labelable-provider/useLabelableId';
import { createCollatorItemFilter } from './utils';
import type { FilterItemToString } from './utils';
import { useCoreFilter } from './utils/useFilter';
import { useOpenInteractionType } from '../../utils/popups/interactions/useOpenInteractionType';
import { isScrollableY } from '../../utils/scrollable';
import type { BaseUIEvent, HTMLProps } from '../../internals/types';
import { useValueChanged } from '../../internals/useValueChanged';
import { NOOP } from '../../internals/noop';
import { getHiddenInputType } from '../../internals/getHiddenInputType';
import { mergeProps } from '../../merge-props';
import type { Group } from '../../internals/resolveValueLabel';
import {
  stringifyAsLabel,
  stringifyAsValue,
  flattenLeafItems,
  isGroupedItems,
} from '../../internals/resolveValueLabel';
import {
  compareItemEquality,
  defaultItemEquality,
  findItemIndex,
  findSelectionIndex,
  isSelectedValueDirty,
  removeItem,
  selectedValueIncludes,
} from '../../internals/itemEquality';
import { INITIAL_LAST_HIGHLIGHT, NO_ACTIVE_VALUE } from './utils/constants';
import { useDirection } from '../../internals/direction-context/DirectionContext';
import { handleHiddenInputInvalid } from '../../internals/handleHiddenInputInvalid';
import { findCollectionItem } from '../items/itemCollection';
import type { ComboboxItemCollection, ItemCollection } from '../items/itemCollection';
import { assignRefs, type RefInput } from '../../internals/useRenderElement';
import { ownedProps } from '../../internals/ownedProps';

type InternalAriaComboboxProps<Value, Mode extends SelectionMode, Item = Value> = AriaComboboxProps<
  Value,
  Mode,
  Item
> & {
  filterQuery?: string | undefined;
};

/**
 * The shared root of Combobox and Autocomplete.
 *
 * @internal
 */
export function AriaCombobox<Value, Mode extends SelectionMode = 'none', Item = Value>(
  props: Omit<InternalAriaComboboxProps<Value, Mode, Item>, 'items'> & {
    items: readonly Group<any>[];
  },
): JSX.Element;
export function AriaCombobox<Value, Mode extends SelectionMode = 'none', Item = Value>(
  props: Omit<InternalAriaComboboxProps<Value, Mode, Item>, 'items'> & {
    items?: readonly any[] | ComboboxItemCollection<Item, any> | undefined;
  },
): JSX.Element;
export function AriaCombobox<Value = any, Mode extends SelectionMode = 'none', Item = Value>(
  componentProps: InternalAriaComboboxProps<Value, Mode, Item>,
): JSX.Element {
  const props = ownedProps(componentProps) as InternalAriaComboboxProps<Value, Mode, Item> &
    Record<string, any>;

  // Props, read lazily.
  const selectionMode = () => props.selectionMode as SelectionMode;
  const readOnly = () => props.readOnly ?? false;
  const required = () => props.required ?? false;
  const grid = () => props.grid ?? false;
  const openOnInputClick = () => props.openOnInputClick ?? true;
  const keepHighlight = () => props.keepHighlight ?? false;
  const highlightItemOnHover = () => props.highlightItemOnHover ?? true;
  const loopFocus = () => props.loopFocus ?? true;
  const virtualized = () => props.virtualized ?? false;
  const inlineProp = () => props.inline ?? false;
  const fillInputOnItemPress = () => props.fillInputOnItemPress ?? true;
  const modal = () => props.modal ?? false;
  const limit = () => props.limit ?? -1;
  const autoComplete = () => props.autoComplete ?? 'list';
  const formAutoComplete = () => props.formAutoComplete;
  const submitOnItemClick = () => props.submitOnItemClick ?? false;
  const isItemEqualToValue = () => props.isItemEqualToValue ?? defaultItemEquality;
  const itemToStringValue = () => props.itemToStringValue;
  const form = () => props.form;
  const nameProp = () => props.name;
  const inputRefProp = () => props.inputRef;
  const itemsProp = () => props.items;
  const filteredItemsProp = () => props.filteredItems;
  const filterProp = () => props.filter;
  const filterQueryProp = () => props.filterQuery;
  const itemToStringLabelProp = () => props.itemToStringLabel;
  const locale = () => props.locale;

  const { clearErrors } = useFormContext();
  const field = useFieldRootContext();
  const { validation } = field;

  const direction = useDirection();
  const id = useLabelableId({
    get id() {
      return props.id;
    },
  } as any) as () => string | undefined;
  const collatorFilter = createMemo(() => useCoreFilter({ locale: locale() }));

  // Plain items are arrays; normalized `createItems()` collections are objects.
  const collection = createMemo(() => {
    const raw = itemsProp();
    const value = Array.isArray(raw)
      ? null
      : (raw as unknown as ItemCollection<Item, Value> | undefined);
    if (value && typeof value.label !== 'function') {
      throw new Error(
        'Base UI: the `items` prop received an object that is not a collection, ' +
          'so its items cannot be read. Pass an array of items, an array of groups with items, ' +
          'or the result of `createItems()`. ' +
          'See https://base-ui.com/react/components/combobox#createitems',
      );
    }
    return value;
  });

  const items = createMemo(
    () =>
      (collection() ? collection()!.data : itemsProp()) as
        readonly Item[] | readonly Group<Item>[] | undefined,
  );
  const itemToValue = () => collection()?.value;

  // A projected collection's items live in the source domain, not the selection-value domain the
  // store matches against, so they are withheld from the store.
  const storeItems = () => (itemToValue() ? undefined : items());

  // The externally filtered items projected to their selection values, with a lookup back to the
  // source items.
  const externalWindow = createMemo(() => {
    const filtered = filteredItemsProp();
    const toValue = itemToValue();
    if (!filtered || !toValue) {
      return undefined;
    }
    const flat = flattenLeafItems(filtered as any);
    const values = flat.map(toValue as any);
    let valueToItem: Map<any, any> | undefined;

    return {
      values,
      findItem(itemValue: any, isEqual: (item: any, value: any) => boolean) {
        if (!valueToItem) {
          valueToItem = new Map();
          for (let i = 0; i < values.length; i += 1) {
            if (!valueToItem.has(values[i])) {
              valueToItem.set(values[i], flat[i]);
            }
          }
        }

        return findCollectionItem(valueToItem, itemValue, isEqual);
      },
    };
  });

  // Labels selection values from current props only: collection data first, then the current
  // external window, then the prop.
  const itemToStringLabel = createMemo(() => {
    const currentCollection = collection();
    const labelProp = itemToStringLabelProp();
    if (!currentCollection) {
      return labelProp;
    }
    const isEqual = isItemEqualToValue();
    const windowValue = externalWindow();
    return (itemValue: Value) => {
      return currentCollection.label(itemValue, isEqual, (unresolvedValue: any) => {
        const externalItem = windowValue?.findItem(unresolvedValue, isEqual);
        if (externalItem != null) {
          return currentCollection.itemLabel(externalItem);
        }
        return stringifyAsLabel(unresolvedValue, labelProp);
      });
    };
  });

  const filterItemToString = createMemo<FilterItemToString | undefined>(() => {
    const currentCollection = collection();
    if (!currentCollection) {
      return itemToStringLabelProp() as any;
    }
    const toLabel = itemToStringLabel();
    return Object.assign((item: any) => currentCollection.itemLabel(item), {
      selected: (value: any) => stringifyAsLabel(value, toLabel as any),
    });
  });

  function stringifyValueLabel(item: any) {
    return stringifyAsLabel(item, itemToStringLabel() as any);
  }

  const [queryChangedAfterOpen, setQueryChangedAfterOpen] = createSignal(false, {
    ownedWrite: true,
  });
  const [closeQuery, setCloseQuery] = createSignal<string | null>(null, { ownedWrite: true });
  const previousCloseQueryRef: { current: string | null } = { current: null };

  const listRef: RefObject<Array<HTMLElement | null>> = { current: [] };
  const labelsRef: RefObject<Array<string | null>> = { current: [] };
  const popupRef: RefObject<HTMLDivElement | null> = { current: null };
  const inputRef: RefObject<HTMLInputElement | null> = { current: null };
  const hiddenInputElementRef: RefObject<HTMLInputElement | null> = { current: null };
  const startDismissRef: RefObject<HTMLSpanElement | null> = { current: null };
  const endDismissRef: RefObject<HTMLSpanElement | null> = { current: null };
  const emptyRef: RefObject<HTMLDivElement | null> = { current: null };
  const hadInputClearRef = { current: false };
  const chipsContainerRef: RefObject<HTMLDivElement | null> = { current: null };
  const clearRef: RefObject<HTMLButtonElement | null> = { current: null };
  const selectionEventRef: RefObject<MouseEvent | PointerEvent | KeyboardEvent | null> = {
    current: null,
  };
  const lastHighlightRef = { current: INITIAL_LAST_HIGHLIGHT as { value: any; index: number } };
  const pendingQueryHighlightRef: {
    current: null | {
      hasQuery: boolean;
      selection?: boolean | undefined;
      toggledValue?: any;
    };
  } = { current: null };

  const valuesRef: RefObject<any[]> = { current: [] };
  const pointerDownItemRef: RefObject<Element | null> = { current: null };

  const disabled = () => field.disabled || (props.disabled ?? false);
  const name = () => field.name ?? nameProp();
  const multiple = () => selectionMode() === 'multiple';
  const single = () => selectionMode() === 'single';
  const hasInputValue = () =>
    props.inputValue !== undefined || props.defaultInputValue !== undefined;
  const hasItems = () => items() !== undefined;
  const hasFilteredItemsProp = () => filteredItemsProp() !== undefined;

  const autoHighlightMode = (): false | 'input-change' | 'always' => {
    const autoHighlight = props.autoHighlight ?? false;
    if (autoHighlight === 'always') {
      return 'always';
    }
    return autoHighlight ? 'input-change' : false;
  };

  const [selectedValue, setSelectedValueUnwrapped] = useControlled<any>({
    controlled: () => props.selectedValue,
    default: untrack(() =>
      multiple()
        ? (props.defaultSelectedValue ?? EMPTY_ARRAY)
        : (props.defaultSelectedValue ?? null),
    ),
    name: 'Combobox',
    state: 'selectedValue',
  });

  const filter = createMemo(() => {
    const filterValue = filterProp();
    if (filterValue === null) {
      return () => true;
    }
    if (filterValue !== undefined) {
      return filterValue as (item: any, query: string, itemToString?: any) => boolean;
    }
    // `shouldBypassFiltering` already empties the query whenever a single selection's label
    // matches it exactly, so the filter never needs a selection-aware variant here.
    return createCollatorItemFilter(collatorFilter(), filterItemToString());
  });

  // If neither inputValue nor defaultInputValue are provided, derive it from the
  // selected value for single mode so the input reflects the selection on mount.
  const initialDefaultInputValue = untrack(() => {
    if (hasInputValue()) {
      return props.defaultInputValue ?? '';
    }
    if (single()) {
      return stringifyValueLabel(selectedValue());
    }
    return '';
  });

  const [inputValue, setInputValueUnwrapped] = useControlled<any>({
    controlled: () => props.inputValue,
    default: initialDefaultInputValue,
    name: 'Combobox',
    state: 'inputValue',
  });

  // Support composing the Dialog component around an inline combobox: its transitions wait for
  // the dialog's animations. The transitions read the element through this ref, which an effect
  // points at it.
  const animatedPopupRef = {
    target: popupRef as RefObject<HTMLElement | null>,
    get current() {
      return this.target.current;
    },
  };

  const {
    store: rootStore,
    open,
    transitionStatus,
  } = useSingleAnchorPopupRoot(
    {
      get open() {
        return props.open;
      },
      get defaultOpen() {
        return props.defaultOpen ?? false;
      },
      // `handleOpenChange` calls `props.onOpenChange` with the Root's own handling around it.
      onOpenChange: (nextOpen: boolean, eventDetails: AriaCombobox.OpenChangeEventDetails) =>
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        handleOpenChange(nextOpen, eventDetails),
      get onOpenChangeComplete() {
        return props.onOpenChangeComplete;
      },
      get actionsRef() {
        return props.actionsRef;
      },
    } as any,
    ((initialState: any, defaultPopupId: any) =>
      untrack(
        () =>
          new ComboboxStore(
            {
              ...createInitialPopupStoreState(defaultPopupId),
              ...initialState,
              id: id(),
              labelId: undefined,
              selectedValue: selectedValue(),
              items: storeItems(),
              selectionMode: selectionMode(),
              name: name(),
              form: form(),
              disabled: disabled(),
              readOnly: readOnly(),
              required: required(),
              grid: grid(),
              virtualized: virtualized(),
              openOnInputClick: openOnInputClick(),
              itemToStringLabel: itemToStringLabel(),
              isItemEqualToValue: isItemEqualToValue(),
              modal: modal(),
              autoHighlight: autoHighlightMode(),
              submitOnItemClick: submitOnItemClick(),
              hasInputValue: hasInputValue(),
              forceMounted: false,
              inline: inlineProp(),
              activeIndex: null,
              selectedIndex: null,
              listProps: {},
              inputProps: {},
              itemRoot: {
                props: EMPTY_OBJECT,
                id: id(),
                selectionMode: selectionMode(),
                disabled: disabled(),
                readOnly: readOnly(),
                isItemEqualToValue: isItemEqualToValue(),
              },
              listElement: null,
              popupElementId: undefined,
              triggerElement: null,
              inputElement: null,
              inputGroupElement: null,
              popupSide: null,
              openMethod: null,
              inputInsidePopup: true,
              inputOwnsFormValue: selectionMode() === 'none',
              instantType: undefined,
              adaptiveOrigin: undefined,
            } as any,
            {
              ...createPopupStoreContext(),
              // Placeholder callbacks replaced below.
              handleUnmount: NOOP,
              setInputValue: NOOP,
              setSelectedValue: NOOP,
              setIndices: NOOP,
              handleSelection: NOOP,
              forceMount: NOOP,
              requestSubmit: NOOP,
              listRef,
              labelsRef,
              popupRef,
              emptyRef,
              inputRef,
              startDismissRef,
              endDismissRef,
              chipsContainerRef,
              clearRef,
              valuesRef,
              pointerDownItemRef,
              selectionEventRef,
            } as any,
            selectors,
          ),
      )) as any,
    animatedPopupRef,
  );
  const store = rootStore as unknown as ComboboxStore;

  const isGrouped = () => isGroupedItems(items() as any);
  const query = createMemo(() =>
    !open() && closeQuery() !== null ? closeQuery()! : String(inputValue()).trim(),
  );

  const selectedLabelString = createMemo(() =>
    single() ? stringifyValueLabel(selectedValue()) : '',
  );

  const shouldBypassFiltering = createMemo(
    () =>
      single() &&
      !queryChangedAfterOpen() &&
      query() !== '' &&
      selectedLabelString().length === query().length &&
      collatorFilter().contains(selectedLabelString(), query()),
  );

  const filterQuery = () => (shouldBypassFiltering() ? '' : (filterQueryProp() ?? query()));
  const shouldIgnoreExternalFiltering = () =>
    hasItems() &&
    hasFilteredItemsProp() &&
    shouldBypassFiltering() &&
    (!collection() || collection()!.hasValue(selectedValue(), isItemEqualToValue()));

  const flatItems = createMemo<readonly Item[]>(() =>
    items() ? flattenLeafItems<Item>(items() as any) : (EMPTY_ARRAY as any),
  );

  const filteredItems = createMemo<Item[] | Group<Item>[]>(() => {
    if (filteredItemsProp() && !shouldIgnoreExternalFiltering()) {
      return filteredItemsProp() as Item[] | Group<Item>[];
    }

    if (!items()) {
      return EMPTY_ARRAY;
    }

    if (isGrouped()) {
      const groupedItems = items();
      const resultingGroups: Group<Item>[] = [];
      let currentCount = 0;

      for (const group of groupedItems as readonly Group<Item>[]) {
        if (limit() > -1 && currentCount >= limit()) {
          break;
        }

        const remainingLimit = limit() > -1 ? limit() - currentCount : Infinity;
        const itemsToTake = filterQuery() === '' ? group.items.slice(0, remainingLimit) : [];

        if (filterQuery() !== '') {
          for (const item of group.items) {
            if (itemsToTake.length >= remainingLimit) {
              break;
            }
            if (filter()(item, filterQuery(), filterItemToString())) {
              itemsToTake.push(item);
            }
          }
        }

        if (itemsToTake.length > 0) {
          const newGroup = { ...group, items: itemsToTake };
          resultingGroups.push(newGroup);
          currentCount += itemsToTake.length;
        }
      }

      return resultingGroups;
    }

    if (filterQuery() === '') {
      return limit() > -1
        ? flatItems().slice(0, limit())
        : // The cast here is done as `flatItems` is readonly.
          // valuesRef.current, a mutable ref, can be set to `flatFilteredValues`, which may
          // reference this exact readonly value, creating a mutation risk.
          // However, <Combobox.Item> can never mutate this value as the mutating effect
          // bails early when `items` is provided, and this is only ever returned
          // when `items` is provided due to the early return at the top of this hook.
          (flatItems() as Item[]);
    }

    const limitedItems: Item[] = [];
    for (const item of flatItems()) {
      if (limit() > -1 && limitedItems.length >= limit()) {
        break;
      }
      if (filter()(item, filterQuery(), filterItemToString())) {
        limitedItems.push(item);
      }
    }

    return limitedItems;
  });

  const flatFilteredValues = createMemo<any[]>(() => {
    const windowValue = externalWindow();
    const filtered = filteredItems();
    if (windowValue && filtered === filteredItemsProp()) {
      return windowValue.values;
    }
    const flat = flattenLeafItems<Item>(filtered as any);
    const toValue = itemToValue();
    return toValue ? flat.map((item) => (toValue as any)(item)) : (flat as any[]);
  });

  // An inline list open on the first render never gets a closed pass of the closed-state
  // sync effect below, and `items`-prop lists don't self-register their index, so seed it.
  untrack(() => {
    if (inlineProp() && open() && hasItems() && selectionMode() !== 'none') {
      store.set(
        'selectedIndex',
        findSelectionIndex(flatFilteredValues(), selectedValue(), isItemEqualToValue(), multiple()),
      );
    }
  });

  const fieldRawValue = () => (selectionMode() === 'none' ? inputValue() : selectedValue());
  const fieldStringValue = createMemo(() => {
    if (selectionMode() === 'none') {
      return fieldRawValue();
    }
    const value = selectedValue();
    if (Array.isArray(value)) {
      return value.map((item) => stringifyAsValue(item, itemToStringValue()));
    }
    return stringifyAsValue(value, itemToStringValue());
  });

  const activeIndex = store.useState('activeIndex');
  const selectedIndex = store.useState('selectedIndex');
  const positionerElement = store.useState('positionerElement');
  const listElement = store.useState('listElement');
  const triggerElement = store.useState('triggerElement');
  const inputElement = store.useState('inputElement');
  const inputGroupElement = store.useState('inputGroupElement');
  const inline = store.useState('inline');
  const inputInsidePopup = store.useState('inputInsidePopup');
  const inputOwnsFormValue = store.useState('inputOwnsFormValue');
  const inputMatchesSelectedValue = () =>
    single() && !inputInsidePopup() && inputValue() === selectedLabelString();

  const { openMethod, triggerProps } = useOpenInteractionType(open);

  const controlRef = {
    get current() {
      return untrack(() => (inputInsidePopup() ? triggerElement() : inputRef.current));
    },
  };

  useRegisterFieldControl(
    controlRef as any,
    id as any,
    fieldRawValue,
    () => untrack(fieldStringValue),
    () => !disabled(),
    nameProp,
  );

  const { setTouched, setFocused, setDirty, setFilled } = field;

  const forceMount = () => {
    if (items()) {
      // Ensure typeahead works on a closed list.
      labelsRef.current = flatFilteredValues().map(stringifyValueLabel);
    } else {
      store.set('forceMounted', true);
    }
  };

  /**
   * Emits `onItemHighlighted` for the item at `index`, or clears the highlight when `index` is `-1`
   * (a no-op if nothing was highlighted). Keeps `lastHighlightRef` in sync with what was emitted.
   */
  const emitHighlight = (
    value: any,
    index: number,
    type: AriaCombobox.HighlightEventReason,
    event?: Event,
  ) => {
    if (index === -1) {
      if (lastHighlightRef.current === INITIAL_LAST_HIGHLIGHT) {
        return;
      }
      lastHighlightRef.current = INITIAL_LAST_HIGHLIGHT;
    } else {
      lastHighlightRef.current = { value, index };
    }

    props.onItemHighlighted?.(value, createGenericEventDetails(type, event, { index }));
  };

  const setIndices = (options: {
    activeIndex?: number | null | undefined;
    selectedIndex?: number | null | undefined;
    type?: AriaCombobox.HighlightEventReason | undefined;
    event?: Event | undefined;
  }) => {
    const update = {} as Pick<StoreState, 'activeIndex' | 'selectedIndex'>;

    if (options.activeIndex !== undefined) {
      update.activeIndex = options.activeIndex;
    }

    if (options.selectedIndex !== undefined) {
      update.selectedIndex = options.selectedIndex;
    }

    store.update(update);

    const activeIndexOption = options.activeIndex;
    if (activeIndexOption === undefined) {
      return;
    }

    const type: AriaCombobox.HighlightEventReason = options.type || REASONS.none;

    if (activeIndexOption === null) {
      emitHighlight(undefined, -1, type, options.event);
    } else {
      emitHighlight(valuesRef.current[activeIndexOption], activeIndexOption, type, options.event);
    }
  };

  const setInputValue = (next: string, eventDetails: AriaCombobox.ChangeEventDetails) => {
    props.onInputValueChange?.(next, eventDetails);

    if (eventDetails.isCanceled) {
      return;
    }

    // A canceled selection clear must not suppress close-completion cleanup.
    hadInputClearRef.current = eventDetails.reason === REASONS.inputClear;

    // If user is typing, ensure we don't auto-highlight on open due to a race
    // with the post-open effect that sets this flag.
    if (eventDetails.reason === REASONS.inputChange) {
      // A controlled popup may ignore a close request. Resuming input proves the popup
      // is remaining open, so release the query captured for an exit animation.
      if (open() && closeQuery() !== null) {
        setCloseQuery(null);
      }

      const event = eventDetails.event as Event;
      const inputType = (event as InputEvent).inputType;
      // Treat composition commits as typed input; autofill may omit `inputType` or
      // report `insertReplacementText`.
      const isTypedInput =
        event.type === 'compositionend' ||
        (inputType != null && inputType !== '' && inputType !== 'insertReplacementText');
      if (isTypedInput) {
        const hasQuery = next.trim() !== '';
        if (hasQuery) {
          setQueryChangedAfterOpen(true);
        }
        // Defer index updates until after the filtered items have been derived to ensure
        // `onItemHighlighted` receives the latest item.
        pendingQueryHighlightRef.current = { hasQuery };

        // Virtualized lists own their scroller. Reset regular lists directly so a stale
        // composite registry cannot select a reordered item and scrolling cannot escape
        // the popup.
        const list = store.state.listElement;
        if (!store.state.virtualized && list) {
          const popup = popupRef.current;
          for (const ancestor of getOverflowAncestors(list.firstElementChild ?? list)) {
            if (
              !isHTMLElement(ancestor) ||
              (popup ? !contains(popup, ancestor) : ancestor.getAttribute('role') === 'dialog')
            ) {
              break;
            }

            if (isScrollableY(ancestor)) {
              ancestor.scrollTop = 0;
              break;
            }
          }
        }

        if (
          hasQuery &&
          autoHighlightMode() &&
          store.state.activeIndex == null &&
          (open() || inline())
        ) {
          store.set('activeIndex', 0);
        }
      }
    } else if (
      eventDetails.reason === REASONS.inputClear &&
      next === '' &&
      store.state.inputInsidePopup
    ) {
      // A programmatic clear of an active query (e.g. after selecting an item with the
      // input inside the popup): restore the highlight to the selected item.
      pendingQueryHighlightRef.current = { hasQuery: false, selection: true };
    }

    setInputValueUnwrapped(next);
  };

  const handleInterruptedReopen = (isInputChange: boolean) => {
    // Preserve values supplied with the reopen rather than owned by the interrupted close.
    const clearsPendingInput =
      !isInputChange &&
      inputInsidePopup() &&
      !inline() &&
      inputValue() !== '' &&
      (String(inputValue()).trim() === closeQuery() || inputValue() === selectedLabelString());

    // Keep the flag while a visible filter survives so the `items` sync cannot overwrite it.
    if (
      !isInputChange &&
      (clearsPendingInput || inputValue() === '' || inputMatchesSelectedValue())
    ) {
      setQueryChangedAfterOpen(false);
    }

    setCloseQuery(null);

    if (clearsPendingInput) {
      // Cleanup clears omit the selection flag and reopening gesture.
      setInputValue('', createChangeEventDetails(REASONS.inputClear));
    }
  };

  // Calls `onOpenChange` for every open change that isn't ignored, with the combobox's own handling
  // around it, before the store commits the change.
  const handleOpenChange = (
    nextOpen: boolean,
    eventDetails: AriaCombobox.OpenChangeEventDetails,
  ) => {
    // If the `Empty` component is not used, the positioner or popup should be hidden
    // with CSS. In this case, allow the Escape key to bubble to close a parent popup
    // if there are no items to show.
    if (
      eventDetails.reason === REASONS.escapeKey &&
      hasItems() &&
      flatFilteredValues().length === 0 &&
      !emptyRef.current
    ) {
      eventDetails.allowPropagation();
    }

    props.onOpenChange?.(nextOpen, eventDetails);

    // A typed request must not highlight a later open: discard it when its own open is
    // rejected, or when any other open change goes through.
    if (
      pendingQueryHighlightRef.current?.hasQuery &&
      (eventDetails.reason === REASONS.inputChange) === eventDetails.isCanceled
    ) {
      pendingQueryHighlightRef.current = null;
    }

    if (eventDetails.isCanceled) {
      return;
    }

    if (nextOpen && closeQuery() !== null) {
      // `ComboboxInput` calls `setInputValue` before `setOpen`, so on an input-change reopen
      // `inputValue` is still the pre-keystroke value and the typed filter always survives.
      handleInterruptedReopen(eventDetails.reason === REASONS.inputChange);
    }

    if (!nextOpen && queryChangedAfterOpen()) {
      if (single()) {
        if (!inline()) {
          setCloseQuery(query());
        }
        // Avoid a flicker when closing the popup with an empty query.
        if (query() === '') {
          setQueryChangedAfterOpen(false);
        }
      } else if (multiple()) {
        if (!inline()) {
          // Freeze the current query so filtering remains stable while exiting.
          setCloseQuery(query());
        }

        if (inputInsidePopup()) {
          setIndices({ activeIndex: null });
        }

        // Clear the input immediately on close while retaining filtering via closeQuery for exit animations
        // if the input is outside the popup. When the input is inside the popup, defer the clear until
        // unmount so the filtered list doesn't flash to unfiltered during the exit animation.
        if (!inputInsidePopup() || inline()) {
          setInputValue(
            '',
            createChangeEventDetails(REASONS.inputClear, eventDetails.event, undefined, {
              isItemPress: eventDetails.reason === REASONS.itemPress,
            }),
          );
        }
      }
    }

    if (
      !nextOpen &&
      inputInsidePopup() &&
      (eventDetails.reason === REASONS.focusOut || eventDetails.reason === REASONS.outsidePress)
    ) {
      setTouched(true);
      setFocused(false);

      if (field.validationMode === 'onBlur') {
        const valueToValidate = selectionMode() === 'none' ? inputValue() : selectedValue();
        validation.commit(valueToValidate);
      }
    }
  };

  const setSelectedValue = (
    nextValue: Value | Value[] | null,
    eventDetails: AriaCombobox.ChangeEventDetails,
  ) => {
    // Cast to `any` due to conditional value type (single vs. multiple).
    // The runtime implementation already ensures the correct value shape.
    props.onSelectedValueChange?.(nextValue as any, eventDetails);

    if (eventDetails.isCanceled) {
      return;
    }

    setSelectedValueUnwrapped(nextValue);

    const shouldFillInput =
      (selectionMode() === 'none' && popupRef.current && fillInputOnItemPress()) ||
      (single() && !store.state.inputInsidePopup);

    if (shouldFillInput) {
      setInputValue(
        stringifyValueLabel(nextValue),
        createChangeEventDetails(eventDetails.reason, eventDetails.event),
      );
    }
  };

  const handleSelection = (event: MouseEvent | PointerEvent | KeyboardEvent, itemValue: any) => {
    const targetEl = getTarget(event) as HTMLElement | null;
    const overrideEvent = selectionEventRef.current ?? event;
    selectionEventRef.current = null;
    const eventDetails = createChangeEventDetails(REASONS.itemPress, overrideEvent);

    // Let the link handle the click.
    const href = closest(targetEl, 'a')?.getAttribute('href');
    if (href) {
      if (href.startsWith('#')) {
        store.setOpen(false, eventDetails as any);
      }
      return;
    }

    if (multiple()) {
      const currentSelectedValue = Array.isArray(selectedValue()) ? selectedValue() : [];
      const isCurrentlySelected = selectedValueIncludes(
        currentSelectedValue,
        itemValue,
        isItemEqualToValue(),
      );
      const nextValue = isCurrentlySelected
        ? removeItem(currentSelectedValue, itemValue, isItemEqualToValue())
        : [...currentSelectedValue, itemValue];

      setSelectedValue(nextValue, eventDetails);

      if (eventDetails.isCanceled) {
        return;
      }

      const wasFiltering = inputRef.current ? inputRef.current.value.trim() !== '' : false;
      if (!wasFiltering) {
        return;
      }

      if (store.state.inputInsidePopup) {
        setInputValue(
          '',
          createChangeEventDetails(REASONS.inputClear, eventDetails.event, undefined, {
            isItemPress: true,
          }),
        );
        // A newly selected item stays highlighted through the clear; a deselection
        // falls back to the standard selection anchor.
        const pendingHighlight = pendingQueryHighlightRef.current;
        if (pendingHighlight && !isCurrentlySelected) {
          pendingHighlight.toggledValue = itemValue;
        }
      } else {
        store.setOpen(false, eventDetails as any);
      }
    } else {
      setSelectedValue(itemValue, eventDetails);

      if (eventDetails.isCanceled) {
        return;
      }

      store.setOpen(false, eventDetails as any);
    }
  };

  const requestSubmit = () => {
    // Not `validation.inputRef`: outside a Field, every control shares it.
    const formElement = hiddenInputElementRef.current?.form ?? store.state.inputElement?.form;
    if (formElement && typeof formElement.requestSubmit === 'function') {
      formElement.requestSubmit();
    }
  };

  const handleUnmount = () => {
    setQueryChangedAfterOpen(false);
    setCloseQuery(null);

    if (selectionMode() === 'none') {
      setIndices({ activeIndex: null, selectedIndex: null });
    } else {
      setIndices({ activeIndex: null });
    }

    // Multiple selection mode:
    // If the user typed a filter and didn't select in multiple mode, clear the input
    // after close completes to avoid mid-exit flicker and start fresh on next open.
    if (
      multiple() &&
      inputRef.current &&
      inputRef.current.value !== '' &&
      !hadInputClearRef.current
    ) {
      setInputValue('', createChangeEventDetails(REASONS.inputClear));
    }

    // Single selection mode:
    // - If input is rendered inside the popup, clear it so the next open is blank
    // - If input is outside the popup, sync it to the selected value
    if (single()) {
      if (store.state.inputInsidePopup) {
        if (inputRef.current && inputRef.current.value !== '') {
          setInputValue('', createChangeEventDetails(REASONS.inputClear));
        }
      } else {
        const stringVal = stringifyValueLabel(selectedValue());
        if (inputRef.current && inputRef.current.value !== stringVal) {
          // If no selection was made, treat this as clearing the typed filter.
          const reason = stringVal === '' ? REASONS.inputClear : REASONS.none;
          setInputValue(stringVal, createChangeEventDetails(reason));
        }
      }
    }
  };

  // Support composing the Dialog component around an inline combobox.
  // `[role="dialog"]` is more interoperable than using a context, e.g. it can work
  // with third-party modal libraries, though the limitation is that the closest
  // `role=dialog` part must be the animated element.
  const resolvedPopupRef = createMemo<RefObject<HTMLElement | null>>(() => {
    const positioner = positionerElement();
    if (inline() && positioner) {
      return { current: closest(positioner, '[role="dialog"]') as HTMLElement | null };
    }
    return popupRef;
  });

  createEffect(resolvedPopupRef, (ref) => {
    animatedPopupRef.target = ref;
  });

  createEffect(
    () =>
      [
        open(),
        closeQuery(),
        selectedValue(),
        selectionMode(),
        multiple(),
        hasItems(),
        flatFilteredValues(),
        isItemEqualToValue(),
      ] as const,
    function syncSelectedIndex([
      isOpen,
      currentCloseQuery,
      currentSelectedValue,
      mode,
      isMultiple,
      withItems,
      filteredValues,
      equality,
    ]) {
      const closeQueryReleased =
        previousCloseQueryRef.current !== null && currentCloseQuery === null;
      previousCloseQueryRef.current = currentCloseQuery;

      // Closing indexes against the frozen filtered list. Reopening releases that query, so its
      // rendered coordinates must be synchronized again even though the popup is already open.
      if (isOpen && (!closeQueryReleased || !withItems)) {
        return;
      }

      // State-driven (not tied to the internal event path) so controlled closes
      // also clear a pointerdown that never received a matching item mouseup.
      if (!isOpen) {
        pointerDownItemRef.current = null;
      }

      if (mode === 'none') {
        return;
      }

      // Keep the selected index in the coordinates of the list that is actually rendered.
      const registry: readonly any[] = withItems ? filteredValues : valuesRef.current;

      untrack(() =>
        setIndices({
          selectedIndex: findSelectionIndex(registry, currentSelectedValue, equality, isMultiple),
        }),
      );
    },
  );

  createEffect(
    () => [items(), flatFilteredValues()] as const,
    ([currentItems, filteredValues]) => {
      if (currentItems) {
        valuesRef.current = filteredValues;
        listRef.current.length = filteredValues.length;
      }
    },
  );

  createEffect(open, (isOpen) => {
    // Controlled closes can bypass `setOpen`, and their exit animation may be interrupted.
    if (!isOpen && pendingQueryHighlightRef.current?.hasQuery) {
      pendingQueryHighlightRef.current = null;
    }
  });

  createEffect(
    () =>
      [
        activeIndex(),
        autoHighlightMode(),
        hasFilteredItemsProp(),
        hasItems(),
        flatFilteredValues(),
        inline(),
        open(),
        resolvedPopupRef(),
        inputValue(),
      ] as const,
    () =>
      untrack(() => {
        // A kept-mounted dialog hides its inline list on close. Discard query-clear restoration
        // before it can overwrite the cleared highlight or report an item from the unfiltered list.
        if (!open() && inline() && resolvedPopupRef().current) {
          pendingQueryHighlightRef.current = null;
          return;
        }

        const candidateItems =
          hasItems() || hasFilteredItemsProp() ? flatFilteredValues() : valuesRef.current;
        const pendingHighlight = pendingQueryHighlightRef.current;
        if (pendingHighlight) {
          // A directly rendered list remains visible when the popup state is closed, while a
          // kept-mounted Positioner is hidden and should stay inert.
          const listIsNavigable =
            open() || inline() || store.state.positionerElement?.hidden === false;
          if (pendingHighlight.hasQuery) {
            const input = inputRef.current;
            // Keep the request while results or a controlled popup opening are pending,
            // but do not restore an inline highlight after focus has left the input.
            if (
              !autoHighlightMode() ||
              String(inputValue()).trim() === '' ||
              (inline() &&
                autoHighlightMode() !== 'always' &&
                (!input || activeElement(input.ownerDocument) !== input))
            ) {
              pendingQueryHighlightRef.current = null;
            } else if (
              listIsNavigable &&
              // Individually rendered items register without re-running this effect, and their
              // registry has holes mid-reindex, so resolve their request immediately.
              (candidateItems[0] !== undefined || (!hasItems() && !hasFilteredItemsProp()))
            ) {
              store.set('activeIndex', 0);
              pendingQueryHighlightRef.current = null;
            }
          } else if (String(inputValue()).trim() === '') {
            // Only handle the clear once it has committed (a controlled input may reject it),
            // so a restore cannot fire while a query is still active.
            pendingQueryHighlightRef.current = null;
            if (listIsNavigable) {
              const clearedBySelection = pendingHighlight.selection;
              if (
                autoHighlightMode() === 'always' &&
                !clearedBySelection &&
                store.state.selectionMode === 'none'
              ) {
                // There is no selection to restore in Autocomplete. Keep the first-item reset
                // synchronous so list navigation sees it before a directly rendered list closes.
                store.set('activeIndex', 0);
              }

              // Items re-mounted by the clear publish their composite indices in a follow-up
              // commit, so the item registries are mid-update here. Defer to a microtask.
              queueMicrotask(() => {
                if (
                  (!store.select('open') && (!store.state.inline || resolvedPopupRef().current)) ||
                  (inputRef.current && inputRef.current.value.trim() !== '')
                ) {
                  return;
                }

                // Return the highlight to the selected item, the same anchor the popup uses
                // when it first opens. Read the selection through the store so consumers can
                // pass an inline `isItemEqualToValue` or a fresh `selectedValue` array without
                // re-running this effect on every render.
                const currentSelectedValue = store.state.selectedValue;
                const isMultiple = store.state.selectionMode === 'multiple';
                const hasSelection =
                  isMultiple && Array.isArray(currentSelectedValue)
                    ? currentSelectedValue.length > 0
                    : store.state.selectionMode !== 'none' && currentSelectedValue != null;

                if (hasSelection) {
                  const registry =
                    hasItems() || hasFilteredItemsProp() ? flatFilteredValues() : valuesRef.current;
                  // A selection-driven clear keeps the just-selected item highlighted;
                  // otherwise return to the open anchor. A selection that is no longer in
                  // the list drops the highlight rather than leaving it on whichever item
                  // now occupies that index.
                  // `findItemIndex` resolves to -1 when no value was toggled.
                  const toggledIndex = findItemIndex(
                    registry,
                    pendingHighlight.toggledValue,
                    store.state.isItemEqualToValue,
                  );
                  store.set(
                    'activeIndex',
                    toggledIndex !== -1
                      ? toggledIndex
                      : findSelectionIndex(
                          registry,
                          currentSelectedValue,
                          store.state.isItemEqualToValue,
                          isMultiple,
                        ),
                  );
                } else if (clearedBySelection) {
                  store.set('activeIndex', null);
                } else if (autoHighlightMode() === 'always') {
                  store.set('activeIndex', 0);
                }
              });
            }
          }
        }

        if (!open() && !inline()) {
          return;
        }

        const storeActiveIndex = store.state.activeIndex;

        if (storeActiveIndex == null) {
          if (autoHighlightMode() === 'always' && candidateItems.length > 0) {
            store.set('activeIndex', 0);
            return;
          }
          emitHighlight(undefined, -1, REASONS.none);
          return;
        }

        if (storeActiveIndex >= candidateItems.length) {
          emitHighlight(undefined, -1, REASONS.none);
          store.set('activeIndex', null);
          return;
        }

        const itemValue = candidateItems[storeActiveIndex];
        const previouslyHighlightedItemValue = lastHighlightRef.current.value;
        const isSameItem =
          previouslyHighlightedItemValue !== NO_ACTIVE_VALUE &&
          compareItemEquality(
            itemValue,
            previouslyHighlightedItemValue,
            store.state.isItemEqualToValue,
          );

        if (lastHighlightRef.current.index !== storeActiveIndex || !isSameItem) {
          emitHighlight(itemValue, storeActiveIndex, REASONS.none);
        }
      }),
  );

  createEffect(
    () => [selectionMode(), inputValue(), selectedValue(), multiple()] as const,
    ([mode, currentInputValue, currentSelectedValue, isMultiple]) => {
      if (mode === 'none') {
        setFilled(String(currentInputValue) !== '');
        return;
      }
      setFilled(
        isMultiple
          ? Array.isArray(currentSelectedValue) && currentSelectedValue.length > 0
          : currentSelectedValue != null,
      );
    },
  );

  // Ensures that the active index is not set to 0 when the list is empty.
  // This avoids needing to press ArrowDown twice under certain conditions.
  createEffect(
    () => [hasItems(), autoHighlightMode(), flatFilteredValues().length] as const,
    ([withItems, autoHighlighting, length]) => {
      if (withItems && autoHighlighting && length === 0) {
        untrack(() => setIndices({ activeIndex: null }));
      }
    },
  );

  function handleQueryChanged() {
    if (
      open() &&
      query() !== '' &&
      query() !== String(initialDefaultInputValue) &&
      !inputMatchesSelectedValue()
    ) {
      setQueryChangedAfterOpen(true);
    }
  }

  function handleOpenChanged() {
    // A controlled `open` prop can interrupt the close without calling `setOpen`.
    if (open() && closeQuery() !== null) {
      handleInterruptedReopen(false);
    }
  }

  // These sync triggers can run in the same commit while still seeing the pre-commit `inputValue`.
  // This render-scoped flag prevents duplicate callbacks and resets so canceled writes can retry.
  let syncedSelectedLabel = false;

  function syncInputToSelectedLabel() {
    if (!syncedSelectedLabel && inputValue() !== selectedLabelString()) {
      syncedSelectedLabel = true;
      queueMicrotask(() => {
        syncedSelectedLabel = false;
      });
      setInputValue(selectedLabelString(), createChangeEventDetails(REASONS.none));
    }
  }

  function handleSelectedValueChanged() {
    if (selectionMode() === 'none') {
      return;
    }

    clearErrors(name());
    setDirty(
      isSelectedValueDirty(selectedValue(), field.validityData.initialValue, isItemEqualToValue()),
    );

    validation.change(selectedValue());

    if (single() && !hasInputValue() && !inputInsidePopup()) {
      syncInputToSelectedLabel();
    }
  }

  // The label catches accessor changes while the items identity restores the selected label after
  // a one-step input clear followed by a data reload. The shared sync prevents duplicate writes
  // when both change in the same commit.
  function syncInputAfterItemsOrLabelChange() {
    if (single() && !hasInputValue() && !inputInsidePopup() && !queryChangedAfterOpen()) {
      syncInputToSelectedLabel();
    }
  }

  function handleInputValueChanged() {
    if (selectionMode() !== 'none') {
      return;
    }

    clearErrors(name());
    setDirty(inputValue() !== field.validityData.initialValue);

    validation.change(inputValue());
  }

  useValueChanged(query, handleQueryChanged);
  useValueChanged(open, handleOpenChanged);
  useValueChanged(selectedValue, handleSelectedValueChanged);
  useValueChanged(selectedLabelString, syncInputAfterItemsOrLabelChange);
  useValueChanged(items, syncInputAfterItemsOrLabelChange);
  useValueChanged(inputValue, handleInputValueChanged);

  const ariaHasPopup = () => (grid() ? 'grid' : 'listbox');
  // An inline list is permanently expanded (see `ComboboxStore.interactions`).
  const expanded = () => open() || inline();
  const ariaExpanded = () => (expanded() ? 'true' : 'false');

  const role = createMemo<ElementProps>(() => {
    const isPlainInput = (inputElement() as HTMLElement | null)?.tagName === 'INPUT';
    // The input ref may not be available yet. Assume an input-like control so combobox ARIA
    // attributes are present.
    const shouldTreatAsInput = inputElement() == null || isPlainInput;
    // A non-input control only takes on combobox semantics while the list is exposed, which for
    // an inline list is the whole time.
    const shouldApplyAria = shouldTreatAsInput || expanded();

    const reference: Record<string, any> = shouldTreatAsInput
      ? {
          autocomplete: 'off',
          spellcheck: 'false',
          autocorrect: 'off',
          autocapitalize: 'none',
        }
      : {};

    if (shouldApplyAria) {
      reference.role = 'combobox';
      reference['aria-expanded'] = ariaExpanded();
      reference['aria-haspopup'] = ariaHasPopup();
      reference['aria-controls'] = expanded()
        ? (listElement() as HTMLElement | null)?.id
        : undefined;
      // `readOnly` accepts no input, so no completion of any kind is offered.
      reference['aria-autocomplete'] = readOnly() ? 'none' : autoComplete();
    }

    return {
      reference,
      floating: { role: 'presentation' },
    };
  });

  // `readOnly` locks the value, not the interaction: the popup opens and can be browsed.
  const click = useClick(
    store.interactions as any,
    {
      get enabled() {
        return !disabled() && openOnInputClick();
      },
      event: 'mousedown-only',
      toggle: false,
      // Apply a small delay for touch to let mobile viewport/keyboard positioning settle.
      get touchOpenDelay() {
        return inputInsidePopup() ? 0 : 100;
      },
      reason: REASONS.inputPress,
    } as any,
  );

  const dismiss = useDismiss(
    store.interactions as any,
    {
      get enabled() {
        return !disabled() && !inline();
      },
      outsidePressEvent: {
        mouse: 'sloppy',
        // The visual viewport (affected by the mobile software keyboard) can be
        // somewhat small. The user may want to scroll the screen to see more of
        // the popup.
        touch: 'intentional',
      },
      // Without a popup, let the Escape key bubble the event up to other popups' handlers.
      get bubbles() {
        return inline() ? true : undefined;
      },
      outsidePress(event: Event) {
        const target = getTarget(event) as Element | null;
        return (
          !contains(store.state.triggerElement, target) &&
          !contains(clearRef.current, target) &&
          !contains(chipsContainerRef.current, target) &&
          !contains(store.state.inputGroupElement, target)
        );
      },
    } as any,
  );

  const listNavigation = useListNavigation(
    store.interactions as any,
    {
      get enabled() {
        return !disabled();
      },
      get id() {
        return id();
      },
      listRef,
      get activeIndex() {
        return activeIndex();
      },
      get selectedIndex() {
        return selectedIndex();
      },
      virtual: true,
      get loopFocus() {
        return loopFocus();
      },
      get allowEscape() {
        return loopFocus() && !autoHighlightMode();
      },
      get focusItemOnOpen() {
        return queryChangedAfterOpen() || (selectionMode() === 'none' && !autoHighlightMode())
          ? false
          : 'auto';
      },
      get focusItemOnHover() {
        return highlightItemOnHover();
      },
      get resetOnPointerLeave() {
        return !keepHighlight();
      },
      get orientation() {
        return grid() ? 'horizontal' : undefined;
      },
      get rtl() {
        return direction() === 'rtl';
      },
      disabledIndices: EMPTY_ARRAY,
      get grid() {
        return grid() ? gridNavigation : undefined;
      },
      onNavigate(nextActiveIndex: number | null, event?: Event) {
        // Ignore automatic navigation while closed, including selected-index sync for inline lists.
        // Inline lists remain navigable while `open` is false, so still allow resets.
        if (
          (!event && !store.select('open') && !(store.state.inline && nextActiveIndex === null)) ||
          store.select('transitionStatus') === 'ending'
        ) {
          return;
        }

        setIndices({
          activeIndex: nextActiveIndex,
          type: getHighlightReason(event as any),
          event,
        });
      },
    } as any,
  );

  const inputProps = createMemo(() =>
    mergeProps(
      listNavigation.reference as any,
      {
        onKeyDown(event: BaseUIEvent<KeyboardEvent>) {
          // In grid mode the navigation hook treats ArrowLeft/ArrowRight as horizontal
          // grid movement. When the input has focus and no item is highlighted the user
          // is still editing the query, so let the input keep its native caret behavior.
          if (
            store.state.grid &&
            store.state.activeIndex == null &&
            (event.key === 'ArrowLeft' || event.key === 'ArrowRight')
          ) {
            event.preventBaseUIHandler();
          }
        },
      },
      dismiss.reference as any,
      click.reference as any,
      role().reference as any,
    ),
  );

  const popupProps = createMemo(() => mergeProps(FOCUSABLE_POPUP_PROPS, dismiss.floating as any));

  const listProps = createMemo(() =>
    mergeProps(listNavigation.floating as any, role().floating as any),
  );

  const itemRoot = createMemo(() => {
    const listNavigationItemProps = listNavigation.item as HTMLProps | undefined;
    return {
      // Combobox keeps focus on the input; item focus would incorrectly sync
      // list navigation state from DOM focus.
      props: listNavigationItemProps
        ? { ...listNavigationItemProps, onFocus: undefined }
        : EMPTY_OBJECT,
      id: id(),
      selectionMode: selectionMode(),
      disabled: disabled(),
      readOnly: readOnly(),
      isItemEqualToValue: isItemEqualToValue(),
    };
  });

  store.useContextCallback('handleUnmount', () => handleUnmount);
  store.useContextCallback('setInputValue', () => setInputValue);
  store.useContextCallback('setSelectedValue', () => setSelectedValue);
  store.useContextCallback('setIndices', () => setIndices);
  store.useContextCallback('handleSelection', () => handleSelection);
  store.useContextCallback('forceMount', () => forceMount);
  store.useContextCallback('requestSubmit', () => requestSubmit);

  // The prop bags must be in the store before the parts render.
  untrack(() =>
    store.update({
      inline: inlineProp(),
      popupProps: popupProps(),
      listProps: listProps(),
      inputProps: inputProps(),
      activeTriggerProps: triggerProps,
      itemRoot: itemRoot(),
    } as any),
  );

  createEffect(
    () => ({
      id: id(),
      selectedValue: selectedValue(),
      items: storeItems(),
      inline: inlineProp(),
      popupProps: popupProps(),
      listProps: listProps(),
      inputProps: inputProps(),
      activeTriggerProps: triggerProps,
      itemRoot: itemRoot(),
      openMethod: openMethod(),
      selectionMode: selectionMode(),
      name: name(),
      form: form(),
      disabled: disabled(),
      readOnly: readOnly(),
      required: required(),
      grid: grid(),
      virtualized: virtualized(),
      openOnInputClick: openOnInputClick(),
      itemToStringLabel: itemToStringLabel(),
      modal: modal(),
      autoHighlight: autoHighlightMode(),
      isItemEqualToValue: isItemEqualToValue(),
      submitOnItemClick: submitOnItemClick(),
      hasInputValue: hasInputValue(),
      inputInsidePopup: inputInsidePopup(),
    }),
    (syncedValues) => {
      // `inputOwnsFormValue` lands in the same update so subscribers never observe an
      // intermediate snapshot.
      const { inputInsidePopup: insidePopup, ...rest } = syncedValues;
      store.update({
        ...rest,
        inputOwnsFormValue: rest.selectionMode === 'none' && (rest.inline || !insidePopup),
      } as any);
    },
  );

  const itemsContextValue: ComboboxDerivedItemsContext = {
    get hasItems() {
      return hasItems();
    },
    get filteredItems() {
      return filteredItems() as any[];
    },
    get flatFilteredValues() {
      return flatFilteredValues();
    },
  };

  const serializedValue = createMemo(() => {
    const raw = fieldRawValue();
    if (Array.isArray(raw)) {
      return '';
    }
    return stringifyAsValue(raw, itemToStringValue());
  });

  const hasMultipleSelection = () =>
    multiple() && Array.isArray(selectedValue()) && selectedValue().length > 0;
  const hiddenInputName = () =>
    multiple() || (selectionMode() === 'none' && inputOwnsFormValue()) ? undefined : name();

  const hiddenInputValues = createMemo(() => {
    const value = selectedValue();
    if (!multiple() || !Array.isArray(value) || !name()) {
      return [] as string[];
    }

    return value.map((item: Value) => stringifyAsValue(item, itemToStringValue()));
  });

  const validationProps = createMemo(() =>
    validation.getValidationProps(disabled(), {
      // Move focus when the hidden input is focused.
      onFocus() {
        if (store.state.inputInsidePopup) {
          store.state.triggerElement?.focus();
          return;
        }

        (inputRef.current || store.state.triggerElement)?.focus();
      },
      // Handle browser autofill.
      onChange(event: Event) {
        untrack(() => {
          if (event.defaultPrevented || disabled() || readOnly()) {
            return;
          }

          const nextValue = (event.currentTarget as HTMLInputElement).value;
          const nextValueLower = nextValue.toLowerCase();
          const details = createChangeEventDetails(REASONS.none, event);

          const findSerializedMatchIndex = () =>
            valuesRef.current.findIndex(
              (candidate) =>
                stringifyAsValue(candidate, itemToStringValue()).toLowerCase() === nextValueLower ||
                stringifyValueLabel(candidate).toLowerCase() === nextValueLower,
            );

          function handleChange() {
            // Browser autofill only writes a single scalar value.
            if (multiple()) {
              return;
            }

            if (selectionMode() === 'none') {
              setInputValue(nextValue, details);
              return;
            }

            // Preserve the original serialized matching, then fall back to rendered text,
            // which browsers can autofill for primitive values like `value="US">United States`.
            let matchingIndex = findSerializedMatchIndex();

            if (matchingIndex === -1) {
              matchingIndex = valuesRef.current.findIndex((_, index) => {
                const renderedLabel = labelsRef.current[index];
                return renderedLabel != null && renderedLabel.toLowerCase() === nextValueLower;
              });
            }

            const matchingValue =
              matchingIndex === -1 ? undefined : valuesRef.current[matchingIndex];
            if (matchingValue != null) {
              // `setSelectedValue` may be canceled by `onValueChange`; rely on
              // `useValueChanged` to mark the field dirty and run validation only
              // when the value actually changes.
              setSelectedValue?.(matchingValue, details);
            }
          }

          // Only single-selection autofill matches against the registered values/labels.
          // `multiple` ignores autofill and `none` just writes the input value, so avoid the
          // sticky `forceMounted` mount (which never resets) for those modes.
          if (single()) {
            forceMount();
            if (items() && findSerializedMatchIndex() === -1) {
              // `forceMount` only refreshes the derived labels for the `items` prop. When
              // serialized matching misses, also mount the list so rendered labels (which can
              // differ from the serialized values) are registered for autofill matching.
              store.set('forceMounted', true);
            }
          }
          queueMicrotask(handleChange);
        });
      },
    }),
  );

  return (
    <ComboboxRootContext value={store as any}>
      <ComboboxHasItemsContext value={untrack(hasItems)}>
        <ComboboxDerivedItemsContext value={itemsContextValue}>
          <ComboboxInputValueContext value={inputValue}>
            {props.children}
            <input
              {...validationProps()}
              id={id() && hiddenInputName() == null ? `${id()}-hidden-input` : undefined}
              form={form()}
              name={hiddenInputName()}
              type={getHiddenInputType(
                field.setValidityData !== NOOP,
                name(),
                formAutoComplete(),
                required(),
                inputRefProp(),
              )}
              autocomplete={formAutoComplete()}
              disabled={disabled()}
              required={required() && !hasMultipleSelection()}
              readonly={readOnly()}
              value={serializedValue()}
              ref={(el: HTMLInputElement) => {
                hiddenInputElementRef.current = el;
                assignRefs(untrack(inputRefProp) as RefInput<HTMLInputElement>, el);
                assignRefs(validation.inputRef as RefInput<HTMLInputElement>, el);
              }}
              style={hiddenInputName() ? visuallyHiddenInput : visuallyHiddenInputPinned}
              onInvalid={handleHiddenInputInvalid as any}
              tabindex={-1}
              aria-hidden="true"
            />
            <For each={hiddenInputValues()}>
              {(serialized) => (
                <input
                  type="hidden"
                  form={form()}
                  name={name()}
                  value={serialized}
                  disabled={disabled()}
                />
              )}
            </For>
          </ComboboxInputValueContext>
        </ComboboxDerivedItemsContext>
      </ComboboxHasItemsContext>
    </ComboboxRootContext>
  );
}

type SelectionMode = 'single' | 'multiple' | 'none';

type ComboboxItemValueType<ItemValue, Mode extends SelectionMode> = Mode extends 'multiple'
  ? ItemValue[]
  : ItemValue;

interface ComboboxRootProps<ItemValue, Item = ItemValue> {
  children?: JSX.Element;
  /**
   * Identifies the field when a form is submitted.
   */
  name?: string | undefined;
  /**
   * Identifies the form that owns the internal input.
   * Useful when the combobox is rendered outside the form.
   */
  form?: string | undefined;
  /**
   * The id of the component.
   */
  id?: string | undefined;
  /**
   * Whether the user must choose a value before submitting a form.
   * @default false
   */
  required?: boolean | undefined;
  /**
   * Whether the user should be unable to choose a different option from the popup.
   * @default false
   */
  readOnly?: boolean | undefined;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Whether the popup is initially open.
   *
   * To render a controlled popup, use the `open` prop instead.
   * @default false
   */
  defaultOpen?: boolean | undefined;
  /**
   * Whether the popup is currently open. Use when controlled.
   */
  open?: boolean | undefined;
  /**
   * Event handler called when the popup is opened or closed.
   */
  onOpenChange?:
    ((open: boolean, eventDetails: AriaCombobox.OpenChangeEventDetails) => void) | undefined;
  /**
   * Event handler called after any animations complete when the popup is opened or closed.
   */
  onOpenChangeComplete?: ((open: boolean) => void) | undefined;
  /**
   * Whether the popup opens when clicking the input.
   * @default true
   */
  openOnInputClick?: boolean | undefined;
  /**
   * Whether the first matching item is highlighted automatically.
   * - `false`: do not highlight automatically.
   * - `true`: highlight after the user types and keep the highlight while the query changes.
   * - `'always'`: highlight the first item as soon as the list opens.
   * @default false
   */
  autoHighlight?: boolean | 'always' | undefined;
  /**
   * Whether the highlighted item should be preserved when the pointer leaves the list.
   * @default false
   */
  keepHighlight?: boolean | undefined;
  /**
   * Whether moving the pointer over items should highlight them.
   * Disabling this prop allows CSS `:hover` to be differentiated from the `:focus` (`data-highlighted`) state.
   * @default true
   */
  highlightItemOnHover?: boolean | undefined;
  /**
   * Whether to loop keyboard focus back to the input when the end of the list is reached while using the arrow keys. The first item can then be reached by pressing <kbd>ArrowDown</kbd> again from the input, or the last item can be reached by pressing <kbd>ArrowUp</kbd> from the input.
   * The input is always included in the focus loop per [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/).
   * When disabled, focus does not move when on the last element and the user presses <kbd>ArrowDown</kbd>, or when on the first element and the user presses <kbd>ArrowUp</kbd>.
   * @default true
   */
  loopFocus?: boolean | undefined;
  /**
   * The input value of the combobox. Use when controlled.
   */
  inputValue?: string | number | readonly string[] | undefined;
  /**
   * Callback fired when the input value of the combobox changes.
   */
  onInputValueChange?:
    ((value: string, eventDetails: AriaCombobox.ChangeEventDetails) => void) | undefined;
  /**
   * The uncontrolled input value when initially rendered.
   *
   * To render a controlled input, use the `inputValue` prop instead.
   */
  defaultInputValue?: string | number | readonly string[] | undefined;
  /**
   * A ref to imperative actions.
   * - `unmount`: Ends the closing phase of the combobox after an externally controlled closing animation finishes.
   * Call `preventUnmountOnClose()` in `onOpenChange` first, otherwise the combobox completes closing on its own.
   * Whether it leaves the DOM is decided by `keepMounted` on the portal.
   * - `close`: Closes the combobox imperatively when called.
   */
  actionsRef?: RefObject<AriaCombobox.Actions | null> | undefined;
  /**
   * Callback fired when an item is highlighted or unhighlighted.
   * Receives the highlighted item value (or `undefined` if no item is highlighted) and event details with a `reason` property describing why the highlight changed.
   * The `reason` can be:
   * - `'keyboard'`: the highlight changed due to keyboard navigation.
   * - `'pointer'`: the highlight changed due to pointer hovering. The event may be a `MouseEvent`
   *   rather than a `PointerEvent`.
   * - `'none'`: the highlight changed for another reason, such as typing, `autoHighlight`, the
   *   item list changing, or the popup opening or closing.
   */
  onItemHighlighted?:
    | ((itemValue: ItemValue | undefined, eventDetails: AriaCombobox.HighlightEventDetails) => void)
    | undefined;
  /**
   * A ref to the hidden input element.
   */
  inputRef?: RefInput<HTMLInputElement> | undefined;
  /**
   * Whether list items are presented in a grid layout.
   * When enabled, arrow keys navigate across rows and columns inferred from DOM rows.
   * @default false
   */
  grid?: boolean | undefined;
  /**
   * The items to be displayed in the list.
   * Can be a flat array of items, an array of groups with items, or a collection created by
   * the `createItems()` function, which derives each item's selection value and label.
   * Nullish entries are not supported: remove them from the data before passing it.
   */
  items?:
    readonly any[] | readonly Group<any>[] | ComboboxItemCollection<Item, ItemValue> | undefined;
  /**
   * Filtered items to display in the list.
   * When provided, the list uses these items instead of filtering the `items` prop internally.
   * When `items` is also provided, this array must preserve its flat or grouped structure.
   * With a `createItems()` collection, pass source items rather than derived values.
   * Nullish entries are not supported, as in `items`.
   * Use when you want to control filtering logic externally with the `useFilter()` hook.
   */
  filteredItems?: readonly Item[] | readonly Group<Item>[] | undefined;
  /**
   * Filter function used to match items vs input query.
   * Receives the source item, which is the derived value's item when `items` is a `createItems()`
   * collection, and the item itself otherwise.
   */
  filter?:
    | null
    | ((item: Item, query: string, itemToString?: (item: Item) => string) => boolean)
    | undefined;
  /**
   * When the item values are objects (`<Combobox.Item value={object}>`), this function converts the object value to a string representation for display in the input.
   * If the shape of the object is `{ value, label }`, the label will be used automatically without needing to specify this prop.
   * With a `createItems()` collection, this receives the derived value, and the collection's
   * `getLabel` takes precedence for values it can resolve.
   */
  itemToStringLabel?: ((itemValue: ItemValue) => string) | undefined;
  /**
   * When the item values are objects (`<Combobox.Item value={object}>`), this function converts the object value to a string representation for form submission.
   * If the shape of the object is `{ value, label }`, the value will be used automatically without needing to specify this prop.
   * With a `createItems()` collection, this receives the derived value.
   */
  itemToStringValue?: ((itemValue: ItemValue) => string) | undefined;
  /**
   * Custom comparison logic used to determine if a combobox item value matches the current selected value. Useful when item values are objects without matching referentially.
   * With a `createItems()` collection, both arguments are derived values.
   * Defaults to `Object.is` comparison.
   */
  isItemEqualToValue?: ((itemValue: ItemValue, value: ItemValue) => boolean) | undefined;
  /**
   * Whether the items are being externally virtualized.
   * @default false
   */
  virtualized?: boolean | undefined;
  /**
   * Whether the list is rendered inline without using the component's own popup.
   *
   * Specify `open` unconditionally in conjunction with this prop so the list is considered
   * visible: `<Combobox.Root inline open>`
   *
   * In a `Combobox.Root` > `Dialog.Root` composition, bind the Combobox's `open` and
   * `onOpenChange` props to the `Dialog`'s `open` and `onOpenChange` state instead so the
   * component resets its transient state (filter query, highlighted item, and input value) when
   * the dialog closes.
   * @default false
   */
  inline?: boolean | undefined;
  /**
   * Determines if the popup enters a modal state when open.
   * - `true`: user interaction is limited to the popup: document page scroll is locked and pointer interactions on outside elements are disabled.
   * - `false`: user interaction with the rest of the document is allowed.
   *
   * On touch devices, a `true` modal blocks outside taps but leaves the page scrollable unless the popup spans nearly the full viewport width, matching native iOS behavior.
   * @default false
   */
  modal?: boolean | undefined;
  /**
   * The maximum number of items to display in the list.
   * @default -1
   */
  limit?: number | undefined;
  /**
   * Controls how the component behaves with respect to list filtering and inline autocompletion.
   * - `list` (default): items are dynamically filtered based on the input value. The input value does not change based on the active item.
   * - `both`: items are dynamically filtered based on the input value, which will temporarily change based on the active item (inline autocompletion).
   * - `inline`: items are static (not filtered), and the input value will temporarily change based on the active item (inline autocompletion).
   * - `none`: items are static (not filtered), and the input value will not change based on the active item.
   * @default 'list'
   */
  autoComplete?: 'list' | 'both' | 'inline' | 'none' | undefined;
  /**
   * Provides a hint to the browser for autofill on the hidden input element.
   * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/autocomplete
   */
  formAutoComplete?: string | undefined;
  /**
   * The locale to use for string comparison.
   * Defaults to the user's runtime locale.
   */
  locale?: Intl.LocalesArgument | undefined;
  /**
   * Whether clicking an item should submit the owning form.
   * @default false
   */
  submitOnItemClick?: boolean | undefined;
  /**
   * INTERNAL: When `selectionMode` is `none`, controls whether selecting an item fills the input.
   */
  fillInputOnItemPress?: boolean | undefined;
}

export interface AriaComboboxState {}

export type AriaComboboxProps<
  Value,
  Mode extends SelectionMode = 'none',
  Item = Value,
> = ComboboxRootProps<Value, Item> & {
  /**
   * How the combobox should remember the selected value.
   * - `single`: Remembers the last selected value.
   * - `multiple`: Remember all selected values.
   * - `none`: Do not remember the selected value.
   */
  selectionMode: Mode;
  /**
   * The selected value of the combobox. Use when controlled.
   */
  selectedValue?: ComboboxItemValueType<Value, Mode> | undefined;
  /**
   * The uncontrolled selected value of the combobox when it's initially rendered.
   *
   * To render a controlled combobox, use the `selectedValue` prop instead.
   */
  defaultSelectedValue?: ComboboxItemValueType<Value, Mode> | null | undefined;
  /**
   * Callback fired when the selected value of the combobox changes.
   */
  onSelectedValueChange?:
    | ((
        value: ComboboxItemValueType<Value, Mode>,
        eventDetails: AriaCombobox.ChangeEventDetails,
      ) => void)
    | undefined;
};

export namespace AriaCombobox {
  export type Props<Value, Mode extends SelectionMode = 'none', Item = Value> = AriaComboboxProps<
    Value,
    Mode,
    Item
  >;
  export type State = AriaComboboxState;

  export interface Actions {
    unmount: () => void;
    close: () => void;
  }

  export type HighlightEventReason =
    typeof REASONS.keyboard | typeof REASONS.pointer | typeof REASONS.none;
  export type HighlightEventDetails = BaseUIHighlightEventDetails<
    HighlightEventReason,
    { index: number }
  >;

  export type ChangeEventReason =
    | typeof REASONS.triggerPress
    | typeof REASONS.inputPress
    | typeof REASONS.outsidePress
    | typeof REASONS.itemPress
    | typeof REASONS.closePress
    | typeof REASONS.escapeKey
    | typeof REASONS.listNavigation
    | typeof REASONS.focusOut
    | typeof REASONS.inputChange
    | typeof REASONS.inputClear
    | typeof REASONS.clearPress
    | typeof REASONS.chipRemovePress
    | typeof REASONS.cancelOpen
    | typeof REASONS.imperativeAction
    | typeof REASONS.none;
  export type OpenChangeEventDetails = ChangeEventDetails & {
    /** Prevents the popup from unmounting until the `unmount` action is called. */
    preventUnmountOnClose: () => void;
  };
  export type ChangeEventDetails = BaseUIChangeEventDetails<ChangeEventReason> & {
    /**
     * When `reason` is `input-clear` in multiple mode, indicates whether an item press caused the
     * clear. Automatic cleanup clears omit this property.
     */
    isItemPress?: boolean | undefined;
  };
}
