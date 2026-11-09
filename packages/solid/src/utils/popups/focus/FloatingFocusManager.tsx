import { createEffect, createMemo, Show, untrack, type Accessor } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { RefObject } from '@base-ui-solid/utils/types';
import { getNodeName, isHTMLElement } from '@floating-ui/utils/dom';
import { addEventListener } from '@base-ui-solid/utils/addEventListener';
import { mergeCleanups } from '@base-ui-solid/utils/mergeCleanups';
import { useTimeout } from '@base-ui-solid/utils/useTimeout';
import { platform } from '@base-ui-solid/utils/platform';
import type { InteractionType } from '@base-ui-solid/utils/useEnhancedClickHandler';
import { useAnimationFrame } from '@base-ui-solid/utils/useAnimationFrame';
import { ownerDocument, ownerWindow } from '@base-ui-solid/utils/owner';
import { activeElement, closest, contains, getTarget } from '@base-ui-solid/utils/shadowDom';
import { FocusGuard } from './FocusGuard';
import {
  isInsideLogicalTree,
  isTypeableCombobox,
  getFloatingFocusElement,
  isTypeableElement,
} from '../element';
import { isVirtualClick, isVirtualPointerEvent, stopEvent } from '../event';
import {
  tabbable,
  focusable,
  isOutsideEvent,
  isTabbable,
  getNextTabbable,
  getPreviousTabbable,
} from './tabbable';
import type { FocusableElement } from './tabbable';
import { getNodeAncestors, getNodeChildren } from '../tree/nodes';
import { isElementVisible } from '../../../internals/composite/listIndex';
import type { PopupInteractionStore } from '../types';
import { createChangeEventDetails } from '../../../internals/createBaseUIEventDetails';
import { REASONS } from '../../../internals/reasons';
import { createAttribute } from '../createAttribute';
import { enqueueFocus } from './enqueueFocus';
import { markOthers } from './markOthers';
import { usePortalContext } from '../portal/FloatingPortal';
import { useFloatingTree } from '../tree/FloatingTree';
import type { FloatingTreeStore } from '../tree/FloatingTreeStore';
import { CLICK_TRIGGER_IDENTIFIER } from '../../../internals/constants';
import type { FloatingUIOpenChangeDetails } from '../../../internals/types';
import { resolveRef } from '../../resolveRef';
import { ownedProps } from '../../../internals/ownedProps';

function getEventType(event: Event, lastInteractionType?: InteractionType): InteractionType {
  const win = ownerWindow(getTarget(event));
  if (event instanceof win.KeyboardEvent) {
    return 'keyboard';
  }
  if (event instanceof win.FocusEvent) {
    // Focus events can be caused by a preceding pointer interaction (e.g., focusout on outside press).
    // Prefer the last known pointer type if provided, else treat as keyboard.
    return lastInteractionType || 'keyboard';
  }
  if ('pointerType' in event) {
    // A trusted click without a pointerType is keyboard/AT; only synthesized
    // clicks (e.g. a test harness) pair an empty pointerType with a click count.
    return (
      (event.pointerType as InteractionType) ||
      (isVirtualClick(event as PointerEvent) ? 'keyboard' : lastInteractionType || 'mouse')
    );
  }
  if ('touches' in event) {
    return 'touch';
  }
  if (event instanceof win.MouseEvent) {
    // onClick events may not contain pointer events, and will fall through to here
    return lastInteractionType || (event.detail === 0 ? 'keyboard' : 'mouse');
  }
  return '';
}

const LIST_LIMIT = 20;
let previouslyFocusedElements: WeakRef<Element>[] = [];

function clearDisconnectedPreviouslyFocusedElements() {
  previouslyFocusedElements = previouslyFocusedElements.filter((entry) => {
    return entry.deref()?.isConnected;
  });
}

function addPreviouslyFocusedElement(element: Element | null | undefined) {
  clearDisconnectedPreviouslyFocusedElements();
  if (element && getNodeName(element) !== 'body') {
    previouslyFocusedElements.push(new WeakRef(element));
    if (previouslyFocusedElements.length > LIST_LIMIT) {
      previouslyFocusedElements = previouslyFocusedElements.slice(-LIST_LIMIT);
    }
  }
}

