import { createContext, useContext } from 'solid-js';
import type { MenuRoot } from '../root/MenuRoot';

/** Values are getters. */
export interface MenuRadioGroupContext {
  readonly value: any;
  setValue: (newValue: any, eventDetails: MenuRoot.ChangeEventDetails) => void;
  readonly disabled: boolean;
}

export const MenuRadioGroupContext = createContext<MenuRadioGroupContext | null>(null);

export function useMenuRadioGroupContext() {
  const context = useContext(MenuRadioGroupContext);
  if (context == null) {
    throw new Error(
      'Base UI: MenuRadioGroupContext is missing. MenuRadioGroup parts must be placed within <Menu.RadioGroup>.',
    );
  }
  return context;
}
