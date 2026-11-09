import { createContext, useContext } from 'solid-js';

export const TooltipPortalContext = createContext<boolean | null>(null);

export function useTooltipPortalContext() {
  const value = useContext(TooltipPortalContext);
  if (value == null) {
    throw new Error('Base UI: <Tooltip.Portal> is missing.');
  }
  return value ?? undefined;
}
