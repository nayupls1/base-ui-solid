import type { RefObject } from 'base-ui-solidjs-utils/types';
import { omit, Show } from 'solid-js';
import { FloatingPortal } from '../../utils/popups/portal/FloatingPortal';
import type { BaseUIComponentProps } from '../../internals/types';
import { useNavigationMenuRootContext } from '../root/NavigationMenuRootContext';
import { NavigationMenuPortalContext } from './NavigationMenuPortalContext';
import { ownedProps } from '../../internals/ownedProps';

/**
 * A portal element that moves the popup to a different part of the DOM.
 * By default, the portal element is appended to `<body>`.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Navigation Menu](https://base-ui.com/react/components/navigation-menu)
 */
export function NavigationMenuPortal(props: NavigationMenuPortal.Props) {
  props = ownedProps(props);
  const portalProps = omit(props, 'keepMounted');

  const root = useNavigationMenuRootContext();

  const shouldRender = () => root.mounted || (props.keepMounted ?? false);

  return (
    <Show when={shouldRender()}>
      <NavigationMenuPortalContext value={props.keepMounted ?? false}>
        <FloatingPortal {...(portalProps as any)} />
      </NavigationMenuPortalContext>
    </Show>
  );
}

export interface NavigationMenuPortalState {}

export interface NavigationMenuPortalProps extends BaseUIComponentProps<
  'div',
  NavigationMenuPortalState
> {
  /**
   * Whether to keep the portal mounted in the DOM while the popup is hidden.
   * @default false
   */
  keepMounted?: boolean | undefined;
  /**
   * A parent element to render the portal element into.
   */
  container?:
    HTMLElement | ShadowRoot | RefObject<HTMLElement | ShadowRoot | null> | null | undefined;
}

export namespace NavigationMenuPortal {
  export type State = NavigationMenuPortalState;
  export type Props = NavigationMenuPortalProps;
}
