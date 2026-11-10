import { untrack } from 'solid-js';
import type { RefObject } from '@base-ui-solid/utils/types';
import { platform } from '@base-ui-solid/utils/platform';
import type { HTMLProps } from '../../internals/types';
import type { MenuStore } from '../store/MenuStore';
import { REASONS } from '../../internals/reasons';
import { useContextMenuRootContext } from '../../context-menu/root/ContextMenuRootContext';
import { useMenuRootContext } from '../root/MenuRootContext';
import { dispatchClickWithModifiers } from '../../utils/dispatchClickWithModifiers';
import type { UseMenuItemMetadata } from './useMenuItem';

function preventMouseDownDefault(event: MouseEvent) {
  event.preventDefault();
}

export interface UseMenuItemCommonPropsParameters {
  /**
   * Whether to close the menu when the item is clicked.
   */
  closeOnClick: boolean;
  /**
   * Determines if the menu item is highlighted.
   */
  highlighted: boolean;
  /**
   * The id of the menu item.
   */
  id: string | undefined;
  /**
   * The node id of the menu positioner.
   */
  nodeId: string | undefined;
  /**
   * The menu store.
   */
  store: MenuStore<any>;
  /**
   * Whether a typeahead session is in progress.
   */
  typingRef?: RefObject<boolean> | undefined;
  /**
   * Ref to the item element.
   */
  itemRef: RefObject<HTMLElement | null>;
  /**
   * Metadata for checking item type before triggering click.
   */
  itemMetadata: UseMenuItemMetadata;
}

/**
 * Returns common props shared by all menu item types.
 * This hook extracts the shared logic for id, role, tabIndex, and interaction handlers.
 * Parameters are read lazily, so they can be getters.
 */
export function useMenuItemCommonProps(params: UseMenuItemCommonPropsParameters): HTMLProps {
  const store = params.store;
  const rootContext = useMenuRootContext();
  const contextMenuContext = useContextMenuRootContext(true);

  // A submenu trigger is an item of the parent menu's list, so it follows that list's focus model.
  const isSubmenuTrigger = untrack(() => params.itemMetadata.type === 'submenu-trigger');
  const virtualFocus = isSubmenuTrigger ? rootContext.parentVirtualFocus : rootContext.virtualFocus;
  const selectionStore =
    isSubmenuTrigger && rootContext.parent.type === 'menu'
      ? rootContext.parent.store
      : rootContext.store;
  const ariaSelected = selectionStore.useState('webkitAriaSelected', () => params.highlighted);
  const floatingTreeRoot = store.useState('floatingTreeRoot');
  const highlightedWhileOpen = store.useState('highlightedWhileOpen', () => params.highlighted);
  const isContextMenu = contextMenuContext !== undefined;

  return {
    get id() {
      return params.id;
    },
    role: 'menuitem' as const,
    // `-1` rather than omitting it, which leaves links and buttons in the tab order.
    get tabindex() {
      return !virtualFocus && highlightedWhileOpen() ? 0 : -1;
    },
    get 'aria-selected'() {
      return ariaSelected();
    },
    // Real focus stays on the input or list that owns virtual navigation.
    onMouseDown: virtualFocus ? preventMouseDownDefault : undefined,
    onKeyDown(event: KeyboardEvent) {
      if (event.key === ' ' && params.typingRef?.current) {
        event.preventDefault();
      }
    },
    onMouseMove(event: MouseEvent) {
      const nodeId = untrack(() => params.nodeId);
      if (!nodeId) {
        return;
      }

      // Inform the floating tree that a menu item within this menu was hovered/moved over
      // so unrelated descendant submenus can be closed.
      untrack(floatingTreeRoot).events.emit('itemhover', {
        nodeId,
        target: event.currentTarget,
      });
    },
    onClick(event: MouseEvent) {
      if (untrack(() => params.closeOnClick)) {
        untrack(floatingTreeRoot).events.emit('close', {
          domEvent: event,
          reason: REASONS.itemPress,
        });
      }
    },
    onMouseUp(event: MouseEvent) {
      if (contextMenuContext) {
        const initialCursorPoint = contextMenuContext.initialCursorPointRef.current;
        contextMenuContext.initialCursorPointRef.current = null;
        if (
          isContextMenu &&
          initialCursorPoint &&
          Math.abs(event.clientX - initialCursorPoint.x) <= 1 &&
          Math.abs(event.clientY - initialCursorPoint.y) <= 1
        ) {
          return;
        }

        // On non-macOS platforms, this mouseup belongs to the right-click gesture
        // that opened the context menu, so it must not activate an item.
        if (isContextMenu && !platform.os.mac && event.button === 2) {
          return;
        }
      }

      const item = params.itemRef.current;
      if (
        item &&
        untrack(() => params.itemMetadata.type) === 'regular-item' &&
        store.context.allowMouseUpTriggerRef.current &&
        (!isContextMenu || event.button === 2)
      ) {
        // Drag release has no mousedown on this item. Focus it before activation so
        // arrow navigation continues from it when the menu stays open.
        if (!virtualFocus) {
          item.focus({ preventScroll: true });
        }
        // The press started on the trigger and was released over the item, so the item
        // needs a synthetic click. Its `closeOnClick` preference still applies.
        // `detail: 1` and `pointerType: 'mouse'` mark this as a mouse-gesture click so
        // MenuRoot and FloatingFocusManager don't treat it as a keyboard activation.
        dispatchClickWithModifiers(item, event, {
          detail: 1,
          pointerType: 'mouse',
        });
      }
    },
  } as HTMLProps;
}

export interface UseMenuItemCommonPropsState {}
