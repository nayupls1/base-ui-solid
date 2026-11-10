import type { JSX } from '@solidjs/web';

export function isRenderableNode(node: JSX.Element): boolean {
  if (node == null || typeof node === 'boolean' || node === '') {
    return false;
  }
  if (Array.isArray(node)) {
    return node.some(isRenderableNode);
  }
  return true;
}

/**
 * Whether resolved children contain anything renderable.
 * Upstream inspects a React element's `children` prop; in Solid the caller passes the
 * resolved children directly.
 */
export function hasRenderableChildren(children: JSX.Element): boolean {
  return isRenderableNode(children);
}
