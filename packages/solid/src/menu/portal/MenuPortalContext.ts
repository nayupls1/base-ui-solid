import { createContext, useContext } from 'solid-js';

export const MenuPortalContext = createContext<boolean | null>(null);

export function useMenuPortalContext() {
  const value = useContext(MenuPortalContext);
  if (value == null) {
    throw new Error('Base UI: <Menu.Portal> is missing.');
  }
  return value ?? undefined;
}
