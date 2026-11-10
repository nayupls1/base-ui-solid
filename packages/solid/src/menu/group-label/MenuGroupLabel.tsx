import { createEffect, omit } from 'solid-js';
import type { BaseUIComponentProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useBaseUiId } from '../../internals/useBaseUiId';
import { useMenuGroupRootContext } from '../group/MenuGroupContext';
import { ownedProps } from '../../internals/ownedProps';

/**
 * An accessible label that is automatically associated with its parent group.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export function MenuGroupLabel(componentProps: MenuGroupLabel.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'id', 'ref');

  const id = useBaseUiId(() => componentProps.id);
  const setLabelId = useMenuGroupRootContext();

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

export interface MenuGroupLabelProps extends BaseUIComponentProps<'div', MenuGroupLabelState> {}

export interface MenuGroupLabelState {}

export namespace MenuGroupLabel {
  export type Props = MenuGroupLabelProps;
  export type State = MenuGroupLabelState;
}
