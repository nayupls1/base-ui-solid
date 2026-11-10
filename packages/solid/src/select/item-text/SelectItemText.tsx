import { createEffect, omit } from 'solid-js';
import { createSyncSignal } from 'base-ui-solidjs-utils/createSyncSignal';
import { useSelectItemContext } from '../item/SelectItemContext';
import { useSelectRootContext } from '../root/SelectRootContext';
import type { BaseUIComponentProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { ownedProps } from '../../internals/ownedProps';

/**
 * A text label of the select item.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Select](https://base-ui.com/react/components/select)
 */
export function SelectItemText(componentProps: SelectItemText.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'children', 'ref');

  const item = useSelectItemContext();
  const store = useSelectRootContext();

  const [node, setNode] = createSyncSignal<HTMLElement | null>(null);

  // Upstream re-runs its ref callback when the index or focus selection changes.
  createEffect(
    () => [node(), item.index, item.selectedByFocus] as const,
    ([element, index, selectedByFocus]) => {
      if (!element) {
        return;
      }
      if (index === 0) {
        store.context.firstItemTextRef.current = element;
      }
      if (selectedByFocus) {
        store.context.selectedItemTextRef.current = element;
      }
    },
  );

  const localRef = (element: HTMLElement | null) => {
    setNode(element);
  };

  return useRenderElement('div', componentProps, {
    ref: [
      localRef,
      (node: HTMLElement | null) => {
        item.textRef.current = node;
      },
    ],
    props: elementProps,
  });
}

export interface SelectItemTextState {}

export interface SelectItemTextProps extends BaseUIComponentProps<'div', SelectItemTextState> {}

export namespace SelectItemText {
  export type State = SelectItemTextState;
  export type Props = SelectItemTextProps;
}
