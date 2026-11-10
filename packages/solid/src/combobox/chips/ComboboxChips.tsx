import { omit, untrack } from 'solid-js';
import { EMPTY_OBJECT } from '@base-ui-solid/utils/empty';
import type { BaseUIComponentProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useComboboxRootContext } from '../root/ComboboxRootContext';
import { ComboboxChipsContext } from './ComboboxChipsContext';
import { CompositeList } from '../../internals/composite/list/CompositeList';
import { handleInputPress } from '../utils/handleInputPress';
import { mergeProps } from '../../merge-props';
import { ownedProps } from '../../internals/ownedProps';

/**
 * A container for the chips in a multiselectable input.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export function ComboboxChips(componentProps: ComboboxChips.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'children', 'ref');

  const store = useComboboxRootContext();

  const hasSelectionChips = store.useState('hasSelectionChips');

  const chipsRef = { current: [] as Array<HTMLButtonElement | null> };

  const contextValue = { chipsRef };

  return (
    <ComboboxChipsContext value={contextValue as any}>
      <CompositeList elementsRef={chipsRef as any}>
        {untrack(() =>
          useRenderElement('div', componentProps, {
            ref: (el: HTMLDivElement | null) => {
              store.context.chipsContainerRef.current = el;
            },
            // NVDA enters browse mode instead of staying in focus mode when navigating with
            // arrow keys inside a container unless it has a toolbar role.
            props: [
              (merged: Record<string, any>) =>
                mergeProps(merged, hasSelectionChips() ? { role: 'toolbar' } : EMPTY_OBJECT),
              {
                onMouseDown(event: MouseEvent) {
                  handleInputPress(event, store, store.state.disabled);
                },
              },
              elementProps,
            ],
          }),
        )}
      </CompositeList>
    </ComboboxChipsContext>
  );
}

export interface ComboboxChipsState {}

export interface ComboboxChipsProps extends BaseUIComponentProps<'div', ComboboxChipsState> {}

export namespace ComboboxChips {
  export type State = ComboboxChipsState;
  export type Props = ComboboxChipsProps;
}
