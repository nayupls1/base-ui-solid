import { createContext, useContext } from 'solid-js';

export interface CompositeRootContext {
  /** Reactive: reads are tracked. */
  readonly highlightedIndex: number;
  onHighlightedIndexChange: (index: number, shouldScrollIntoView?: boolean) => void;
  readonly highlightItemOnHover: boolean;
  /**
   * Makes it possible to control composite components using events that don't originate from their children.
   * For example, a Menubar with detached triggers may define its Menu.Root outside of CompositeRoot.
   * Keyboard events that occur within this menu won't normally be captured by the CompositeRoot,
   * so they need to be forwarded manually using this function.
   */
  relayKeyboardEvent: (event: KeyboardEvent) => void;
}

export const CompositeRootContext = createContext<CompositeRootContext | null>(null);

export function useCompositeRootContext(optional: true): CompositeRootContext | undefined;
export function useCompositeRootContext(optional?: false): CompositeRootContext;
export function useCompositeRootContext(optional = false) {
  const context = useContext(CompositeRootContext);
  if (context == null && !optional) {
    throw new Error(
      'Base UI: CompositeRootContext is missing. Composite parts must be placed within <Composite.Root>.',
    );
  }

  return context ?? undefined;
}
