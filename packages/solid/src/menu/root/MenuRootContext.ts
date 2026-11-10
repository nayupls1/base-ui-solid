import { createContext, useContext } from 'solid-js';
import type { MenuStore } from '../store/MenuStore';
import type { MenuParent, MenuRoot } from './MenuRoot';

export interface MenuRootContext<Payload = unknown> {
  store: MenuStore<Payload>;
  parent: MenuParent;
  orientation: MenuRoot.Orientation;
  loopFocus: boolean;
  /** Whether arrow keys can step from either end of the list back to a virtual focus owner. */
  allowEscape: boolean;
  generatedPopupId: string | undefined;
  /** Records the id the popup rendered with, when it differs from `generatedPopupId`. */
  setRenderedPopupId: (value: string | undefined | ((prev: string | undefined) => string | undefined)) => void;
  virtualFocus: boolean;
  parentVirtualFocus: boolean;
  /** Re-emits `onItemHighlighted` after the item registry settles. */
  syncHighlightedItem: () => void;
}

export const MenuRootContext = createContext<MenuRootContext | null>(null);

export function useMenuRootContext(optional?: false): MenuRootContext;
export function useMenuRootContext(optional: true): MenuRootContext | undefined;
export function useMenuRootContext(optional?: boolean) {
  const context = useContext(MenuRootContext);
  if (context == null && !optional) {
    throw new Error(
      'Base UI: MenuRootContext is missing. Menu parts must be placed within <Menu.Root>.',
    );
  }

  return context ?? undefined;
}
