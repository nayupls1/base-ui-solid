import type { JSX } from '@solidjs/web';
import { createEffect, untrack } from 'solid-js';
import { ownerDocument } from 'base-ui-solidjs-utils/owner';
import { activeElement, contains } from 'base-ui-solidjs-utils/shadowDom';
import { isHTMLElement } from '@floating-ui/utils/dom';
import type { MenuSubmenuRoot, MenuSubmenuRootProps } from '../submenu-root/MenuSubmenuRoot';
import { MenuRootInternal } from '../root/MenuRoot';
import type { MenuRoot } from '../root/MenuRoot';
import type { MenuFilterProviderOptions } from '../filter-provider/MenuFilterProviderOptions';
import { useMenuRootContext } from '../root/MenuRootContext';
import { MenuFilterDropdown } from '../filter-root/MenuFilterDropdown';
import { isKeyboardOpen } from '../utils/isKeyboardOpen';
import { useMenuFilterRoot } from '../filter-root/useMenuFilterRoot';
import type { BaseUIEvent } from '../../internals/types';
import { useDirection } from '../../internals/direction-context/DirectionContext';
import {
  isCrossOrientationCloseKey,
  isCrossOrientationOpenKey,
  isMainOrientationKey,
} from '../../utils/popups/interactions/useListNavigation';
import { stopEvent } from '../../utils/popups/event';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { moveHighlightFrom } from '../filter-root/moveHighlightFrom';
import { MenuSubmenuRootContext } from '../submenu-root/MenuSubmenuRootContext';
import type { MenuStore } from '../store/MenuStore';

type ParentReference = { reference: HTMLElement; trigger: HTMLElement };
type TriggerKeyDownEvent = BaseUIEvent<KeyboardEvent>;

/**
 * A `Menu.SubmenuRoot` whose items are filtered by a `Menu.Input`.
 *
 * @internal
 */
export function MenuFilterSubmenuRoot(props: MenuFilterSubmenuRootProps): JSX.Element {
  const parent = useMenuRootContext();
  const parentStore = parent.store;

  const parentDisabled = parentStore.useState('disabled');

  const { rootProps, dropdownProps } = useMenuFilterRoot(props as any);

  let parentReference: ParentReference | null = null;

  function handleSubmenuEnter(trigger: HTMLElement, event: KeyboardEvent | undefined) {
    const focusedElement = parent.virtualFocus
      ? parentStore.context.virtualFocusRef?.current
      : activeElement(ownerDocument(trigger));

    if (isHTMLElement(focusedElement)) {
      parentReference = { reference: focusedElement, trigger };
      parentStore.setActiveIndex(null, event ? REASONS.keyboard : REASONS.none, event);
    }
  }

  function highlightTrigger(trigger: HTMLElement, event: Event | undefined) {
    parentStore.highlightItem(trigger, REASONS.keyboard, event as any);
  }

  function handleSubmenuExit(event: KeyboardEvent) {
    const reference = parentReference;
    if (!reference) {
      return;
    }

    reference.reference.focus({ preventScroll: true });
    highlightTrigger(reference.trigger, event);
  }

  function handleOpenChange(nextOpen: boolean, details: MenuSubmenuRoot.ChangeEventDetails) {
    (rootProps as any).onOpenChange?.(nextOpen, details);
    if (details.isCanceled) {
      return;
    }

    if (!nextOpen) {
      if (details.reason === REASONS.escapeKey && isHTMLElement(details.trigger)) {
        highlightTrigger(details.trigger, details.event);
        // `MenuPopup` returns focus through `getReturnElement`, so point it at the element that
        // can hold real focus: the parent's input, not its untabbable trigger.
        parentReference = {
          reference: parent.virtualFocus
            ? (parentStore.context.virtualFocusRef?.current ?? details.trigger)
            : details.trigger,
          trigger: details.trigger,
        };
      }
      return;
    }

    parentReference = null;
    if (isHTMLElement(details.trigger) && isKeyboardOpen(details.reason, details.event)) {
      // A keyboard click reports its click, which isn't the key that opened the submenu.
      handleSubmenuEnter(
        details.trigger,
        details.reason === REASONS.listNavigation ? (details.event as KeyboardEvent) : undefined,
      );
    }
  }

  return (
    <MenuRootInternal
      {...(rootProps as any)}
      isSubmenu
      disabled={parentDisabled() || props.disabled}
      onOpenChange={handleOpenChange}
    >
      <MenuFilterSubmenuNavigation
        parentStore={parentStore}
        parentVirtualFocus={parent.virtualFocus}
        parentAllowEscape={() => parent.virtualFocus && parent.allowEscape}
        parentOrientation={() => parent.orientation}
        parentLoopFocus={() => parent.loopFocus}
        getReturnElement={() =>
          parentReference?.reference ??
          (parent.virtualFocus ? parentStore.context.virtualFocusRef?.current : null) ??
          null
        }
        onSubmenuEnter={handleSubmenuEnter}
        onSubmenuExit={handleSubmenuExit}
      >
        <MenuFilterDropdown {...dropdownProps}>{props.children}</MenuFilterDropdown>
      </MenuFilterSubmenuNavigation>
    </MenuRootInternal>
  );
}

