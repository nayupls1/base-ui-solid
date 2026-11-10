import { createMemo, type Accessor } from 'solid-js';
import { useId } from '@base-ui-solid/utils/useId';

/**
 * Generates an id prefixed with `base-ui-`, overridable by the reactive `idOverride`.
 * @returns an accessor of the id
 */
export function useBaseUiId(idOverride?: Accessor<string | undefined>): Accessor<string> {
  const generated = useId(undefined, 'base-ui');
  if (!idOverride) {
    return () => generated;
  }
  return createMemo(() => idOverride() ?? generated);
}
