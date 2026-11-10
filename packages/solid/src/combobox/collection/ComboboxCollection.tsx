import type { JSX } from '@solidjs/web';
import { For, untrack } from 'solid-js';
import { useComboboxDerivedItemsContext } from '../root/ComboboxRootContext';
import { useGroupCollectionContext } from './GroupCollectionContext';

/**
 * Renders filtered list items.
 * Doesn't render its own HTML element.
 *
 * If rendering a flat list, pass a function child to the `List` component instead, which implicitly wraps it.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export function ComboboxCollection(props: ComboboxCollection.Props): JSX.Element {
  const derivedItems = useComboboxDerivedItemsContext();
  const groupContext = useGroupCollectionContext();

  const itemsToRender = () => (groupContext ? groupContext.items : derivedItems.filteredItems);

  return (
    <For each={itemsToRender() as any[]}>{(item, index) => props.children(item, index())}</For>
  );
}

export interface ComboboxCollectionState {}

export interface ComboboxCollectionProps {
  children: (item: any, index: number) => JSX.Element;
}

export namespace ComboboxCollection {
  export type State = ComboboxCollectionState;
  export type Props = ComboboxCollectionProps;
}
