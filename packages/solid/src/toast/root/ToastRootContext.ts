import { createContext, useContext } from 'solid-js';
import type { ToastObject } from '../useToastManager';

export interface ToastRootContext {
  toast: ToastObject<any>;
  setTitleId: (
    value: string | undefined | ((prev: string | undefined) => string | undefined),
  ) => void;
  setDescriptionId: (
    value: string | undefined | ((prev: string | undefined) => string | undefined),
  ) => void;
  visibleIndex: number;
  expanded: boolean;
  recalculateHeight: (flushSync?: boolean) => void;
}

export const ToastRootContext = createContext<ToastRootContext | null>(null);

export function useToastRootContext(): ToastRootContext {
  const context = useContext(ToastRootContext);
  if (!context) {
    throw new Error(
      'Base UI: ToastRootContext is missing. Toast parts must be used within <Toast.Root>.',
    );
  }
  return context as ToastRootContext;
}
