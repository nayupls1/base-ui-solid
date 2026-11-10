import { createContext, useContext } from 'solid-js';

export type MenuGroupContext = (
  value: string | undefined | ((prev: string | undefined) => string | undefined),
) => void;

export const MenuGroupContext = createContext<MenuGroupContext | null>(null);

export function useMenuGroupRootContext() {
  const context = useContext(MenuGroupContext);
  if (context == null) {
    throw new Error(
      'Base UI: MenuGroupContext is missing. Menu group parts must be used within <Menu.Group> or <Menu.RadioGroup>.',
    );
  }
  return context;
}
