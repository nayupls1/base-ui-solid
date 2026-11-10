import { omit, untrack } from 'solid-js';
import type { BaseUIComponentProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import type { NavigationMenuItemContextValue } from './NavigationMenuItemContext';
import { NavigationMenuItemContext } from './NavigationMenuItemContext';
import { useBaseUiId } from '../../internals/useBaseUiId';
import { ownedProps } from '../../internals/ownedProps';

/**
 * An individual navigation menu item.
 * Renders a `<li>` element.
 *
 * Documentation: [Base UI Navigation Menu](https://base-ui.com/react/components/navigation-menu)
 */
export function NavigationMenuItem(componentProps: NavigationMenuItem.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'value', 'children', 'ref');

  const fallbackValue = useBaseUiId();

  const contextValue: NavigationMenuItemContextValue = {
    get value() {
      return componentProps.value ?? fallbackValue();
    },
  };

  return (
    <NavigationMenuItemContext value={contextValue}>
      {untrack(() =>
        useRenderElement('li', componentProps, {
          props: [elementProps],
          children: () => componentProps.children,
        }),
      )}
    </NavigationMenuItemContext>
  );
}

export interface NavigationMenuItemState {}

export interface NavigationMenuItemProps extends BaseUIComponentProps<
  'li',
  NavigationMenuItemState
> {
  /**
   * A unique value that identifies this navigation menu item.
   * If no value is provided, a unique ID will be generated automatically.
   * Use when controlling the navigation menu programmatically.
   */
  value?: any;
}

export namespace NavigationMenuItem {
  export type State = NavigationMenuItemState;
  export type Props = NavigationMenuItemProps;
}
