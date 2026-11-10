import { createContext, useContext } from 'solid-js';
import type { UseFieldValidationReturnValue } from '../field/root/useFieldValidation';
import type { UseCheckboxGroupParentReturnValue } from './useCheckboxGroupParent';
import type { BaseUIChangeEventDetails } from '../internals/createBaseUIEventDetails';
import type { BaseUIEventReasons } from '../internals/reasons';
import type { LabelableContext } from '../internals/labelable-provider/LabelableContext';

/**
 * Reactive values are getters.
 */
export interface CheckboxGroupContext {
  readonly value: string[];
  setValue: (
    value: string[],
    eventDetails: BaseUIChangeEventDetails<BaseUIEventReasons['none']>,
  ) => void;
  readonly allValues: string[] | undefined;
  parent: UseCheckboxGroupParentReturnValue;
  readonly disabled: boolean;
  validation: UseFieldValidationReturnValue;
  /**
   * `registerControlId` of the labelable scope the group renders in. A checkbox seeing the same
   * function shares that scope, so the group, not the checkbox, is the field's control.
   */
  registerControlId: LabelableContext['registerControlId'];
}

export const CheckboxGroupContext = createContext<CheckboxGroupContext | null>(null);

export function useCheckboxGroupContext() {
  return useContext(CheckboxGroupContext) ?? undefined;
}
