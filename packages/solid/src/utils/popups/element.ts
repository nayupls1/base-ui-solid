import { isElement, isHTMLElement } from '@floating-ui/utils/dom';
import { platform } from '@base-ui-solid/utils/platform';
import { closest, contains } from '@base-ui-solid/utils/shadowDom';
import { FOCUSABLE_ATTRIBUTE, TYPEABLE_SELECTOR } from './constants';
import type { PopupTriggerMap } from './popupTriggerMap';
import * as TooltipTriggerDataAttributes from '../../tooltip/trigger/TooltipTriggerDataAttributes';

export function isTargetInsideEnabledTrigger(
  target: EventTarget | null,
  triggerElements: PopupTriggerMap,
) {
  if (!isElement(target)) {
    return false;
  }

  const targetElement = target as Element;

  if (triggerElements.hasElement(targetElement)) {
    return !targetElement.hasAttribute(TooltipTriggerDataAttributes.triggerDisabled);
  }

  for (const [, trigger] of triggerElements.entries()) {
    if (contains(trigger, targetElement)) {
      return !trigger.hasAttribute(TooltipTriggerDataAttributes.triggerDisabled);
    }
  }

  return false;
}

export function isEventTargetWithin(event: Event, node: Node | null | undefined) {
  if (node == null) {
    return false;
  }

  if ('composedPath' in event) {
    return event.composedPath().includes(node);
  }

  // TS thinks `event` is of type never as it assumes all browsers support composedPath, but browsers without shadow dom don't
  const eventAgain = event as Event;
  return eventAgain.target != null && contains(node as Element, eventAgain.target as Element);
}

export function isRootElement(element: Element): boolean {
  return element.matches('html,body');
}

export function isTypeableElement(element: unknown): boolean {
  return isHTMLElement(element) && element.matches(TYPEABLE_SELECTOR);
}

export function isInteractiveElement(element: Element | null) {
  return (
    closest(
      element,
      `button,a[href],[role="button"],select,[tabindex]:not([tabindex="-1"]),${TYPEABLE_SELECTOR}`,
    ) != null
  );
}

export function isTypeableCombobox(element: Element | null) {
  if (!element) {
    return false;
  }
  return element.getAttribute('role') === 'combobox' && isTypeableElement(element);
}

export function matchesFocusVisible(element: Element | null) {
  // We don't want to block focus from working with `visibleOnly`
  // (JSDOM doesn't match `:focus-visible` when the element has `:focus`)
  if (!element || platform.env.jsdom) {
    return true;
  }
  try {
    return element.matches(':focus-visible');
  } catch (_e) {
    return true;
  }
}

export function getFloatingFocusElement(
  positionerElement: HTMLElement | null | undefined,
): HTMLElement | null {
  if (!positionerElement) {
    return null;
  }
  // Try to find the element that has `{...getFloatingProps()}` spread on it.
  // This indicates the floating element is acting as a positioning wrapper, and
  // so focus should be managed on the child element with the event handlers and
  // aria props.
  return positionerElement.hasAttribute(FOCUSABLE_ATTRIBUTE)
    ? positionerElement
    : positionerElement.querySelector(`[${FOCUSABLE_ATTRIBUTE}]`) || positionerElement;
}

/**
 * Returns the logical parent of a node: Solid tags the top-level nodes of a `Portal` with
 * `_$host`, the DOM node where the portal is declared, which is how events delegate through
 * portals. This lets native listeners tell whether an event happened inside a component tree,
 * the counterpart of React synthetic events propagating through portals.
 */
function logicalParentOf(node: any): any {
  return node._$host || node.parentNode || node.host;
}

/**
 * Whether `target` is `container` or a descendant of it in the component tree, crossing portals.
 */
export function isInsideLogicalTree(
  target: EventTarget | null | undefined,
  container: Element | null | undefined,
): boolean {
  if (!target || !container) {
    return false;
  }
  let node: any = target;
  while (node) {
    if (node === container) {
      return true;
    }
    node = logicalParentOf(node);
  }
  return false;
}
