import { createContext, useContext, type Accessor } from 'solid-js';
import type { UseCollapsibleRootReturnValue } from './useCollapsibleRoot';
import type { CollapsibleRoot, CollapsibleRootState } from './CollapsibleRoot';

export interface CollapsibleRootContext extends UseCollapsibleRootReturnValue {
  onOpenChange: (open: boolean, eventDetails: CollapsibleRoot.ChangeEventDetails) => void;
  state: Accessor<CollapsibleRootState>;
}

export const CollapsibleRootContext = createContext<CollapsibleRootContext | null>(null);

export function useCollapsibleRootContext() {
  const context = useContext(CollapsibleRootContext);
  if (context == null) {
    throw new Error(
      'Base UI: CollapsibleRootContext is missing. Collapsible parts must be placed within <Collapsible.Root>.',
    );
  }

  return context;
}
