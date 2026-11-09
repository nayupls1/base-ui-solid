import { createContext, useContext, type Accessor } from 'solid-js';

/**
 * Holds the provider's `delay` value. `closeDelay` is handled by the delay group.
 */
export const TooltipProviderContext = createContext<Accessor<number | undefined> | null>(null);

export function useTooltipProviderContext(): Accessor<number | undefined> | undefined {
  return useContext(TooltipProviderContext) ?? undefined;
}
