interface ResolveRenderedAriaLabelProps {
  'aria-label'?: string | undefined;
  render?: unknown;
}

/**
 * Resolves an element's `aria-label`.
 *
 * In Solid, a JSX element passed to `render` is created when the prop is read, so its own
 * attributes can't be inspected without creating a second element. Only the component's
 * `aria-label` is considered.
 *
 * @internal
 */
export function resolveRenderedAriaLabel(props: ResolveRenderedAriaLabelProps) {
  return props['aria-label'];
}
