import { omit } from 'solid-js';
import type { BaseUIComponentProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import {
  useComboboxDerivedItemsContext,
  useComboboxRootContext,
} from '../root/ComboboxRootContext';
import { useInitialLiveRegionTextMutation } from '../../internals/useInitialLiveRegionTextMutation';
import { ownedProps } from '../../internals/ownedProps';

/**
 * Renders its children only when the list is empty.
 * Requires the `items` prop on the root component.
 * Announces changes politely to screen readers.
 * This component's root element must remain mounted in the DOM to announce
 * changes consistently across screen readers. Avoid hiding or removing the
 * component itself with `display: none`, `hidden`, `aria-hidden`, or conditional
 * rendering. Prefer updating or conditionally rendering its children instead.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export function ComboboxEmpty(componentProps: ComboboxEmpty.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'children', 'ref');

  const derivedItems = useComboboxDerivedItemsContext();
  const store = useComboboxRootContext();

  const isEmpty = () => derivedItems.filteredItems.length === 0;
  const emptyRef = useInitialLiveRegionTextMutation<HTMLDivElement>(isEmpty);

  return useRenderElement('div', componentProps, {
    ref: [
      (el: HTMLDivElement | null) => {
        store.context.emptyRef.current = el;
      },
      emptyRef,
    ],
    props: [
      {
        role: 'status',
        'aria-live': 'polite',
        'aria-atomic': true,
      },
      elementProps,
    ],
    children: () => (isEmpty() ? componentProps.children : null),
  });
}

export interface ComboboxEmptyState {}

export interface ComboboxEmptyProps extends BaseUIComponentProps<'div', ComboboxEmptyState> {}

export namespace ComboboxEmpty {
  export type State = ComboboxEmptyState;
  export type Props = ComboboxEmptyProps;
}
