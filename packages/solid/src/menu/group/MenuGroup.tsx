import type { JSX } from '@solidjs/web';
import { createSignal, omit, untrack } from 'solid-js';
import { useMenuFilterImpl } from '../filter-root/MenuFilterContext';
import type { BaseUIComponentProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { MenuGroupContext } from './MenuGroupContext';
import { ownedProps } from '../../internals/ownedProps';

/**
 * @internal
 */
export function MenuGroupPlain(componentProps: MenuGroup.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'ref');

  const [labelId, setLabelId] = createSignal<string | undefined>(undefined, { ownedWrite: true });

  return (
    <MenuGroupContext value={setLabelId as any}>
      {untrack(() =>
        useRenderElement('div', componentProps, {
          props: [
            {
              role: 'group',
              get 'aria-labelledby'() {
                return labelId();
              },
            },
            elementProps,
          ],
        }),
      )}
    </MenuGroupContext>
  );
}

/**
 * Groups related menu items with the corresponding label.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export function MenuGroup(props: MenuGroup.Props) {
  const Group = (useMenuFilterImpl()?.Group ?? MenuGroupPlain) as (
    p: MenuGroup.Props,
  ) => JSX.Element;
  return <Group {...props} />;
}

export interface MenuGroupProps extends BaseUIComponentProps<'div', MenuGroupState> {
  /**
   * The content of the component.
   */
  children?: JSX.Element;
}

export interface MenuGroupState {}

export namespace MenuGroup {
  export type Props = MenuGroupProps;
  export type State = MenuGroupState;
}
