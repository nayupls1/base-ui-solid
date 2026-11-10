import { createContext, useContext } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { Side, Align } from '../../internals/useAnchorPositioning';
import type { PopupPositioningContext } from '../../utils/popups/types';

/** Reactive values are getters. */
export interface MenuPositionerContext {
  readonly side: Side;
  readonly align: Align;
  arrowRef: (element: Element | null) => void;
  readonly arrowUncentered: boolean;
  readonly arrowStyles: JSX.CSSProperties;
  context: PopupPositioningContext;
}

export const MenuPositionerContext = createContext<MenuPositionerContext | null>(null);

export function useMenuPositionerContext(optional?: false): MenuPositionerContext;
export function useMenuPositionerContext(optional: true): MenuPositionerContext | undefined;
export function useMenuPositionerContext(optional?: boolean) {
  const context = useContext(MenuPositionerContext);
  if (!context && !optional) {
    throw new Error(
      'Base UI: MenuPositionerContext is missing. MenuPositioner parts must be placed within <Menu.Positioner>.',
    );
  }
  return context ?? undefined;
}
