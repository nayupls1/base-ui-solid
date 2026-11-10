import { omit } from 'solid-js';
import type { BaseUIComponentProps } from '../../internals/types';
import type { ToolbarRoot } from '../root/ToolbarRoot';
import { useToolbarRootContext } from '../root/ToolbarRootContext';
import { CompositeItem } from '../../internals/composite/item/CompositeItem';
import { ownedProps } from '../../internals/ownedProps';

const TOOLBAR_LINK_METADATA = {
  // links cannot be disabled
  disabled: false,
  focusableWhenDisabled: true,
};

/**
 * A link component.
 * Renders an `<a>` element.
 *
 * Documentation: [Base UI Toolbar](https://base-ui.com/react/components/toolbar)
 */
export function ToolbarLink(componentProps: ToolbarLink.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(componentProps, 'class', 'render', 'style', 'children', 'ref');

  const rootContext = useToolbarRootContext();

  const state = (): ToolbarLinkState => ({
    orientation: rootContext.orientation,
  });

  return (
    <CompositeItem
      tag="a"
      render={componentProps.render}
      class={componentProps.class}
      style={componentProps.style}
      metadata={TOOLBAR_LINK_METADATA}
      state={state()}
      refs={[componentProps.ref]}
      props={[elementProps]}
    >
      {componentProps.children}
    </CompositeItem>
  );
}

export interface ToolbarLinkState {
  orientation: ToolbarRoot.Orientation;
}

export interface ToolbarLinkProps extends BaseUIComponentProps<'a', ToolbarLinkState> {}

export namespace ToolbarLink {
  export type State = ToolbarLinkState;
  export type Props = ToolbarLinkProps;
}
