import { omit } from 'solid-js';
import type { BaseUIComponentProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { ownedProps } from '../../internals/ownedProps';

/**
 * An icon that indicates that the trigger button opens the popup.
 * Renders a `<span>` element.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export function ComboboxIcon(componentProps: ComboboxIcon.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'children', 'ref');

  return useRenderElement('span', componentProps, {
    props: [{ 'aria-hidden': true }, elementProps],
    children: () => componentProps.children ?? '▼',
  });
}

export interface ComboboxIconState {}

export interface ComboboxIconProps extends BaseUIComponentProps<'span', ComboboxIconState> {}

export namespace ComboboxIcon {
  export type State = ComboboxIconState;
  export type Props = ComboboxIconProps;
}
