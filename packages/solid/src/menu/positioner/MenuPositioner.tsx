import { createEffect, onCleanup, Show, untrack } from 'solid-js';
import { useTimeout } from '@base-ui-solid/utils/useTimeout';
import { FloatingNode } from '../../utils/popups/tree/FloatingTree';
import { MenuPositionerContext } from './MenuPositionerContext';
import { useMenuRootContext } from '../root/MenuRootContext';
import type { MenuRoot } from '../root/MenuRoot';
import type {
  Align,
  Side,
  UseAnchorPositioningSharedParameters,
} from '../../internals/useAnchorPositioning';
import type { BaseUIComponentProps } from '../../internals/types';
import { CompositeList } from '../../internals/composite/list/CompositeList';
import { InternalBackdrop } from '../../utils/popups/InternalBackdrop';
import { useMenuPortalContext } from '../portal/MenuPortalContext';
import { DROPDOWN_COLLISION_AVOIDANCE, POPUP_COLLISION_AVOIDANCE } from '../../internals/constants';
import { useContextMenuRootContext } from '../../context-menu/root/ContextMenuRootContext';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import type { MenuOpenEventDetails } from '../utils/types';
import { useTriggerSwitchTransition } from '../../internals/useTriggerSwitchTransition';
import { usePopupPositioner } from '../../utils/popups/popupPositioner';
import { useAnchoredPopupScrollLock } from '../../utils/popups/useAnchoredPopupScrollLock';
import { ownedProps } from '../../internals/ownedProps';

