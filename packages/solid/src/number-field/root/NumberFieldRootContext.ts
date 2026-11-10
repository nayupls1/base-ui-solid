import { createContext, useContext } from 'solid-js';
import type { RefObject } from '@base-ui-solid/utils/types';
import type { NumberFieldRoot, NumberFieldRootState } from './NumberFieldRoot';
import type { EventWithOptionalKeyState, IncrementValueParameters } from '../utils/types';

export type InputMode = 'numeric' | 'decimal' | 'text';

/** Reactive values are getters. */
export interface NumberFieldRootContext {
  minWithDefault: number;
  maxWithDefault: number;
  id: string | undefined;
  form: string | undefined;
  setValue: (value: number | null, details: NumberFieldRoot.ChangeEventDetails) => boolean;
  getStepAmount: (event?: EventWithOptionalKeyState) => number;
  incrementValue: (amount: number, params: IncrementValueParameters) => boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  focusInput: () => void;
  allowInputSyncRef: RefObject<boolean | null>;
  formatOptionsRef: RefObject<Intl.NumberFormatOptions | undefined>;
  valueRef: RefObject<number | null>;
  lastChangedValueRef: RefObject<number | null>;
  hasPendingCommitRef: RefObject<boolean>;
  name: string | undefined;
  nameProp: string | undefined;
  inputMode: InputMode;
  getAllowedNonNumericKeys: () => Set<string>;
  min: number | undefined;
  max: number | undefined;
  setInputValue: (value: string | ((prev: string) => string)) => void;
  locale: Intl.LocalesArgument;
  setIsScrubbing: (value: boolean | ((prev: boolean) => boolean)) => void;
  state: NumberFieldRootState;
  onValueCommitted: (
    value: number | null,
    eventDetails: NumberFieldRoot.CommitEventDetails,
  ) => void;
}

export const NumberFieldRootContext = createContext<NumberFieldRootContext | null>(null);

export function useNumberFieldRootContext() {
  const context = useContext(NumberFieldRootContext);
  if (context == null) {
    throw new Error(
      'Base UI: NumberFieldRootContext is missing. NumberField parts must be placed within <NumberField.Root>.',
    );
  }

  return context ?? undefined;
}
