import { createContext, useContext } from 'solid-js';
import type { RefObject } from '@base-ui-solid/utils/types';
import type { ContextMenuRoot } from './ContextMenuRoot';

export interface ContextMenuRootContext {
  anchor: { getBoundingClientRect: () => DOMRect };
  setAnchor: (value: ContextMenuRootContext['anchor'] | ((prev: ContextMenuRootContext['anchor']) => ContextMenuRootContext['anchor'])) => void;
  backdropRef: RefObject<HTMLDivElement | null>;
  internalBackdropRef: RefObject<HTMLDivElement | null>;
  actionsRef: RefObject<{
    setOpen: (nextOpen: boolean, eventDetails: ContextMenuRoot.ChangeEventDetails) => void;
  } | null>;
  positionerRef: RefObject<HTMLElement | null>;
  allowMouseUpTriggerRef: RefObject<boolean>;
  initialCursorPointRef: RefObject<{ x: number; y: number } | null>;
  rootId: string | undefined;
}

export const ContextMenuRootContext = createContext<ContextMenuRootContext | null>(null);

export function useContextMenuRootContext(optional: false): ContextMenuRootContext;
export function useContextMenuRootContext(optional?: true): ContextMenuRootContext | undefined;
export function useContextMenuRootContext(optional = true) {
  const context = useContext(ContextMenuRootContext);
  if (context == null && !optional) {
    throw new Error(
      'Base UI: ContextMenuRootContext is missing. ContextMenu parts must be placed within <ContextMenu.Root>.',
    );
  }
  return context ?? undefined;
}
