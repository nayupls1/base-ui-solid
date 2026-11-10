import { createSignal, omit, Show, untrack } from 'solid-js';
import type { BaseUIComponentProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { ComboboxGroupContext } from './ComboboxGroupContext';
import { GroupCollectionProvider } from '../collection/GroupCollectionContext';
import { useComboboxRootContext } from '../root/ComboboxRootContext';
import { ownedProps } from '../../internals/ownedProps';

/**
 * Groups related items with the corresponding label.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export function ComboboxGroup(componentProps: ComboboxGroup.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'items', 'ref');

  const store = useComboboxRootContext();
  const grid = store.useState('grid');

  const [labelId, setLabelId] = createSignal<string | undefined>(undefined, { ownedWrite: true });

  const contextValue: ComboboxGroupContext = {
    get labelId() {
      return labelId();
    },
    setLabelId: setLabelId as ComboboxGroupContext['setLabelId'],
    get items() {
      return componentProps.items;
    },
  };

  const element = () =>
    untrack(() =>
      useRenderElement('div', componentProps, {
        props: [
          {
            // `group` is not a valid owned element of `grid`, and `row` must be owned
            // by `grid`, `rowgroup`, or `treegrid`.
            get role() {
              return grid() ? 'rowgroup' : 'group';
            },
            get 'aria-labelledby'() {
              return labelId();
            },
          },
          elementProps,
        ],
      }),
    );

  const wrappedElement = () => (
    <ComboboxGroupContext value={contextValue}>{element()}</ComboboxGroupContext>
  );

  return (
    <Show when={componentProps.items} fallback={wrappedElement()}>
      {(items) => (
        <GroupCollectionProvider items={items()}>{wrappedElement()}</GroupCollectionProvider>
      )}
    </Show>
  );
}

export interface ComboboxGroupState {}

export interface ComboboxGroupProps extends BaseUIComponentProps<'div', ComboboxGroupState> {
  /**
   * Items to be rendered within this group.
   * When provided, child `Collection` components will use these items.
   */
  items?: readonly any[] | undefined;
}

export namespace ComboboxGroup {
  export type State = ComboboxGroupState;
  export type Props = ComboboxGroupProps;
}
