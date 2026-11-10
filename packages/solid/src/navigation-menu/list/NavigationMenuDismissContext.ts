import { createContext, useContext } from 'solid-js';
import type { ElementProps } from '../../utils/popups/types';

/**
 * The list's dismiss props. Fields are getters, so reads are reactive.
 */
export const NavigationMenuDismissContext = createContext<Partial<ElementProps> | null>(null);

export function useNavigationMenuDismissContext() {
  return useContext(NavigationMenuDismissContext);
}