interface MenuFilterSubmenuNavigationProps {
  children: JSX.Element;
  parentStore: MenuStore<unknown>;
  parentVirtualFocus: boolean;
  parentAllowEscape: () => boolean;
  parentOrientation: () => MenuRoot.Orientation;
  parentLoopFocus: () => boolean;
  onSubmenuEnter(trigger: HTMLElement, event: KeyboardEvent): void;
  onSubmenuExit(event: KeyboardEvent): void;
  getReturnElement(): HTMLElement | null;
}

function MenuFilterSubmenuNavigation(props: MenuFilterSubmenuNavigationProps) {
  const {
    parentStore,
    parentVirtualFocus,
    parentAllowEscape,
    parentOrientation,
    parentLoopFocus,
    onSubmenuEnter,
    onSubmenuExit,
    getReturnElement,
  } = untrack(() => ({ ...props }));
  const rootContext = useMenuRootContext();
  const { store } = rootContext;
  const direction = useDirection();

  const mounted = store.useState('mounted');

  let wasMounted = false;

  const handleReturnFocus = () => {
    // A plain parent has no input to return to. Focus the trigger this submenu opened from, as a
    // plain submenu does, so a hover close doesn't strand focus on the body.
    const [ownTrigger] = (store.context as any).triggerElements.elements();
    return getReturnElement() ?? (isHTMLElement(ownTrigger) ? ownTrigger : null);
  };

  // A hover close makes the focus manager skip its return focus, which would strand the
  // submenu input's focus on the body once the popup unmounts.
  createEffect(mounted, (isMounted) => {
    const previouslyMounted = wasMounted;
    wasMounted = isMounted;
    if (isMounted || !previouslyMounted) {
      return;
    }

    const returnElement = handleReturnFocus();
    if (!returnElement || !parentStore.select('open')) {
      return;
    }
    const doc = ownerDocument(returnElement);
    const activeEl = activeElement(doc);
    if (activeEl === doc.body || contains(store.select('popupElement'), activeEl)) {
      returnElement.focus({ preventScroll: true });
    }
  });

  function moveInParent(from: HTMLElement, event: KeyboardEvent) {
    const item = moveHighlightFrom(parentStore, from, event, {
      orientation: parentOrientation(),
      rtl: direction() === 'rtl',
      loopFocus: parentLoopFocus(),
      allowEscape: parentAllowEscape(),
    });
    if (!parentVirtualFocus) {
      item?.focus({ preventScroll: true });
    }
  }

  function close(event: KeyboardEvent) {
    if (!store.select('open')) {
      return;
    }

    // The key can reach this popup re-dispatched on its highlighted item, so it can't be left to
    // bubble to the parent. A close key that also navigates the parent moves it from here.
    stopEvent(event);
    const trigger = store.select('activeTriggerElement');

    const eventDetails = createChangeEventDetails(REASONS.listNavigation, event);
    store.setOpen(false, eventDetails);

    if (!eventDetails.isCanceled) {
      onSubmenuExit(event);
    }

    // `onSubmenuExit` bails when the submenu was opened by pointer, so return focus here.
    const returnElement = getReturnElement() ?? store.select('activeTriggerElement');
    if (
      !store.select('open') &&
      isHTMLElement(returnElement) &&
      activeElement(ownerDocument(returnElement)) !== returnElement
    ) {
      returnElement.focus();
    }

    if (
      !store.select('open') &&
      isHTMLElement(trigger) &&
      isMainOrientationKey(event.key, parentOrientation())
    ) {
      moveInParent(trigger, event);
    }
  }

  const handleTriggerKeyDown = (event: TriggerKeyDownEvent) => {
    const currentTarget = event.currentTarget as HTMLElement;
    if (isMainOrientationKey(event.key, parentOrientation())) {
      moveInParent(currentTarget, event);
      event.preventBaseUIHandler();
      stopEvent(event);
      return;
    }

    const open = store.select('open');
    const isRtl = direction() === 'rtl';
    const isCloseKey = isCrossOrientationCloseKey(event.key, rootContext.orientation, isRtl, false);

    if (open && isCloseKey) {
      close(event);
      return;
    }

    const isOpenKey = isCrossOrientationOpenKey(event.key, parentOrientation(), isRtl);
    if (!isOpenKey) {
      return;
    }

    stopEvent(event);

    if (open) {
      // Re-entering an already-open submenu hands the cursor to its own focus owner. The submenu
      // is always virtually focused, so there is no roving-focus branch here. The highlight is
      // kept, so an automatic highlight or an earlier keyboard position survives re-entry.
      onSubmenuEnter(currentTarget, event);
      store.context.virtualFocusRef?.current?.focus({ preventScroll: true });
      return;
    }

    store.setOpen(true, createChangeEventDetails(REASONS.listNavigation, event, currentTarget));
  };

  const handlePopupKeyDown = (event: KeyboardEvent) => {
    // A key that composes text in the input must not close the submenu.
    if (event.which === 229) {
      return;
    }
    const isCloseKey = isCrossOrientationCloseKey(
      event.key,
      rootContext.orientation,
      direction() === 'rtl',
      false,
    );
    if (isCloseKey) {
      close(event);
    }
  };

  const contextValue: MenuSubmenuRootContext = {
    getReturnElement: handleReturnFocus,
    onTriggerKeyDown: handleTriggerKeyDown,
    onPopupKeyDown: handlePopupKeyDown,
  };

  return <MenuSubmenuRootContext value={contextValue}>{props.children}</MenuSubmenuRootContext>;
}

export type MenuFilterSubmenuRootProps = MenuSubmenuRootProps & MenuFilterProviderOptions;
