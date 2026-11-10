import { omit } from 'solid-js';
import { getTarget } from 'base-ui-solidjs-utils/shadowDom';
import type { BaseUIComponentProps, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useFilterDropdownRootContext } from '../root/FilterDropdownRootContext';
import { FilterDropdownGroupContext } from '../group/FilterDropdownGroupContext';
import { useRenderedId } from '../../internals/resolveRenderedId';
import { refocusOwner } from '../utils/refocusOwner';
import { ownedProps } from '../../internals/ownedProps';

/**
 * The list of filterable items.
 * Renders a `<div>` element.
 *
 * @internal
 */
export function FilterDropdownList(componentProps: FilterDropdownList.Props) {
  componentProps = ownedProps(componentProps);
  // `id` is resolved by `useRenderedId`, which also honors an id on the `render` element.
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'id', 'children', 'ref');

  const context = useFilterDropdownRootContext();

  const [id, registerIdRef] = useRenderedId(
    componentProps as any,
    () => context.defaultListId,
    context.setRenderedListId,
  );

  const defaultProps: HTMLProps = {
    // Chromium includes scrollable elements in sequential focus navigation by default.
    tabindex: -1,
    get id() {
      return id();
    },
    onFocus(event: FocusEvent) {
      // A press on the list's own content, such as its background, a group, or a group label,
      // focuses the list.
      const owner = context.focusOwnerRef.current;
      if (owner && event.relatedTarget === owner && getTarget(event) === event.currentTarget) {
        refocusOwner(owner);
      }
    },
    onPointerMove() {
      context.setKeyboardModality(false);
    },
    onPointerDown() {
      context.setKeyboardModality(false);
    },
  } as any;

  return useRenderElement('div', componentProps, {
    ref: registerIdRef,
    props: [defaultProps, elementProps],
    // The list's groups and items belong to this root's query. A nested root's list renders
    // inside an enclosing group, which must not count them as its own members.
    children: () => (
      <FilterDropdownGroupContext value={null}>
        {componentProps.children}
      </FilterDropdownGroupContext>
    ),
  });
}

export interface FilterDropdownListState {}

export interface FilterDropdownListProps extends BaseUIComponentProps<
  'div',
  FilterDropdownListState
> {
  /**
   * The id of the list. Defaults to a generated id.
   */
  id?: string | undefined;
}

export namespace FilterDropdownList {
  export type Props = FilterDropdownListProps;
  export type State = FilterDropdownListState;
}
