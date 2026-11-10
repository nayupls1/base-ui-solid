import { createContext, useContext } from 'solid-js';
import type { RefObject } from 'base-ui-solidjs-utils/types';
import type { Side, UseAnchorPositioningReturnValue } from '../../internals/useAnchorPositioning';

/** Reactive values are getters. */
export interface SelectPositionerContext extends Omit<UseAnchorPositioningReturnValue, 'side'> {
  readonly side: 'none' | Side;
  readonly alignItemWithTriggerActive: boolean;
  setControlledAlignItemWithTrigger: (value: boolean) => void;
  scrollUpArrowRef: RefObject<HTMLDivElement | null>;
  scrollDownArrowRef: RefObject<HTMLDivElement | null>;
}

export const SelectPositionerContext = createContext<SelectPositionerContext | null>(null);

export function useSelectPositionerContext() {
  const context = useContext(SelectPositionerContext);
  if (!context) {
    throw new Error(
      'Base UI: SelectPositionerContext is missing. SelectPositioner parts must be placed within <Select.Positioner>.',
    );
  }
  return context;
}
