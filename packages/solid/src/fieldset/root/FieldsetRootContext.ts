import { createContext, useContext } from 'solid-js';

type SetStateAction<T> = T | ((prev: T) => T);

export interface FieldsetRootContext {
  /** Reactive (getter). */
  readonly legendId: string | undefined;
  setLegendId: (value: SetStateAction<string | undefined>) => void;
  /** Reactive (getter). */
  readonly disabled: boolean;
}

export const FieldsetRootContext = createContext<FieldsetRootContext | null>(null);

export function useFieldsetRootContext(optional: true): FieldsetRootContext | undefined;
export function useFieldsetRootContext(optional?: false): FieldsetRootContext;
export function useFieldsetRootContext(optional = false) {
  const context = useContext(FieldsetRootContext);
  if (!context && !optional) {
    throw new Error(
      'Base UI: FieldsetRootContext is missing. Fieldset parts must be placed within <Fieldset.Root>.',
    );
  }
  return context ?? undefined;
}