function getPreviouslyFocusedElement(skipHidden?: boolean) {
  clearDisconnectedPreviouslyFocusedElements();
  for (let i = previouslyFocusedElements.length - 1; i >= 0; i -= 1) {
    const element = previouslyFocusedElements[i].deref();
    // The marker skips elements outside an open popup, such as behind a modal.
    if (!skipHidden || !closest(element, '[hidden],[data-base-ui-inert]')) {
      return element;
    }
  }
  return undefined;
}

function getFirstTabbableElement(container: Element | null) {
  if (!container) {
    return null;
  }

  if (isTabbable(container)) {
    return container;
  }

  return tabbable(container)[0] || container;
}

function handleTabIndex(floatingFocusElement: HTMLElement) {
  if (
    floatingFocusElement.hasAttribute('tabindex') &&
    !floatingFocusElement.hasAttribute('data-tabindex')
  ) {
    return;
  }

  if (!floatingFocusElement.getAttribute('role')?.includes('dialog')) {
    return;
  }

  const focusableElements = focusable(floatingFocusElement);
  const tabbableContent = focusableElements.filter((element) => {
    const dataTabIndex = element.getAttribute('data-tabindex') || '';
    return (
      isTabbable(element) ||
      (element.hasAttribute('data-tabindex') && !dataTabIndex.startsWith('-'))
    );
  });
  const tabindex = floatingFocusElement.getAttribute('tabindex');

  if (tabbableContent.length === 0) {
    if (tabindex !== '0') {
      floatingFocusElement.setAttribute('tabindex', '0');
      // Mark our own write so the externally-managed early-return above doesn't
      // mistake it for a user-authored `tabindex` and freeze management.
      floatingFocusElement.setAttribute('data-tabindex', '0');
    }
  } else if (
    tabindex !== '-1' ||
    (floatingFocusElement.hasAttribute('data-tabindex') &&
      floatingFocusElement.getAttribute('data-tabindex') !== '-1')
  ) {
    floatingFocusElement.setAttribute('tabindex', '-1');
    floatingFocusElement.setAttribute('data-tabindex', '-1');
  }
}

export interface FloatingFocusManagerProps {
  children?: JSX.Element;
  /**
   * The popup's interaction store.
   */
  store: PopupInteractionStore;
  /**
   * The interaction type used to open the floating element.
   */
  openInteractionType?: InteractionType | null | undefined;
  /**
   * Whether or not the focus manager should be disabled. Useful to delay focus
   * management until after a transition completes or some other conditional
   * state.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Determines the element to focus when the floating element is opened.
   *
   * - `false`: Do not move focus.
   * - `true`: Move focus based on the default behavior (first tabbable element or floating element).
   * - `RefObject`: Move focus to the ref element.
   * - `function`: Called with the interaction type (`mouse`, `touch`, `pen`, or `keyboard`).
   *   Return an element to focus, `true` to use default behavior, `null` to fallback to default behavior,
   *   or `false`/`undefined` to do nothing.
   * @default true
   */
  initialFocus?:
    | boolean
    | RefObject<HTMLElement | null>
    | HTMLElement
    | ((openType: InteractionType) => boolean | HTMLElement | null | void)
    | undefined;
  /**
   * Determines the element to focus when the floating element is closed.
   *
   * - `false`: Do not move focus.
   * - `true`: Move focus based on the default behavior (reference or previously focused element).
   * - `RefObject`: Move focus to the ref element.
   * - `function`: Called with the interaction type (`mouse`, `touch`, `pen`, or `keyboard`).
   *   Return an element to focus, `true` to use the default behavior, `null` to fallback to default behavior,
   *   or `false`/`undefined` to do nothing.
   * @default true
   */
  returnFocus?:
    | boolean
    | RefObject<HTMLElement | null>
    | HTMLElement
    | ((closeType: InteractionType) => boolean | HTMLElement | null | void)
    | undefined;
  /**
   * Whether `returnFocus` is an explicit consumer target. Internal dynamic defaults use `false`
   * so focus that has already moved outside the floating tree is respected.
   * @internal
   */
  explicitReturnFocus?: boolean | undefined;
  /**
   * Determines where focus should be restored if focus inside the floating element is lost
   * (such as due to the removal of the currently focused element from the DOM).
   *
   * - `true`: restore to the nearest tabbable element inside the floating tree (previous
   *   tabbable if possible, otherwise the last tabbable, then the floating element itself)
   * - `'popup'`: restore directly to the floating element (container) itself
   * - `false`: do not restore focus
   * @default false
   */
  restoreFocus?: boolean | 'popup' | undefined;
  /**
   * Determines if focus is “modal”, meaning focus is fully trapped inside the
   * floating element and outside content cannot be accessed. This includes
   * screen reader virtual cursors.
   * @default true
   */
  modal?: boolean | undefined;
  /**
   * Determines whether `focusout` event listeners that control whether the
   * floating element should be closed if the focus moves outside of it are
   * attached to the reference and floating elements. This affects non-modal
   * focus management.
   * @default true
   */
  closeOnFocusOut?: boolean | undefined;
  /**
   * Overrides the element to focus when tabbing forward out of the floating element.
   */
  nextFocusableElement?: HTMLElement | RefObject<HTMLElement | null> | null | undefined;
  /**
   * Overrides the element to focus when tabbing backward out of the floating element.
   */
  previousFocusableElement?: HTMLElement | RefObject<HTMLElement | null> | null | undefined;
  /**
   * Ref to the focus guard preceding the floating element content.
   * Can be useful to focus the popup programmatically.
   */
  beforeContentFocusGuardRef?: RefObject<HTMLSpanElement | null> | undefined;
  /**
   * External FloatingTree to use when the one provided by context can't be used.
   */
  externalTree?: FloatingTreeStore | undefined;
  /**
   * Additional elements that should be treated as part of the floating subtree
   * even if they are rendered outside the floating element itself.
   */
  getInsideElements?: (() => Array<Element | null | undefined>) | undefined;
}

