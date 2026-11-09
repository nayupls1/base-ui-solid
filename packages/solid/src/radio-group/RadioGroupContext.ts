import { createContext, useContext } from 'solid-js';
import type { UseFieldValidationReturnValue } from '../field/root/useFieldValidation';
import type { BaseUIChangeEventDetails } from '../internals/createBaseUIEventDetails';
import type { BaseUIEventReasons } from '../internals/reasons';

type SetStateAction<T> = T | ((prev: T) => T);

/**
 * Reactive values are getters.
 */
export interface RadioGroupContext<Value> {
  readonly disabled: boolean | undefined;
  readonly readOnly: boolean | undefined;
  readonly required: boolean | undefined;
  readonly form: string | undefined;
  readonly name: string | undefined;
  readonly checkedValue: Value | undefined;
  setCheckedValue: (
    value: Value,
    eventDetails: BaseUIChangeEventDetails<BaseUIEventReasons['none']>,
  ) => void;
  readonly touched: boolean;
  setTouched: (value: SetStateAction<boolean>) => void;
  validation?: UseFieldValidationReturnValue | undefined;
  registerInputRef: (element: HTMLInputElement | null) => void | (() => void);
}

export const RadioGroupContext = createContext<RadioGroupContext<any> | null>(null);

export function useRadioGroupContext() {
  return useContext(RadioGroupContext) ?? undefined;
}
