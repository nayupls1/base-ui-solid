import { omit, untrack } from 'solid-js';
import { useRenderElement } from '../../internals/useRenderElement';
import type { BaseUIComponentProps } from '../../internals/types';
import { useToolbarRootContext } from '../root/ToolbarRootContext';
import type { ToolbarRootState } from '../root/ToolbarRoot';
import { ToolbarGroupContext } from './ToolbarGroupContext';
import { ownedProps } from '../../internals/ownedProps';

/**
 * Groups several toolbar items or toggles.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Toolbar](https://base-ui.com/react/components/toolbar)
 */
export function ToolbarGroup(componentProps: ToolbarGroup.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(componentProps, 'class', 'disabled', 'render', 'style', 'children', 'ref');

  const rootContext = useToolbarRootContext();

  const disabled = () => rootContext.disabled || (componentProps.disabled ?? false);

  const contextValue: ToolbarGroupContext = {
    get disabled() {
      return disabled();
    },
  };

  const state = (): ToolbarRootState => ({
    disabled: disabled(),
    orientation: rootContext.orientation,
  });

  return (
    <ToolbarGroupContext value={contextValue}>
      {untrack(() =>
        useRenderElement('div', componentProps, {
          state,
          props: [{ role: 'group' }, elementProps],
        }),
      )}
    </ToolbarGroupContext>
  );
}

type ToolbarGroupContext = import('./ToolbarGroupContext').ToolbarGroupContext;

export interface ToolbarGroupState extends ToolbarRootState {}

export interface ToolbarGroupProps extends BaseUIComponentProps<'div', ToolbarGroupState> {
  /**
   * When `true` all toolbar items in the group are disabled.
   * @default false
   */
  disabled?: boolean | undefined;
}

export namespace ToolbarGroup {
  export type State = ToolbarGroupState;
  export type Props = ToolbarGroupProps;
}
