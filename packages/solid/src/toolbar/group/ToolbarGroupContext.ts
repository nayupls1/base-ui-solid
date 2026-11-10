import { createContext, useContext } from 'solid-js';

/** Reactive values are getters. */
export interface ToolbarGroupContext {
  readonly disabled: boolean;
}

export const ToolbarGroupContext = createContext<ToolbarGroupContext | null>(null);

export function useToolbarGroupContext(): ToolbarGroupContext | undefined {
  return useContext(ToolbarGroupContext) ?? undefined;
}
