import { omit } from 'solid-js';
import type { BaseUIComponentProps, HTMLProps } from '../../internals/types';
import { useSelectRootContext } from '../root/SelectRootContext';
import { useSelectPositionerContext } from '../positioner/SelectPositionerContext';
import { useRenderElement } from '../../internals/useRenderElement';
import { styleDisableScrollbar } from '../../utils/styles';
import { LIST_FUNCTIONAL_STYLES } from '../popup/utils';
import { ownedProps } from '../../internals/ownedProps';

/**
 * A container for the select items.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Select](https://base-ui.com/react/components/select)
 */
export function SelectList(componentProps: SelectList.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'children', 'ref');

  const store = useSelectRootContext();
  const multiple = store.useState('multiple');
  const readOnly = store.useState('readOnly');
  const positioner = useSelectPositionerContext();
  const hasScrollArrows = store.useState('hasScrollArrows');
  const openMethod = store.useState('openMethod');
  const id = store.useState('id');

  const defaultProps: HTMLProps = {
    get id() {
      return `${id()}-list`;
    },
    role: 'listbox',
    get 'aria-multiselectable'() {
      return multiple() || undefined;
    },
    get 'aria-readonly'() {
      return readOnly() || undefined;
    },
    onScroll(event: Event) {
      store.context.scrollHandlerRef.current?.(event.currentTarget as HTMLDivElement);
    },
    get style() {
      return positioner.alignItemWithTriggerActive ? LIST_FUNCTIONAL_STYLES : undefined;
    },
    get class() {
      return hasScrollArrows() && openMethod() !== 'touch'
        ? styleDisableScrollbar.className
        : undefined;
    },
  } as any;

  const setListElement = store.useStateSetter('listElement');

  return useRenderElement('div', componentProps, {
    ref: setListElement as (el: HTMLElement | null) => void,
    props: [defaultProps, elementProps],
  });
}

export interface SelectListProps extends BaseUIComponentProps<'div', SelectListState> {}

export interface SelectListState {}

export namespace SelectList {
  export type Props = SelectListProps;
  export type State = SelectListState;
}
