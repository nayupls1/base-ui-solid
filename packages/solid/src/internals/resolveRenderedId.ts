import { createMemo, untrack, type Accessor } from 'solid-js';

interface ResolveRenderedIdProps {
  id?: string | undefined;
  render?: unknown;
}

/**
 * Resolves an element's id using the same precedence as `useRenderElement`.
 * Returns `''` when the element renders with an explicitly empty id, which consumers must treat
 * as "no id" rather than falling back to the generated one, so ARIA relationships never reference
 * an id no element carries. Render callbacks are opaque and are expected to use the id passed to
 * them.
 */
export function resolveRenderedId(props: ResolveRenderedIdProps, fallbackId: string | undefined) {
  const render = props.render;
  // A `render` element is a created DOM element in Solid; its own `id` attribute wins.
  if (typeof Element !== 'undefined' && render instanceof Element && render.hasAttribute('id')) {
    return render.getAttribute('id') ?? '';
  }

  return props.id ?? fallbackId;
}

/**
 * Resolves the element's id and returns a ref that publishes it to the owner while mounted.
 * A generated fallback is never published as an override, so removing an explicit id lets the
 * element return to the generated one.
 */
export function useRenderedId(
  props: ResolveRenderedIdProps,
  defaultId: Accessor<string | undefined>,
  setId: ((id: string | undefined) => void) | undefined,
) {
  const id = createMemo(() => resolveRenderedId(props, defaultId()));

  const ref = (element: HTMLElement | null) => {
    const currentId = untrack(id);
    const registeredId = currentId === untrack(defaultId) ? undefined : currentId;
    setId?.(element ? registeredId : undefined);
  };

  return [id, ref] as const;
}
