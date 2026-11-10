/**
 * @deprecated This utility is no longer used internally and will be removed in the next version.
 */
export function isMouseWithinBounds(event: MouseEvent | PointerEvent) {
  const targetRect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  const isWithinBounds =
    targetRect.top + 1 <= event.clientY &&
    event.clientY <= targetRect.bottom - 1 &&
    targetRect.left + 1 <= event.clientX &&
    event.clientX <= targetRect.right - 1;
  return isWithinBounds;
}
