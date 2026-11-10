import type { JSX } from '@solidjs/web';
import { useComboboxInputValueContext } from '../../combobox/root/ComboboxRootContext';

/**
 * The current value of the autocomplete.
 * Doesn't render its own HTML element.
 *
 * Documentation: [Base UI Autocomplete](https://base-ui.com/react/components/autocomplete)
 */
export function AutocompleteValue(props: AutocompleteValue.Props): JSX.Element {
  const inputValue = useComboboxInputValueContext();

  const returnValue = () => {
    const children = props.children as any;
    if (typeof children === 'function') {
      return children(String(inputValue()));
    }
    if (children != null) {
      return children;
    }
    return inputValue() as any;
  };

  return <>{returnValue()}</>;
}

export interface AutocompleteValueState {}

export interface AutocompleteValueProps {
  children?: JSX.Element | ((value: string) => JSX.Element);
}

export namespace AutocompleteValue {
  export type State = AutocompleteValueState;
  export type Props = AutocompleteValueProps;
}
