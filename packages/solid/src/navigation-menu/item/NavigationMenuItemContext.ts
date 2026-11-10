import { createContext, useContext } from 'solid-js';

export interface NavigationMenuItemContextValue {
  value: any;
}

export const NavigationMenuItemContext = createContext<NavigationMenuItemContextValue | null>(null);

export function useNavigationMenuItemContext() {
  const value = useContext(NavigationMenuItemContext);
  if (!value) {
    throw new Error(
      'Base UI: NavigationMenuItem parts must be used within a <NavigationMenu.Item>.',
    );
  }
  return value ?? undefined;
}
