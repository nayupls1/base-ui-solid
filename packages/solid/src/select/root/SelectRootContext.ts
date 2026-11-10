import { createContext, useContext } from 'solid-js';
import type { SelectStore } from '../store';

export const SelectRootContext = createContext<SelectStore | null>(null);

// When options and a controlled value change together, item reconciliation can run before
// the store syncs and clear the new selection using stale inputs. The context provides the
// current value and selection mode (as getters). https://github.com/mui/base-ui/issues/5875
export const SelectSelectionContext = createContext<{
  readonly value: any;
  readonly multiple: boolean;
} | null>(null);

export function useSelectRootContext() {
  const store = useContext(SelectRootContext);
  if (store == null) {
    throw new Error(
      'Base UI: SelectRootContext is missing. Select parts must be placed within <Select.Root>.',
    );
  }
  return store;
}

export function useSelectSelectionContext() {
  const selection = useContext(SelectSelectionContext);
  if (selection == null) {
    throw new Error(
      'Base UI: SelectRootContext is missing. Select parts must be placed within <Select.Root>.',
    );
  }
  return selection;
}
