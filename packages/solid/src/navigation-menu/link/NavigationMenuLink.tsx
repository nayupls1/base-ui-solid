import type { JSX } from '@solidjs/web';
import { omit } from 'solid-js';
import { useFloatingTree } from '../../utils/popups/tree/FloatingTree';
import type { BaseUIComponentProps, HTMLProps } from '../../internals/types';
import {
  useNavigationMenuRootContext,
  useNavigationMenuTreeContext,
} from '../root/NavigationMenuRootContext';
import { isOutsideMenuEvent } from '../utils/isOutsideMenuEvent';
import { CompositeItem } from '../../internals/composite/item/CompositeItem';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { ownedProps } from '../../internals/ownedProps';

/**
 * A link in the navigation menu that can be used to navigate to a different page or section.
 * Renders an `<a>` element.
 *
 * Documentation: [Base UI Navigation Menu](https://base-ui.com/react/components/navigation-menu)
 */
export function NavigationMenuLink(componentProps: NavigationMenuLink.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(
    componentProps,
    'class',
    'render',
    'active',
    'closeOnClick',
    'style',
    'children',
    'ref',
  );

  const root = useNavigationMenuRootContext();
  const nodeId = useNavigationMenuTreeContext() ?? undefined;
  const tree = useFloatingTree();

  const active = () => componentProps.active ?? false;

  const state = (): NavigationMenuLinkState => ({
    active: active(),
  });

  const defaultProps: HTMLProps = {
    get 'aria-current'() {
      return active() ? 'page' : undefined;
    },
    tabindex: undefined,
    onClick(event: MouseEvent) {
      if (componentProps.closeOnClick ?? false) {
        root.setValue(null, createChangeEventDetails(REASONS.linkPress, event));
      }
    },
    onBlur(event: FocusEvent) {
      const positionerElement = root.positionerElement;
      const popupElement = root.popupElement;
      if (
        positionerElement &&
        popupElement &&
        isOutsideMenuEvent(
          {
            currentTarget: event.currentTarget as HTMLElement | null,
            relatedTarget: event.relatedTarget as HTMLElement | null,
          },
          { popupElement, rootRef: root.rootRef, tree, nodeId },
        )
      ) {
        root.setValue(null, createChangeEventDetails(REASONS.focusOut, event));
      }
    },
  } as any;

  return (
    <CompositeItem
      tag="a"
      render={componentProps.render as any}
      class={componentProps.class as any}
      style={componentProps.style as any}
      state={state()}
      refs={[componentProps.ref as any]}
      props={[defaultProps, elementProps] as any}
    >
      {componentProps.children}
    </CompositeItem>
  );
}

export interface NavigationMenuLinkState {
  /**
   * Whether the link is the currently active page.
   */
  active: boolean;
}

export interface NavigationMenuLinkProps extends BaseUIComponentProps<
  'a',
  NavigationMenuLinkState,
  JSX.IntrinsicElements['a']
> {
  /**
   * Whether the link is the currently active page.
   * @default false
   */
  active?: boolean | undefined;
  /**
   * Whether to close the navigation menu when the link is clicked.
   * @default false
   */
  closeOnClick?: boolean | undefined;
}

export namespace NavigationMenuLink {
  export type State = NavigationMenuLinkState;
  export type Props = NavigationMenuLinkProps;
}
