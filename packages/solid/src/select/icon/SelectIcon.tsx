import { createMemo, omit } from 'solid-js';
import { useSelectRootContext } from '../root/SelectRootContext';
import type { BaseUIComponentProps } from '../../internals/types';
import { triggerOpenStateMapping } from '../../utils/popups/popupStateMapping';
import { useRenderElement } from '../../internals/useRenderElement';
import { ownedProps } from '../../internals/ownedProps';

/**
 * An icon that indicates that the trigger button opens a select popup.
 * Renders a `<span>` element.
 *
 * Documentation: [Base UI Select](https://base-ui.com/react/components/select)
 */
export function SelectIcon(componentProps: SelectIcon.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'children', 'ref');
  const store = useSelectRootContext();
  const open = store.useState('open');

  const state = createMemo<SelectIconState>(() => ({ open: open() }));

  return useRenderElement('span', componentProps, {
    state,
    props: [{ 'aria-hidden': true }, elementProps],
    children: () => (componentProps.children !== undefined ? componentProps.children : '▼'),
    stateAttributesMapping: triggerOpenStateMapping,
  });
}

export interface SelectIconState {
  /**
   * Whether the select popup is currently open.
   */
  open: boolean;
}

export interface SelectIconProps extends BaseUIComponentProps<'span', SelectIconState> {}

export namespace SelectIcon {
  export type State = SelectIconState;
  export type Props = SelectIconProps;
}
