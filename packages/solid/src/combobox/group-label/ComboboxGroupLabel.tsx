import { createEffect, omit } from 'solid-js';
import { useComboboxGroupContext } from '../group/ComboboxGroupContext';
import type { BaseUIComponentProps } from '../../internals/types';
import { useBaseUiId } from '../../internals/useBaseUiId';
import { useRenderElement } from '../../internals/useRenderElement';
import { ownedProps } from '../../internals/ownedProps';

/**
 * An accessible label that is automatically associated with its parent group.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export function ComboboxGroupLabel(componentProps: ComboboxGroupLabel.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'id', 'ref');

  const { setLabelId } = useComboboxGroupContext();
  const id = useBaseUiId(() => componentProps.id as string | undefined);

  createEffect(id, (currentId) => {
    setLabelId(currentId);
    return () => {
      setLabelId((labelId) => (labelId === currentId ? undefined : labelId));
    };
  });

  return useRenderElement('div', componentProps, {
    props: [
      {
        get id() {
          return id();
        },
        'aria-hidden': true,
      },
      elementProps,
    ],
  });
}

export interface ComboboxGroupLabelState {}

export interface ComboboxGroupLabelProps extends BaseUIComponentProps<
  'div',
  ComboboxGroupLabelState
> {}

export namespace ComboboxGroupLabel {
  export type State = ComboboxGroupLabelState;
  export type Props = ComboboxGroupLabelProps;
}
