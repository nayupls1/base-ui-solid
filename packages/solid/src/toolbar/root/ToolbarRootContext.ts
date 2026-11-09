import { createContext, useContext } from 'solid-js';
import type { Orientation } from '../../internals/types';

/** Reactive values are getters. */
export interface ToolbarRootContext {
  readonly disabled: boolean;
  readonly orientation: Orientation;
}

export const ToolbarRootContext = createContext<ToolbarRootContext | null>(null);

export function useToolbarRootContext(optional?: false): ToolbarRootContext;
export function useToolbarRootContext(optional: true): ToolbarRootContext | undefined;
export function useToolbarRootContext(optional?: boolean) {
  const context = useContext(ToolbarRootContext);
  if (context == null && !optional) {
    throw new Error(
      'Base UI: ToolbarRootContext is missing. Toolbar parts must be placed within <Toolbar.Root>.',
    );
  }

  return context ?? undefined;
}
