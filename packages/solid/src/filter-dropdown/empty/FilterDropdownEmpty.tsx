import { createSignal, omit, onSettled, Show, untrack } from 'solid-js';
import { useStore } from 'base-ui-solidjs-utils/store';
import type { BaseUIComponentProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useFilterDropdownItemContext } from '../root/FilterDropdownRootContext';
import { selectors } from '../store';
import { useInitialLiveRegionTextMutation } from '../../internals/useInitialLiveRegionTextMutation';
import { ownedProps } from '../../internals/ownedProps';

/**
 * Shows its children when no item matches the query.
 * Renders a `<div>` element.
 *
 * @internal
 */
export function FilterDropdownEmpty(componentProps: FilterDropdownEmpty.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'children', 'ref');

  const { store } = useFilterDropdownItemContext();

  const isEmpty = useStore(store, selectors.isEmpty);

  // Items mounting alongside register in effects, after this first render. Deciding once they
  // have keeps the children from mounting for a frame on every open.
  const [ready, setReady] = createSignal(false, { ownedWrite: true });
  onSettled(() => {
    setReady(true);
  });

  const visible = () => ready() && isEmpty();

  const emptyRef = useInitialLiveRegionTextMutation<HTMLDivElement>(visible);

  return (
    <Show when={visible()}>
      {untrack(() =>
        useRenderElement('div', componentProps, {
          ref: emptyRef,
          props: [
            {
              role: 'status',
              'aria-live': 'polite',
              'aria-atomic': true,
            },
            elementProps,
          ],
        }),
      )}
    </Show>
  );
}

export interface FilterDropdownEmptyState {}

export interface FilterDropdownEmptyProps extends BaseUIComponentProps<
  'div',
  FilterDropdownEmptyState
> {}

export namespace FilterDropdownEmpty {
  export type Props = FilterDropdownEmptyProps;
  export type State = FilterDropdownEmptyState;
}
