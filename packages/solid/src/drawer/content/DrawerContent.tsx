import { omit } from 'solid-js';
import { useDialogRootContext } from '../../dialog/root/DialogRootContext';
import { useRenderElement } from '../../internals/useRenderElement';
import type { BaseUIComponentProps } from '../../internals/types';
import { DRAWER_CONTENT_ATTRIBUTE } from './drawerContentAttribute';
import { ownedProps } from '../../internals/ownedProps';

/**
 * A container for the drawer contents.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Drawer](https://base-ui.com/react/components/drawer)
 */
export function DrawerContent(componentProps: DrawerContent.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'children', 'ref');

  useDialogRootContext();

  return useRenderElement('div', componentProps, {
    props: [{ [DRAWER_CONTENT_ATTRIBUTE as string]: '' }, elementProps],
  });
}

export interface DrawerContentProps extends BaseUIComponentProps<'div', DrawerContentState> {}

export interface DrawerContentState {}

export namespace DrawerContent {
  export type Props = DrawerContentProps;
  export type State = DrawerContentState;
}
