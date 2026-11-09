import { createContext, useContext } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { Side, Align } from '../../internals/useAnchorPositioning';

/** Reactive values are getters. */
export interface TooltipPositionerContext {
  readonly side: Side;
  readonly align: Align;
  arrowRef: (element: Element | null) => void;
  readonly arrowUncentered: boolean;
  readonly arrowStyles: JSX.CSSProperties;
}

export const TooltipPositionerContext = createContext<TooltipPositionerContext | null>(null);

export function useTooltipPositionerContext() {
  const context = useContext(TooltipPositionerContext);
  if (!context) {
    throw new Error(
      'Base UI: TooltipPositionerContext is missing. TooltipPositioner parts must be placed within <Tooltip.Positioner>.',
    );
  }
  return context;
}
