import { createContext, useContext } from 'solid-js';

export const NavigationMenuPortalContext = createContext<boolean | null>(null);

export function useNavigationMenuPortalContext() {
  const value = useContext(NavigationMenuPortalContext);
  if (value == null) {
    throw new Error('Base UI: <NavigationMenu.Portal> is missing.');
  }
  return value ?? undefined;
}
