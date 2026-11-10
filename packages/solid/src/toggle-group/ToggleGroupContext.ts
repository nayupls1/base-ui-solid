import { createContext, useContext } from 'solid-js';
import type { BaseUIChangeEventDetails } from '../internals/createBaseUIEventDetails';
import type { BaseUIEventReasons } from '../internals/reasons';

/** Reactive values are getters. */
export interface ToggleGroupContext<Value> {
  readonly value: readonly Value[];
  setGroupValue: (
    newValue: Value,
    nextPressed: boolean,
    eventDetails: BaseUIChangeEventDetails<BaseUIEventReasons['none']>,
  ) => void;
  readonly disabled: boolean;
  readonly isValueInitialized: boolean;
}

export const ToggleGroupContext = createContext<ToggleGroupContext<any> | null>(null);

export function useToggleGroupContext<Value>() {
  return (useContext(ToggleGroupContext) ?? undefined) as ToggleGroupContext<Value> | undefined;
}
