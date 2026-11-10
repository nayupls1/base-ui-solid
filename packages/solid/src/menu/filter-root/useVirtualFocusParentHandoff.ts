import { createEffect, untrack, type Accessor } from 'solid-js';
import { ownerDocument } from 'base-ui-solidjs-utils/owner';
import { activeElement, contains } from 'base-ui-solidjs-utils/shadowDom';
import type { MenuParent, MenuRoot } from '../root/MenuRoot';
import type { MenuStore } from '../store/MenuStore';
import { REASONS } from '../../internals/reasons';
import type { MenuFilterParentHandoff } from './MenuFilterContext';

/**
 * Hands focus and the highlight back to a filterable parent menu when a plain submenu closes.
 */
export function useVirtualFocusParentHandoff(
  store: MenuStore<unknown>,
  parent: MenuParent,
  open: Accessor<boolean>,
  virtualFocus: boolean,
): MenuFilterParentHandoff {
  const parentStore = parent.type === 'menu' ? parent.store : null;
  const parentVirtualFocusRef = parentStore?.context.virtualFocusRef;

  const returnToParent = (trigger: Element | null, reason: MenuRoot.ChangeEventReason | null) => {
    const focusOwner = parentVirtualFocusRef?.current;
    if (virtualFocus || store.select('open') || !parentStore?.select('open') || !focusOwner) {
      return;
    }

    if (contains(store.context.popupRef.current, activeElement(ownerDocument(focusOwner)))) {
      focusOwner.focus({ preventScroll: true });
    }

    if (
      (reason === REASONS.listNavigation || reason === REASONS.escapeKey) &&
      parentStore.state.activeIndex == null
    ) {
      // The closing key is gone by this microtask, so there is no event to report it with.
      parentStore.highlightItem(trigger, REASONS.none);
    }
  };

  createEffect(open, (isOpen) => {
    if (!isOpen) {
      // A parent closing in the same flush, such as on an item press, syncs its controlled
      // `open` afterwards. An unmount can clear the trigger by then, so read it now.
      const trigger = store.state.activeTriggerElement;
      const reason = untrack(() => store.select('lastOpenChangeReason'));
      queueMicrotask(() => returnToParent(trigger, reason as MenuRoot.ChangeEventReason | null));
    }
  });

  // Real focus entering this submenu is when a plain parent's trigger would blur: the parent has
  // no active item until a keyboard close hands the cursor back to the trigger.
  function handleFocus() {
    if (!virtualFocus && parentVirtualFocusRef && parentStore?.state.activeIndex != null) {
      parentStore.setActiveIndex(null, REASONS.none);
    }
  }

  return { parentVirtualFocusRef, handleFocus };
}
