import { createEffect, omit } from 'solid-js';
import { useSelectGroupContext } from '../group/SelectGroupContext';
import type { BaseUIComponentProps } from '../../internals/types';
import { useBaseUiId } from '../../internals/useBaseUiId';
import { useRenderElement } from '../../internals/useRenderElement';
import { ownedProps } from '../../internals/ownedProps';

/**
 * An accessible label that is automatically associated with its parent group.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Select](https://base-ui.com/react/components/select)
 */
export function SelectGroupLabel(componentProps: SelectGroupLabel.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'id', 'ref');

  const { setLabelId } = useSelectGroupContext();
  const id = useBaseUiId(() => componentProps.id);

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

export interface SelectGroupLabelState {}

export interface SelectGroupLabelProps extends BaseUIComponentProps<'div', SelectGroupLabelState> {}

export namespace SelectGroupLabel {
  export type State = SelectGroupLabelState;
  export type Props = SelectGroupLabelProps;
}
