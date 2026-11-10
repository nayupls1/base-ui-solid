import { createContext, useContext } from 'solid-js';

/** Values are getters. */
export interface MenuRadioItemContext {
  readonly checked: boolean;
  readonly highlighted: boolean;
  readonly disabled: boolean;
}

export const MenuRadioItemContext = createContext<MenuRadioItemContext | null>(null);

export function useMenuRadioItemContext() {
  const context = useContext(MenuRadioItemContext);
  if (context == null) {
    throw new Error(
      'Base UI: MenuRadioItemContext is missing. MenuRadioItem parts must be placed within <Menu.RadioItem>.',
    );
  }
  return context;
}
