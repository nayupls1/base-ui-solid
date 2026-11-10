import { createContext, useContext, type Accessor } from 'solid-js';
import type { RadioRootState } from './RadioRoot';

export type RadioRootContext = Accessor<RadioRootState>;

export const RadioRootContext = createContext<RadioRootContext | null>(null);

export function useRadioRootContext() {
  const value = useContext(RadioRootContext);
  if (value == null) {
    throw new Error(
      'Base UI: RadioRootContext is missing. Radio parts must be placed within <Radio.Root>.',
    );
  }

  return value;
}
