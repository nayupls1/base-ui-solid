import { createContext, useContext } from 'solid-js';

export interface FieldItemContext {
  /** Reactive (getter). */
  readonly disabled: boolean;
}

export const FieldItemContext = createContext<FieldItemContext>({ disabled: false });

export function useFieldItemContext() {
  return useContext(FieldItemContext);
}
