import { createUniqueId } from 'solid-js';

let globalId = 0;

/**
 * Generates a unique id once for the lifetime of the calling component.
 * Falls back to a module counter outside of a reactive owner.
 *
 * @param idOverride overrides the generated id when provided
 * @param prefix prefixes the generated id when provided
 */
export function useId(idOverride?: string, prefix?: string): string {
  if (idOverride != null) {
    return idOverride;
  }
  let id: string;
  try {
    id = createUniqueId();
  } catch {
    globalId += 1;
    id = String(globalId);
  }
  return prefix ? `${prefix}-${id}` : id;
}
