import type { JSX } from '@solidjs/web';
import { createMemo, untrack } from 'solid-js';
import { useComboboxRootContext } from '../root/ComboboxRootContext';
import { resolveMultipleLabels, resolveSelectedLabel } from '../../internals/resolveValueLabel';

/**
 * The current value of the combobox.
 * Doesn't render its own HTML element.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export function ComboboxValue(props: ComboboxValue.Props): JSX.Element {
  const store = useComboboxRootContext();

  const itemToStringLabel = store.useState('itemToStringLabel');
  const selectedValue = store.useState('selectedValue');
  const items = store.useState('items');
  const selectionMode = store.useState('selectionMode');
  const hasSelectedValue = store.useState('hasSelectedValue');

  const shouldCheckNullItemLabel = () =>
    !hasSelectedValue() && props.placeholder != null && props.children == null;
  const hasNullLabel = store.useState('hasNullItemLabel', shouldCheckNullItemLabel);

  // A function child usually renders the chips and the input of a multiple combobox. Re-running
  // it on every selection change would recreate the input (dropping focus), so in multiple mode it
  // runs once with a live view of the selected array; reads inside its JSX stay reactive.
  if (
    typeof untrack(() => props.children) === 'function' &&
    untrack(selectionMode) === 'multiple'
  ) {
    const liveSelection = createLiveArray(() => {
      const value = selectedValue();
      return Array.isArray(value) ? value : [];
    });
    return untrack(() => (props.children as any)(liveSelection));
  }

  const children = createMemo(() => {
    const childrenProp = props.children as any;
    const value = selectedValue();
    if (typeof childrenProp === 'function') {
      return childrenProp(value);
    }
    if (childrenProp != null) {
      return childrenProp;
    }
    if (!hasSelectedValue() && props.placeholder != null && !hasNullLabel()) {
      return props.placeholder;
    }
    if (selectionMode() === 'multiple' && Array.isArray(value)) {
      return resolveMultipleLabels(value, items(), itemToStringLabel() as any);
    }
    return resolveSelectedLabel(value, items(), itemToStringLabel() as any);
  });

  return <>{children()}</>;
}

export interface ComboboxValueState {}

export interface ComboboxValueProps {
  /**
   * Accepts a function that returns a `JSX.Element` to format the selected value.
   * Treat the value as read-only: in `multiple` mode it may be a shared frozen array
   * when nothing is selected.
   */
  children?: JSX.Element | ((selectedValue: any) => JSX.Element);
  /**
   * The placeholder value to display when no value is selected.
   * This is overridden by `children` if specified, or by a null item's label in `items`.
   */
  placeholder?: JSX.Element;
}

export namespace ComboboxValue {
  export type State = ComboboxValueState;
  export type Props = ComboboxValueProps;
}

/**
 * An array-like view that always reads the current array, so reads in a tracking scope track it.
 */
function createLiveArray<T>(getArray: () => readonly T[]): readonly T[] {
  return new Proxy([] as T[], {
    get(_target, key) {
      const array = getArray();
      const value = Reflect.get(array, key, array);
      return typeof value === 'function' ? value.bind(array) : value;
    },
    has(_target, key) {
      return Reflect.has(getArray(), key);
    },
    ownKeys() {
      return Reflect.ownKeys(getArray());
    },
    getOwnPropertyDescriptor(_target, key) {
      const descriptor = Reflect.getOwnPropertyDescriptor(getArray(), key);
      return descriptor ? { ...descriptor, configurable: true } : undefined;
    },
  });
}
