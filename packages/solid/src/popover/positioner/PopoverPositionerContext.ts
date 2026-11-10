import { createContext, useContext } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { Side, Align } from '../../internals/useAnchorPositioning';
import type { PopupPositioningContext } from '../../utils/popups/types';

/** Reactive values are getters. */
export interface PopoverPositionerContext {
  readonly side: Side;
  readonly align: Align;
  arrowRef: (element: Element | null) => void;
  readonly arrowUncentered: boolean;
  readonly arrowStyles: JSX.CSSProperties;
  context: PopupPositioningContext;
}

export const PopoverPositionerContext = createContext<PopoverPositionerContext | null>(null);

export function usePopoverPositionerContext() {
  const context = useContext(PopoverPositionerContext);
  if (!context) {
    throw new Error(
      'Base UI: PopoverPositionerContext is missing. PopoverPositioner parts must be placed within <Popover.Positioner>.',
    );
  }
  return context;
}