/**
 * Positions the menu popup against the trigger.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export function MenuPositioner(componentProps: MenuPositioner.Props) {
  componentProps = ownedProps(componentProps);
  const { store, virtualFocus, syncHighlightedItem } = useMenuRootContext();
  const keepMounted = useMenuPortalContext();
  const contextMenuContext = useContextMenuRootContext(true);

  const parent = store.useState('parent');
  const floatingTreeRoot = store.useState('floatingTreeRoot');
  const modal = store.useState('modal');
  const openMethod = store.useState('openMethod');
  const triggerElement = store.useState('activeTriggerElement');
  const positionerElement = store.useState('positionerElement');
  const lastOpenChangeReason = store.useState('lastOpenChangeReason');
  const floatingNodeId = store.useState('floatingNodeId');
  const floatingParentNodeId = store.useState('floatingParentNodeId');
  const domReference = store.useState('anchorElement');

  const placement = () => {
    const currentParent = parent();
    const side = componentProps.side;
    let anchor = componentProps.anchor;
    let sideOffset = componentProps.sideOffset;
    let alignOffset = componentProps.alignOffset;
    let align = componentProps.align;
    if (currentParent.type === 'context-menu') {
      anchor = anchor ?? currentParent.context?.anchor;
      align = align ?? 'start';
      if (!side && align !== 'center') {
        alignOffset = componentProps.alignOffset ?? 2;
        sideOffset = componentProps.sideOffset ?? -5;
      }
    }

    let computedSide = side;
    let computedAlign = align;
    if (currentParent.type === 'menu') {
      computedSide = computedSide ?? 'inline-end';
      computedAlign = computedAlign ?? 'start';
    } else if (currentParent.type === 'menubar') {
      computedSide =
        computedSide ??
        (currentParent.context.orientation === 'vertical' ? 'inline-end' : 'bottom');
      computedAlign = computedAlign ?? 'start';
    }

    const defaultCollisionAvoidance =
      currentParent.type === 'menu' ? POPUP_COLLISION_AVOIDANCE : DROPDOWN_COLLISION_AVOIDANCE;
    const collisionAvoidance = componentProps.collisionAvoidance ?? defaultCollisionAvoidance;

    return {
      anchor,
      sideOffset,
      alignOffset,
      side: computedSide,
      align: computedAlign,
      collisionAvoidance,
      contextMenu: currentParent.type === 'context-menu',
    };
  };

  const {
    element,
    positioning: positioner,
    open,
    mounted,
  } = usePopupPositioner(
    store as any,
    componentProps as any,
    {
      keepMounted,
      positioning: {
        get anchor() {
          return placement().anchor;
        },
        get collisionAvoidance() {
          return placement().collisionAvoidance;
        },
        get positionMethod() {
          return contextMenuContext ? 'fixed' : componentProps.positionMethod;
        },
        get side() {
          return placement().side;
        },
        get sideOffset() {
          return placement().sideOffset;
        },
        get align() {
          return placement().align;
        },
        get alignOffset() {
          return placement().alignOffset;
        },
        get arrowPadding() {
          return placement().contextMenu ? 0 : componentProps.arrowPadding;
        },
        get nodeId() {
          return floatingNodeId();
        },
        get shift() {
          const { contextMenu, collisionAvoidance } = placement();
          return contextMenu
            ? {
                crossAxis: !(
                  'side' in collisionAvoidance && (collisionAvoidance as any).side === 'flip'
                ),
                rootBoundary: 'layoutViewport',
              }
            : undefined;
        },
        get externalTree() {
          return floatingTreeRoot();
        },
        lazyFlip: virtualFocus ? 'placement' : false,
      },
      get state() {
        return { nested: parent().type === 'menu' };
      },
    } as any,
  );

  createEffect(
    () => [floatingTreeRoot(), floatingNodeId()] as const,
    ([treeRoot, nodeId]) => {
      function onMenuOpenChange(details: MenuOpenEventDetails) {
        if (details.open) {
          if (details.parentNodeId === nodeId) {
            store.set('hoverEnabled', false);
          }
          // A submenu that is already closed has nothing to close, and a dropped close would
          // cancel a hover open it has pending. This mirrors the drop rule in `setOpen`.
          if (
            details.nodeId !== nodeId &&
            details.parentNodeId === store.select('floatingParentNodeId') &&
            (store.state.open || store.state.openProp)
          ) {
            store.setOpen(false, createChangeEventDetails(REASONS.siblingOpen));
          }
        }
      }

      treeRoot.events.on('menuopenchange', onMenuOpenChange);

      return () => {
        treeRoot.events.off('menuopenchange', onMenuOpenChange);
      };
    },
  );

  createEffect(floatingTreeRoot, (treeRoot) => {
    if (store.select('floatingParentNodeId') == null) {
      return undefined;
    }

    function onParentClose(details: MenuOpenEventDetails) {
      if (details.open || details.nodeId !== store.select('floatingParentNodeId')) {
        return;
      }

      const reason: MenuRoot.ChangeEventReason = details.reason ?? REASONS.siblingOpen;
      store.setOpen(false, createChangeEventDetails(reason));
    }

    treeRoot.events.on('menuopenchange', onParentClose);

    return () => {
      treeRoot.events.off('menuopenchange', onParentClose);
    };
  });

  const closeTimeout = useTimeout();

  // Clear pending close timeout when the menu closes.
  createEffect(open, (isOpen) => {
    if (!isOpen) {
      closeTimeout.clear();
    }
  });

  // Close unrelated child submenus when hovering a different item in the parent menu.
  createEffect(
    () => [floatingTreeRoot(), open(), triggerElement()] as const,
    ([treeRoot, isOpen, trigger]) => {
      function onItemHover(event: { nodeId: string | undefined; target: Element | null }) {
        // If an item within our parent menu is hovered, and this menu's trigger is not that item,
        // close this submenu. This ensures hovering a different item in the parent closes other
        // branches.
        if (!isOpen || event.nodeId !== store.select('floatingParentNodeId')) {
          return;
        }

        if (event.target && trigger && trigger !== event.target) {
          const delay = store.select('closeDelay');
          if (delay > 0) {
            if (!closeTimeout.isStarted()) {
              closeTimeout.start(delay, () => {
                store.setOpen(false, createChangeEventDetails(REASONS.siblingOpen));
              });
            }
          } else {
            store.setOpen(false, createChangeEventDetails(REASONS.siblingOpen));
          }
        } else {
          // User re-hovered the submenu trigger, cancel pending close.
          closeTimeout.clear();
        }
      }

      treeRoot.events.on('itemhover', onItemHover);
      return () => {
        treeRoot.events.off('itemhover', onItemHover);
      };
    },
  );

  createEffect(
    () => [floatingTreeRoot(), open(), floatingNodeId(), floatingParentNodeId()] as const,
    ([treeRoot, isOpen, nodeId, parentNodeId]) => {
      const eventDetails: MenuOpenEventDetails = {
        open: isOpen,
        nodeId,
        parentNodeId,
        reason: store.select('lastOpenChangeReason'),
      };

      treeRoot.events.emit('menuopenchange', eventDetails);
    },
  );

  useTriggerSwitchTransition({
    store: store as any,
    domReference,
    positionerElement,
    open,
  } as any);

  const menubarModal = () => {
    const currentParent = parent();
    return currentParent.type === 'menubar' && currentParent.context.modal;
  };
  const popupModal = () => modal() && lastOpenChangeReason() !== REASONS.triggerHover;

  useAnchoredPopupScrollLock(
    () => open() && (menubarModal() || popupModal()),
    () => openMethod() === 'touch',
    positionerElement,
    triggerElement as any,
  );

  const shouldRenderBackdrop = () => {
    const currentParent = parent();
    return (
      mounted() &&
      currentParent.type !== 'menu' &&
      ((currentParent.type !== 'menubar' &&
        modal() &&
        lastOpenChangeReason() !== REASONS.triggerHover) ||
        (currentParent.type === 'menubar' && currentParent.context.modal))
    );
  };

  // cuts a hole in the backdrop to allow pointer interaction with the menubar or dropdown menu
  // trigger element
  const backdropCutout = () => {
    const currentParent = parent();
    if (currentParent.type === 'menubar') {
      return currentParent.context.contentElement;
    }
    if (currentParent.type === undefined) {
      return triggerElement() as HTMLElement | null;
    }
    return null;
  };

  const positionerContext: MenuPositionerContext = {
    get side() {
      return positioner.side;
    },
    get align() {
      return positioner.align;
    },
    arrowRef: positioner.arrowRef,
    get arrowUncentered() {
      return positioner.arrowUncentered;
    },
    get arrowStyles() {
      return positioner.arrowStyles;
    },
    context: positioner.context,
  };

  return (
    <MenuPositionerContext value={positionerContext}>
      <Show when={shouldRenderBackdrop()}>
        <InternalBackdrop
          ref={(el: HTMLDivElement) => {
            const currentParent = untrack(parent);
            if (
              currentParent.type === 'context-menu' ||
              currentParent.type === 'nested-context-menu'
            ) {
              currentParent.context.internalBackdropRef.current = el;
            }
          }}
          inert={!open()}
          cutout={backdropCutout()}
        />
      </Show>
      <FloatingNode id={floatingNodeId()}>
        <CompositeList
          elementsRef={store.context.itemDomElements}
          labelsRef={store.context.itemLabels}
          onMapChange={syncHighlightedItem}
        >
          {untrack(element)}
        </CompositeList>
      </FloatingNode>
    </MenuPositionerContext>
  );
}


export interface MenuPositionerState {
  /**
   * Whether the menu is currently open.
   */
  open: boolean;
  /**
   * The side of the anchor the component is placed on.
   */
  side: Side;
  /**
   * The alignment of the component relative to the anchor.
   */
  align: Align;
  /**
   * Whether the anchor element is hidden.
   */
  anchorHidden: boolean;
  /**
   * Whether the component is nested.
   */
  nested: boolean;
  /**
   * Whether CSS transitions should be disabled.
   */
  instant: string | undefined;
}

export interface MenuPositionerProps
  extends
    Omit<UseAnchorPositioningSharedParameters, 'side' | 'align'>,
    BaseUIComponentProps<'div', MenuPositionerState> {
  /**
   * How to align the popup relative to the specified side.
   *
   * Submenus and menubars default to `'start'`.
   * @default 'center'
   */
  align?: UseAnchorPositioningSharedParameters['align'] | undefined;
  /**
   * Which side of the anchor element to align the popup against.
   * May automatically change to avoid collisions.
   *
   * Submenus and vertical menubars default to `'inline-end'`.
   * @default 'bottom'
   */
  side?: UseAnchorPositioningSharedParameters['side'] | undefined;
}

export namespace MenuPositioner {
  export type State = MenuPositionerState;
  export type Props = MenuPositionerProps;
}
