import type { JSX } from '@solidjs/web';
import { ListboxSeparator } from '../../utils/listbox-separator/ListboxSeparator';
import type {
  ListboxSeparatorProps,
  ListboxSeparatorState,
} from '../../utils/listbox-separator/ListboxSeparator';

export interface ComboboxSeparatorState extends ListboxSeparatorState {}

export interface ComboboxSeparatorProps extends ListboxSeparatorProps {}

/**
 * A visual separator between items or groups.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export const ComboboxSeparator = ListboxSeparator as (props: ComboboxSeparatorProps) => JSX.Element;

export namespace ComboboxSeparator {
  export type Props = ComboboxSeparatorProps;
  export type State = ComboboxSeparatorState;
}
