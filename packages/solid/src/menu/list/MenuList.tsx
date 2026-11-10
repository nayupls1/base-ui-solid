import type { JSX } from '@solidjs/web';
import { createEffect, omit, untrack } from 'solid-js';
import { useMenuFilterImpl } from '../filter-root/MenuFilterContext';
import { useMenuRootContext } from '../root/MenuRootContext';
import { useRenderElement } from '../../internals/useRenderElement';
import { useBaseUiId } from '../../internals/useBaseUiId';
import type { BaseUIComponentProps } from '../../internals/types';
import { resolvePopupLabel } from '../../internals/resolvePopupLabel';
import { ownedProps } from '../../internals/ownedProps';

function MenuListPlain(componentProps: MenuList.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'id', 'ref');

  const rootContext = useMenuRootContext();
  const { store } = rootContext;
  const activeTriggerId = store.useState('activeTriggerId');
  const activeTriggerElement = store.useState('activeTriggerElement');
  const setListElement = store.useStateSetter('listElement');
  const id = useBaseUiId(() => componentProps.id);

  // The trigger reads `aria-controls` off the stored element, which an id change alone leaves in
  // place, so subscribers are told to read it again. Mounting publishes the element itself.
  let renderedId = untrack(id);
  createEffect(id, (nextId) => {
    if (renderedId !== nextId) {
      renderedId = nextId;
      store.notifyAll();
    }
  });

  return useRenderElement('div', componentProps, {
    ref: setListElement as (element: HTMLElement | null) => void,
    props: [
      {
        get id() {
          return id();
        },
        role: 'menu',
        // The popup focuses the list on a pointer open in place of itself.
        tabindex: -1,
        // `menu` is implicitly vertical, so only the non-default value needs to be rendered.
        get 'aria-orientation'() {
          return rootContext.orientation === 'horizontal' ? 'horizontal' : undefined;
        },
        get 'aria-labelledby'() {
          return resolvePopupLabel(componentProps, activeTriggerElement(), activeTriggerId());
        },
      },
      elementProps,
    ],
  });
}

/**
 * Groups menu items so other content, such as a filter input, can share the popup.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export function MenuList(props: MenuList.Props) {
  const List = (useMenuFilterImpl()?.List ?? MenuListPlain) as (p: MenuList.Props) => JSX.Element;
  return <List {...props} />;
}

export interface MenuListState {}

export interface MenuListProps extends BaseUIComponentProps<'div', MenuListState> {}

export namespace MenuList {
  export type Props = MenuListProps;
  export type State = MenuListState;
}
