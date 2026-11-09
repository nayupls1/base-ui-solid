import { omit, untrack } from 'solid-js';
import type { BaseUIComponentProps } from '../../../internals/types';
import type { RefInput } from '../../../internals/useRenderElement';
import { useFloatingPortalNode, type PortalContainer } from './FloatingPortal';
import { ownedProps } from '../../../internals/ownedProps';

/**
 * `FloatingPortal` includes tabbable logic handling for focus management.
 * For components that don't need tabbable logic, use `FloatingPortalLite`.
 * @internal
 */
export function FloatingPortalLite(componentProps: FloatingPortalLite.Props<any>) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(
    componentProps,
    'children',
    'container',
    'class',
    'render',
    'style',
    'ref',
  );

  const portal = useFloatingPortalNode({
    get container() {
      return componentProps.container;
    },
    componentProps: {
      get render() {
        return componentProps.render;
      },
      get class() {
        return componentProps.class;
      },
      get style() {
        return componentProps.style;
      },
      get ref() {
        return componentProps.ref;
      },
    },
    elementProps,
    children: () => componentProps.children,
  });

  return untrack(portal.subtree);
}

export interface FloatingPortalLiteState {}

export interface FloatingPortalLiteProps<TState> extends BaseUIComponentProps<'div', TState> {
  container?: PortalContainer | undefined;
  ref?: RefInput<HTMLDivElement> | undefined;
}

export namespace FloatingPortalLite {
  export type State = FloatingPortalLiteState;
  export type Props<TState> = FloatingPortalLiteProps<TState>;
}
