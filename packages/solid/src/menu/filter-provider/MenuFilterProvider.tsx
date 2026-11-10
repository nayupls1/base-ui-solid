import type { JSX } from '@solidjs/web';
import { MenuFilterRoot } from '../filter-root/MenuFilterRoot';
import { MenuFilterSubmenuRoot } from '../filter-submenu-root/MenuFilterSubmenuRoot';
import type { MenuFilterProviderOptions } from './MenuFilterProviderOptions';
import { MenuFilterProviderContext } from './MenuFilterProviderContext';
import type { FilterDropdownRoot } from '../../filter-dropdown/root/FilterDropdownRootContext';

/**
 * Makes the `Menu.Root` or `Menu.SubmenuRoot` directly inside it filterable by a `Menu.Input`.
 * Doesn't render its own HTML element.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export function MenuFilterProvider(props: MenuFilterProvider.Props): JSX.Element {
  const contextValue = {
    Root: MenuFilterRoot,
    SubmenuRoot: MenuFilterSubmenuRoot,
    options: {
      get filter() {
        return props.filter;
      },
      get value() {
        return props.value;
      },
      get defaultValue() {
        return props.defaultValue;
      },
      get onValueChange() {
        return props.onValueChange;
      },
      get autoHighlight() {
        return props.autoHighlight;
      },
      get locale() {
        return props.locale;
      },
    },
  };

  return (
    <MenuFilterProviderContext value={contextValue}>{props.children}</MenuFilterProviderContext>
  );
}

export interface MenuFilterProviderState {}

export interface MenuFilterProviderProps extends MenuFilterProviderOptions {
  children?: JSX.Element;
}

export type MenuFilterProviderChangeEventReason = FilterDropdownRoot.ChangeEventReason;
export type MenuFilterProviderChangeEventDetails = FilterDropdownRoot.ChangeEventDetails;

export namespace MenuFilterProvider {
  export type State = MenuFilterProviderState;
  export type Props = MenuFilterProviderProps;
  export type ChangeEventReason = MenuFilterProviderChangeEventReason;
  export type ChangeEventDetails = MenuFilterProviderChangeEventDetails;
}
