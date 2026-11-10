import { createContext, useContext } from 'solid-js';

/** Values are getters. */
export interface MenuCheckboxItemContext {
  readonly checked: boolean;
  readonly highlighted: boolean;
  readonly disabled: boolean;
}

export const MenuCheckboxItemContext = createContext<MenuCheckboxItemContext | null>(null);

export function useMenuCheckboxItemContext() {
  const context = useContext(MenuCheckboxItemContext);
  if (context == null) {
    throw new Error(
      'Base UI: MenuCheckboxItemContext is missing. MenuCheckboxItem parts must be placed within <Menu.CheckboxItem>.',
    );
  }
  return context;
}