/**
 * Provides focus management for the floating element.
 * @see https://floating-ui.com/docs/FloatingFocusManager
 * @internal
 */
export function FloatingFocusManager(props: FloatingFocusManagerProps): JSX.Element {
  props = ownedProps(props);
  const { store } = props;

  const disabled = () => props.disabled ?? false;
  const initialFocus = () => props.initialFocus ?? true;
  const returnFocus = () => props.returnFocus ?? true;
  const restoreFocus = () => props.restoreFocus ?? false;
  const modal = () => props.modal ?? true;
  const closeOnFocusOut = () => props.closeOnFocusOut ?? true;
  const openInteractionType = () => props.openInteractionType ?? '';

  const open = store.useState('open');
  const domReference = store.useState('anchorElement');
  const floating = store.useState('positionerElement');

  const storeContext = store.context;
  const { events } = storeContext;

  const getNodeId = () => storeContext.positioning?.nodeId;

  // A typeable combobox reference (e.g. input/textarea) with `initialFocus={false}`
  // has different focus semantics: focus is not trapped inside the floating element,
  // so in the modal case the guards are not rendered, but `aria-hidden` is still
  // applied to the outside nodes.
  const isUntrappedTypeableCombobox = createMemo(
    () => isTypeableCombobox(domReference()) && initialFocus() === false,
  );

  const tree = useFloatingTree(untrack(() => props.externalTree));
  const portalContext = usePortalContext();

  const preventReturnFocusRef = { current: false };
  const isPointerDownRef = { current: false };
  const pointerDownOutsideRef = { current: false };
  const lastFocusedTabbableRef: { current: FocusableElement | null } = { current: null };
  const closeTypeRef: { current: InteractionType } = { current: '' };
  const lastInteractionTypeRef: { current: InteractionType } = { current: '' };

  const beforeGuardRef: { current: HTMLSpanElement | null } = { current: null };
  const afterGuardRef: { current: HTMLSpanElement | null } = { current: null };

  const mergedBeforeGuardRef = (el: HTMLSpanElement | null) => {
    beforeGuardRef.current = el;
    if (props.beforeContentFocusGuardRef) {
      props.beforeContentFocusGuardRef.current = el;
    }
    if (portalContext) {
      portalContext.beforeInsideRef.current = el;
    }
  };
  const mergedAfterGuardRef = (el: HTMLSpanElement | null) => {
    afterGuardRef.current = el;
    if (portalContext) {
      portalContext.afterInsideRef.current = el;
    }
  };

  const blurTimeout = useTimeout();
  const pointerDownTimeout = useTimeout();
  const restoreFocusFrame = useAnimationFrame();

  const isInsidePortal = portalContext != null;
  const floatingFocusElement = createMemo(() => getFloatingFocusElement(floating()));

  const getTabbableContent = (container: Element | null = untrack(floatingFocusElement)) => {
    return container ? tabbable(container) : [];
  };

  const getResolvedInsideElements = () =>
    props.getInsideElements?.().filter((element): element is Element => element != null) ?? [];

  createEffect(
    () => [disabled(), modal(), floatingFocusElement(), isUntrappedTypeableCombobox()] as const,
    ([isDisabled, isModal, focusElement, untrappedCombobox]) => {
      if (isDisabled || !isModal) {
        return undefined;
      }

      function onKeyDown(event: KeyboardEvent) {
        if (event.key === 'Tab') {
          // The focus guards have nothing to focus, so we need to stop the event.
          if (
            contains(focusElement, activeElement(ownerDocument(focusElement))) &&
            getTabbableContent().length === 0 &&
            !untrappedCombobox
          ) {
            stopEvent(event);
          }
        }
      }

      const doc = ownerDocument(focusElement);
      return addEventListener(doc, 'keydown', onKeyDown);
    },
  );

  createEffect(
    () => [disabled(), open(), floating(), domReference(), floatingFocusElement()] as const,
    ([isDisabled, isOpen, floatingEl, reference, focusElement]) => {
      if (isDisabled || !isOpen) {
        return undefined;
      }

      const doc = ownerDocument(focusElement);

      function clearPointerDownOutside() {
        pointerDownOutsideRef.current = false;
      }

      function onPointerDown(event: PointerEvent) {
        const target = getTarget(event) as Element | null;
        const insideElements = getResolvedInsideElements();
        const pointerTargetInside =
          contains(floatingEl, target) ||
          contains(reference, target) ||
          contains(portalContext?.portalNode, target) ||
          isInsideLogicalTree(target, floatingEl) ||
          insideElements.some((element) => element === target || contains(element, target));
        pointerDownOutsideRef.current = !pointerTargetInside;
        lastInteractionTypeRef.current = (event.pointerType as InteractionType) || 'keyboard';

        if (closest(target, `[${CLICK_TRIGGER_IDENTIFIER}]`)) {
          isPointerDownRef.current = true;
          pointerDownTimeout.start(0, () => {
            isPointerDownRef.current = false;
          });
        }
      }

      function onKeyDown() {
        lastInteractionTypeRef.current = 'keyboard';
      }

      return mergeCleanups(
        addEventListener(doc, 'pointerdown', onPointerDown, true),
        addEventListener(doc, 'pointerup', clearPointerDownOutside, true),
        addEventListener(doc, 'pointercancel', clearPointerDownOutside, true),
        addEventListener(doc, 'keydown', onKeyDown, true),
        clearPointerDownOutside,
      );
    },
  );

  createEffect(
    () =>
      [
        disabled(),
        closeOnFocusOut(),
        domReference(),
        floating(),
        floatingFocusElement(),
        modal(),
        restoreFocus(),
        isUntrappedTypeableCombobox(),
      ] as const,
    ([
      isDisabled,
      shouldCloseOnFocusOut,
      reference,
      floatingEl,
      focusElement,
      isModal,
      restore,
      untrappedCombobox,
    ]) => {
      if (isDisabled || !shouldCloseOnFocusOut) {
        return undefined;
      }

      const doc = ownerDocument(focusElement);

      // In Safari, buttons lose focus when pressing them.
      function handlePointerDown() {
        isPointerDownRef.current = true;
        pointerDownTimeout.start(0, () => {
          isPointerDownRef.current = false;
        });
      }

      function handleFocusIn(event: FocusEvent) {
        const target = getTarget(event) as FocusableElement | null;
        if (isTabbable(target)) {
          lastFocusedTabbableRef.current = target;
        }
      }

      function handleFocusOutside(event: FocusEvent) {
        const relatedTarget = event.relatedTarget as HTMLElement | null;
        const currentTarget = event.currentTarget;
        const target = getTarget(event) as HTMLElement | null;

        if (isModal && relatedTarget == null && target != null && contains(floatingEl, target)) {
          addPreviouslyFocusedElement(target);
        }

        queueMicrotask(() => {
          const nodeId = getNodeId();
          const triggers = store.context.triggerElements;
          const insideElements = getResolvedInsideElements();
          const isRelatedFocusGuard =
            relatedTarget?.hasAttribute(createAttribute('focus-guard')) &&
            [
              beforeGuardRef.current,
              afterGuardRef.current,
              portalContext?.beforeInsideRef.current,
              portalContext?.afterInsideRef.current,
              portalContext?.beforeOutsideRef.current,
              portalContext?.afterOutsideRef.current,
              resolveRef(props.previousFocusableElement as any),
              resolveRef(props.nextFocusableElement as any),
            ].includes(relatedTarget);

          const movedToUnrelatedNode = !(
            contains(reference, relatedTarget) ||
            contains(floatingEl, relatedTarget) ||
            contains(relatedTarget, floatingEl) ||
            contains(portalContext?.portalNode, relatedTarget) ||
            isInsideLogicalTree(relatedTarget, floatingEl) ||
            insideElements.some(
              (element) => element === relatedTarget || contains(element, relatedTarget),
            ) ||
            triggers.hasMatchingElement((trigger) => contains(trigger, relatedTarget)) ||
            isRelatedFocusGuard ||
            (tree &&
              (getNodeChildren(tree.nodesRef.current, nodeId).find(
                (node) =>
                  contains(node.context?.elements.floating, relatedTarget) ||
                  contains(node.context?.elements.domReference, relatedTarget),
              ) ||
                getNodeAncestors(tree.nodesRef.current, nodeId).find(
                  (node) =>
                    [
                      node.context?.elements.floating,
                      getFloatingFocusElement(node.context?.elements.floating),
                    ].includes(relatedTarget) ||
                    node.context?.elements.domReference === relatedTarget,
                )))
          );

          if (currentTarget === reference && focusElement) {
            handleTabIndex(focusElement);
          }

          // Restore focus to the previous tabbable element index to prevent
          // focus from being lost outside the floating tree.
          if (
            restore &&
            currentTarget !== reference &&
            !isElementVisible(target) &&
            activeElement(doc) === doc.body
          ) {
            // Let `FloatingPortal` effect knows that focus is still inside the
            // floating tree.
            if (isHTMLElement(focusElement)) {
              focusElement.focus();
              if (restore === 'popup') {
                // If the element is removed on pointerdown, focus tries to move it,
                // but since it's removed at the same time, focus gets lost as it
                // happens after the .focus() call above.
                restoreFocusFrame.request(() => {
                  const currentActiveElement = activeElement(doc);
                  if (currentActiveElement == null || currentActiveElement === doc.body) {
                    focusElement.focus();
                  }
                });
                return;
              }
            }

            const tabbableContent = getTabbableContent() as Array<Element | null>;
            const prevTabbable = lastFocusedTabbableRef.current;
            const nodeToFocus =
              (prevTabbable && tabbableContent.includes(prevTabbable) ? prevTabbable : null) ||
              tabbableContent[tabbableContent.length - 1] ||
              focusElement;

            if (isHTMLElement(nodeToFocus)) {
              nodeToFocus.focus();
            }
          }

          // https://github.com/floating-ui/floating-ui/issues/3060
          if (storeContext.insideReactTree) {
            storeContext.insideReactTree = false;
            return;
          }

          // Focus did not move inside the floating tree, and there are no tabbable
          // portal guards to handle closing.
          if (
            (untrappedCombobox ? true : !isModal) &&
            relatedTarget &&
            movedToUnrelatedNode &&
            !isPointerDownRef.current &&
            // Fix React 18 Strict Mode returnFocus due to double rendering.
            // For an "untrapped" typeable combobox (input role=combobox with
            // initialFocus=false), re-opening the popup and tabbing out should still close it even
            // when the previously focused element (e.g. the next tabbable outside the popup) is
            // focused again. Otherwise, the popup remains open on the second Tab sequence:
            // click input -> Tab (closes) -> click input -> Tab.
            // Allow closing when `isUntrappedTypeableCombobox` regardless of the previously focused element.
            (untrappedCombobox || relatedTarget !== getPreviouslyFocusedElement())
          ) {
            preventReturnFocusRef.current = true;
            store.setOpen(false, createChangeEventDetails(REASONS.focusOut, event));
          }
        });
      }

      function markInsideReactTree() {
        if (pointerDownOutsideRef.current) {
          return;
        }
        storeContext.insideReactTree = true;
        blurTimeout.start(0, () => {
          storeContext.insideReactTree = false;
        });
      }

      const anchorElement = isHTMLElement(reference) ? reference : null;
      if (!floatingEl && !anchorElement) {
        return undefined;
      }

      return mergeCleanups(
        anchorElement && addEventListener(anchorElement, 'focusout', handleFocusOutside),
        anchorElement && addEventListener(anchorElement, 'pointerdown', handlePointerDown),
        floatingEl && addEventListener(floatingEl, 'focusin', handleFocusIn),
        floatingEl && addEventListener(floatingEl, 'focusout', handleFocusOutside),
        floatingEl &&
          portalContext &&
          addEventListener(floatingEl, 'focusout', markInsideReactTree, true),
      );
    },
  );

  createEffect(
    () =>
      [
        open(),
        disabled(),
        domReference(),
        floating(),
        modal(),
        portalContext?.portalNode,
        isUntrappedTypeableCombobox(),
      ] as const,
    ([isOpen, isDisabled, reference, floatingEl, isModal, portalNode, untrappedCombobox]) => {
      if (isDisabled || !floatingEl || !isOpen) {
        return undefined;
      }

      // Don't hide portals nested within the parent portal.
      const portalNodes = Array.from(
        portalNode?.querySelectorAll(`[${createAttribute('portal')}]`) || [],
      );

      const ancestors = tree ? getNodeAncestors(tree.nodesRef.current, getNodeId()) : [];
      const rootAncestorComboboxDomReference = ancestors.find((node) =>
        isTypeableCombobox(node.context?.elements.domReference || null),
      )?.context?.elements.domReference;

      const controlInsideElements = [
        floatingEl,
        ...portalNodes,
        beforeGuardRef.current,
        afterGuardRef.current,
        portalContext?.beforeOutsideRef.current,
        portalContext?.afterOutsideRef.current,
        ...getResolvedInsideElements(),
      ];
      const insideElements = [
        ...controlInsideElements,
        rootAncestorComboboxDomReference,
        resolveRef(props.previousFocusableElement as any),
        resolveRef(props.nextFocusableElement as any),
        untrappedCombobox ? reference : null,
      ].filter((x): x is Element => x != null);

      const ariaHiddenCleanup = markOthers(insideElements, {
        ariaHidden: isModal || untrappedCombobox,
        mark: false,
      });

      const markerInsideElements = [floatingEl, ...portalNodes].filter(
        (x): x is Element => x != null,
      );
      const markerCleanup = markOthers(markerInsideElements);

      return () => {
        markerCleanup();
        ariaHiddenCleanup();
      };
    },
  );

  createEffect(
    () => [open(), disabled(), floatingFocusElement()] as const,
    ([isOpen, isDisabled, focusElement]) => {
      if (!isOpen || isDisabled || !isHTMLElement(focusElement)) {
        return;
      }

      // Reset close metadata for each open session so stale values from a prior close
      // can't influence the next close/return-focus decision.
      closeTypeRef.current = '';
      lastInteractionTypeRef.current = '';

      const doc = ownerDocument(focusElement);
      const previouslyFocusedElement = activeElement(doc);

      // Wait for any layout effect state setters to execute to set `tabIndex`.
      queueMicrotask(() => {
        const initialFocusValueOrFn = untrack(initialFocus);
        const resolvedInitialFocus =
          typeof initialFocusValueOrFn === 'function'
            ? initialFocusValueOrFn(untrack(openInteractionType) || '')
            : initialFocusValueOrFn;

        // If `initialFocus` resolves to `undefined` or `false`, skip focusing.
        if (resolvedInitialFocus === undefined || resolvedInitialFocus === false) {
          return;
        }

        const focusAlreadyInsideFloatingEl = contains(focusElement, previouslyFocusedElement);

        if (focusAlreadyInsideFloatingEl) {
          return;
        }

        let focusableElements: Array<FocusableElement> | null = null;
        const getDefaultFocusElement = () => {
          if (focusableElements == null) {
            focusableElements = getTabbableContent(focusElement);
          }

          return focusableElements[0] || focusElement;
        };

        let elToFocus: FocusableElement | null | undefined;
        if (resolvedInitialFocus === true || resolvedInitialFocus === null) {
          elToFocus = getDefaultFocusElement();
        } else {
          elToFocus = resolveRef(resolvedInitialFocus as any);
        }
        elToFocus = elToFocus || getDefaultFocusElement();

        // If the user has already moved focus inside the floating element, don't override it.
        const hadFocusInside = contains(focusElement, activeElement(doc));

        const openEvent = storeContext.openEvent;
        const openedByVirtualPress =
          openEvent?.type === 'mousedown' && isVirtualClick(openEvent as MouseEvent);

        void enqueueFocus(elToFocus, {
          sync: openedByVirtualPress,
          preventScroll: elToFocus === focusElement,
          shouldFocus() {
            if (!store.select('open')) {
              return false;
            }

            if (hadFocusInside) {
              return true;
            }

            const currentActiveElement = activeElement(doc);
            const focusMovedInside =
              currentActiveElement !== elToFocus && contains(focusElement, currentActiveElement);

            return !focusMovedInside;
          },
        });
      });
    },
  );

  let pendingReturnFocus: { cancelled: boolean } | null = null;

  createEffect(
    () => [disabled(), floating(), floatingFocusElement(), domReference()] as const,
    ([isDisabled, floatingEl, focusElement, reference]) => {
      if (isDisabled || !focusElement) {
        pendingReturnFocus = null;
        return undefined;
      }

      // A new open session supersedes any pending return-focus job from a prior close.
      if (pendingReturnFocus) {
        pendingReturnFocus.cancelled = true;
        pendingReturnFocus = null;
      }

      const doc = ownerDocument(focusElement);
      const elementFocusedBeforeOpen = activeElement(doc);
      const preferPreviousFocus = untrack(() => props.openInteractionType) == null;

      addPreviouslyFocusedElement(
        elementFocusedBeforeOpen === doc.body && !preferPreviousFocus
          ? reference
          : elementFocusedBeforeOpen,
      );

      function onOpenChangeLocal(details: FloatingUIOpenChangeDetails) {
        if (!details.open) {
          closeTypeRef.current = getEventType(details.nativeEvent, lastInteractionTypeRef.current);
        }

        if (
          (details.reason === REASONS.focusOut &&
            details.triggerElement?.hasAttribute(createAttribute('focus-guard'))) ||
          (details.reason === REASONS.triggerHover && details.nativeEvent.type === 'mouseleave')
        ) {
          preventReturnFocusRef.current = true;
        }

        if (details.reason !== REASONS.outsidePress) {
          return;
        }

        if (details.nested) {
          preventReturnFocusRef.current = false;
        } else if (
          isVirtualClick(details.nativeEvent as MouseEvent) ||
          isVirtualPointerEvent(details.nativeEvent as PointerEvent)
        ) {
          preventReturnFocusRef.current = false;
        } else {
          let isPreventScrollSupported = false;
          ownerDocument(focusElement)
            .createElement('div')
            .focus({
              get preventScroll() {
                isPreventScrollSupported = true;
                return false;
              },
            });

          if (isPreventScrollSupported) {
            preventReturnFocusRef.current = false;
          } else {
            preventReturnFocusRef.current = true;
          }
        }
      }

      events.on('openchange', onOpenChangeLocal);

      function getReturnElement(closeType: InteractionType) {
        const returnFocusValueOrFn = untrack(returnFocus);
        let resolvedReturnFocusValue =
          typeof returnFocusValueOrFn === 'function'
            ? returnFocusValueOrFn(closeType)
            : returnFocusValueOrFn;

        if (resolvedReturnFocusValue === undefined || resolvedReturnFocusValue === false) {
          return null;
        }

        if (resolvedReturnFocusValue === null) {
          resolvedReturnFocusValue = true;
        }

        const referenceReturnElement = reference?.isConnected ? reference : null;
        const previousReturnElement =
          elementFocusedBeforeOpen?.isConnected &&
          getNodeName(elementFocusedBeforeOpen) !== 'body'
            ? elementFocusedBeforeOpen
            : null;

        let defaultReturnElement = preferPreviousFocus
          ? previousReturnElement || referenceReturnElement
          : referenceReturnElement || previousReturnElement;

        if (!defaultReturnElement) {
          defaultReturnElement = getPreviouslyFocusedElement() || null;
        }

        if (typeof resolvedReturnFocusValue === 'boolean') {
          return defaultReturnElement;
        }

        return resolveRef(resolvedReturnFocusValue as any) || defaultReturnElement || null;
      }

      return () => {
        events.off('openchange', onOpenChangeLocal);

        const activeEl = activeElement(doc);
        const insideElements = getResolvedInsideElements();
        const isFocusInsideFloatingTree =
          contains(floatingEl, activeEl) ||
          insideElements.some((element) => element === activeEl || contains(element, activeEl)) ||
          (tree &&
            getNodeChildren(tree.nodesRef.current, getNodeId(), false).some((node) =>
              contains(node.context?.elements.floating, activeEl),
            ));

        const returnFocusValueOrFn = untrack(returnFocus);
        const closeType = closeTypeRef.current;
        const returnElement = getReturnElement(closeType);

        const job = { cancelled: false };
        pendingReturnFocus = job;

        queueMicrotask(() => {
          if (pendingReturnFocus === job) {
            pendingReturnFocus = null;
          }
          let tabbableReturnElement = getFirstTabbableElement(returnElement);
          if (tabbableReturnElement?.isConnected && closest(tabbableReturnElement, '[hidden]')) {
            tabbableReturnElement = [activeEl, doc.body].includes(activeElement(doc))
              ? getPreviouslyFocusedElement(true) || null
              : null;
          }
          const hasExplicitReturnFocus =
            untrack(() => props.explicitReturnFocus) ?? typeof returnFocusValueOrFn !== 'boolean';

          if (
            !job.cancelled &&
            returnFocusValueOrFn &&
            !preventReturnFocusRef.current &&
            isHTMLElement(tabbableReturnElement) &&
            (!hasExplicitReturnFocus && tabbableReturnElement !== activeEl && activeEl !== doc.body
              ? isFocusInsideFloatingTree
              : true)
          ) {
            const focusOptions: FocusOptions & { focusVisible?: boolean } = {
              preventScroll: true,
            };
            if (closeType === 'keyboard') {
              focusOptions.focusVisible = true;
            }
            tabbableReturnElement.focus(focusOptions);
          }

          preventReturnFocusRef.current = false;
        });
      };
    },
  );

  // WebKit doesn't move focus out of a hidden typeable element.
  createEffect(
    () => [open(), floating()] as const,
    ([isOpen, floatingEl]) => {
      if (!platform.engine.webkit || isOpen || !floatingEl) {
        return;
      }

      const activeEl = activeElement(ownerDocument(floatingEl));
      if (!isHTMLElement(activeEl) || !isTypeableElement(activeEl)) {
        return;
      }

      if (contains(floatingEl, activeEl)) {
        activeEl.blur();
      }
    },
  );

  // Synchronize the `FloatingPortal` focus manager state.
  createEffect(
    () => [disabled(), modal(), open(), closeOnFocusOut(), domReference()] as const,
    ([isDisabled, isModal, isOpen, shouldCloseOnFocusOut, reference]) => {
      if (isDisabled || !portalContext) {
        return undefined;
      }

      portalContext.setFocusManagerState({
        modal: isModal,
        closeOnFocusOut: shouldCloseOnFocusOut,
        open: isOpen,
        onOpenChange: store.setOpen as any,
        domReference: reference,
      });

      return () => {
        portalContext.setFocusManagerState(null);
      };
    },
  );

  createEffect(
    () => [disabled(), floatingFocusElement()] as const,
    ([isDisabled, focusElement]) => {
      if (isDisabled || !focusElement) {
        return undefined;
      }
      handleTabIndex(focusElement);
      return () => {
        queueMicrotask(clearDisconnectedPreviouslyFocusedElements);
      };
    },
  );

  const shouldRenderGuards = () =>
    !disabled() && (modal() ? !isUntrappedTypeableCombobox() : true) && (isInsidePortal || modal());

  return (
    <>
      <Show when={shouldRenderGuards()}>
        <FocusGuard
          data-type="inside"
          ref={mergedBeforeGuardRef}
          onFocus={(event: FocusEvent) => {
            if (modal()) {
              const els = getTabbableContent();
              els[els.length - 1]?.focus();
            } else if (portalContext?.portalNode) {
              preventReturnFocusRef.current = false;
              if (isOutsideEvent(event, portalContext.portalNode)) {
                const nextTabbable = getNextTabbable(domReference());
                nextTabbable?.focus();
              } else {
                resolveRef(
                  (props.previousFocusableElement as any) ?? portalContext.beforeOutsideRef,
                )?.focus();
              }
            }
          }}
        />
      </Show>
      {props.children}
      <Show when={shouldRenderGuards()}>
        <FocusGuard
          data-type="inside"
          ref={mergedAfterGuardRef}
          onFocus={(event: FocusEvent) => {
            if (modal()) {
              getTabbableContent()[0]?.focus();
            } else if (portalContext?.portalNode) {
              if (closeOnFocusOut()) {
                preventReturnFocusRef.current = true;
              }

              if (isOutsideEvent(event, portalContext.portalNode)) {
                const prevTabbable = getPreviousTabbable(domReference());
                prevTabbable?.focus();
              } else {
                resolveRef(
                  (props.nextFocusableElement as any) ?? portalContext.afterOutsideRef,
                )?.focus();
              }
            }
          }}
        />
      </Show>
    </>
  );
}
