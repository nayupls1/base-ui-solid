interface PopupLabelProps {
  'aria-label'?: string | undefined;
  'aria-labelledby'?: string | undefined;
  render?: unknown;
}

export function resolvePopupLabel(
  props: PopupLabelProps,
  activeTriggerElement: Element | null,
  activeTriggerId: string | null,
) {
  const render = props.render;
  const renderedElement =
    typeof Element !== 'undefined' && render instanceof Element ? render : undefined;
  const ariaLabel = props['aria-label'] ?? renderedElement?.getAttribute('aria-label') ?? undefined;
  let ariaLabelledBy =
    props['aria-labelledby'] ?? renderedElement?.getAttribute('aria-labelledby') ?? undefined;

  if (ariaLabelledBy == null && !ariaLabel) {
    // Prefer the element's live id: a `render` element's own id wins over the registered one.
    ariaLabelledBy = activeTriggerElement
      ? activeTriggerElement.id || undefined
      : activeTriggerId || undefined;
  }

  return ariaLabelledBy;
}
