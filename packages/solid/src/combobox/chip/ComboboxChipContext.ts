import { createContext, useContext } from 'solid-js';

export interface ComboboxChipContext {
  index: number;
}

export const ComboboxChipContext = createContext<ComboboxChipContext | null>(null);

export function useComboboxChipContext() {
  const context = useContext(ComboboxChipContext);
  if (!context) {
    throw new Error(
      'Base UI: ComboboxChipContext is missing. ComboboxChip parts must be placed within <Combobox.Chip>.',
    );
  }
  return context ?? undefined;
}
