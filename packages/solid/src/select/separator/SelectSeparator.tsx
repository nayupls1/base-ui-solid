import type { JSX } from '@solidjs/web';
import { ListboxSeparator } from '../../utils/listbox-separator/ListboxSeparator';
import type {
  ListboxSeparatorProps,
  ListboxSeparatorState,
} from '../../utils/listbox-separator/ListboxSeparator';

export interface SelectSeparatorState extends ListboxSeparatorState {}

export interface SelectSeparatorProps extends ListboxSeparatorProps {}

/**
 * A separator element accessible to screen readers.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Select](https://base-ui.com/react/components/select)
 */
export const SelectSeparator = ListboxSeparator as (props: SelectSeparatorProps) => JSX.Element;

export namespace SelectSeparator {
  export type Props = SelectSeparatorProps;
  export type State = SelectSeparatorState;
}
