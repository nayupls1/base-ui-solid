import type { JSX } from '@solidjs/web';
import type { RefObject } from '@base-ui-solid/utils/types';
import { createEffect, createMemo, omit, untrack, useContext } from 'solid-js';
import type { InteractionType } from '@base-ui-solid/utils/useEnhancedClickHandler';
import { FloatingFocusManager } from '../../utils/popups/focus/FloatingFocusManager';
import { useHoverPopupInteraction } from '../../utils/popups/interactions/useHoverPopupInteraction';
import type { FloatingFocusManagerProps } from '../../utils/popups/focus/FloatingFocusManager';
import { useMenuRootContext } from '../root/MenuRootContext';
import type { MenuRoot } from '../root/MenuRoot';
import { useMenuPositionerContext } from '../positioner/MenuPositionerContext';
import { useRenderElement } from '../../internals/useRenderElement';
import type { BaseUIComponentProps } from '../../internals/types';
import type { Side, Align } from '../../internals/useAnchorPositioning';
import type { TransitionStatus } from '../../internals/useTransitionStatus';
import { popupTransitionStateMapping } from '../../utils/popups/popupStateMapping';
import { useOpenChangeComplete } from '../../internals/useOpenChangeComplete';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { useToolbarRootContext } from '../../toolbar/root/ToolbarRootContext';
import { COMPOSITE_KEYS } from '../../internals/composite/composite';
import { getDisabledMountTransitionStyles } from '../../internals/getDisabledMountTransitionStyles';
import { useMenuSubmenuRootContext } from '../submenu-root/MenuSubmenuRootContext';
import { useRenderedId } from '../../internals/resolveRenderedId';
import { resolvePopupLabel } from '../../internals/resolvePopupLabel';
import { MenuFilterImplContext, useMenuFilterImpl } from '../filter-root/MenuFilterContext';
import type { MenuFilterParentHandoff } from '../filter-root/MenuFilterContext';
import { mergeProps } from '../../merge-props';
import { ownedProps } from '../../internals/ownedProps';

interface MenuPopupPlainProps extends MenuPopup.Props {
  /** A filter root's own initial focus target; the plain default focuses the popup or its list. */
  initialFocus?: FloatingFocusManagerProps['initialFocus'] | undefined;
}

/**
 * @internal
 */
export function MenuPopupPlain(componentProps: MenuPopupPlainProps) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'style',
    'finalFocus',
    'id',
    'initialFocus',
    'children',
    'ref',
  );

  const { store, setRenderedPopupId, virtualFocus } = useMenuRootContext();
  const rootContext = useMenuRootContext();
  const inheritedSubmenuRootContext = useMenuSubmenuRootContext();
  const positioner = useMenuPositionerContext();
  const insideToolbar = useToolbarRootContext(true) != null;

  const open = store.useState('open');
  const transitionStatus = store.useState('transitionStatus');
  const popupProps = store.useState('popupProps');
  const mounted = store.useState('mounted');
  const instantType = store.useState('instantType');
  const activeTriggerElement = store.useState('activeTriggerElement');
  const parent = store.useState('parent');
  const lastOpenChangeReason = store.useState('lastOpenChangeReason');
  const rootId = store.useState('rootId');
  const floatingTreeRoot = store.useState('floatingTreeRoot');
  const closeDelay = store.useState('closeDelay');
  const hoverEnabled = store.useState('hoverEnabled');
  const disabled = store.useState('disabled');
  const openMethod = store.useState('openMethod');
  const activeTriggerId = store.useState('activeTriggerId');
  const listElement = store.useState('listElement');

  const [id, registerIdRef] = useRenderedId(
    componentProps,
    () => rootContext.generatedPopupId,
    setRenderedPopupId,
  );

  const ariaLabelledBy = () =>
    resolvePopupLabel(componentProps, activeTriggerElement(), activeTriggerId());

  // A dialog's menu can render under a submenu provider; only the actual submenu inherits it.
  const submenuRootContext = () =>
    parent().type === 'menu' ? inheritedSubmenuRootContext : undefined;
  const isContextMenu = () => parent().type === 'context-menu';

  const initialFocus = (): FloatingFocusManagerProps['initialFocus'] => {
    const initialFocusProp = componentProps.initialFocus;
    const list = listElement();
    if (initialFocusProp === undefined && list && parent().type !== 'menu') {
      return () => {
        // A keyboard or screen reader open highlights an item, which list navigation focuses.
        if (store.state.activeIndex !== null) {
          return false;
        }
        // The list holds the `menu` role, so a pointer open lands focus on it rather than on the
        // presentational popup.
        return list;
      };
    }
    return initialFocusProp ?? parent().type !== 'menu';
  };

  useOpenChangeComplete({
    get open() {
      return open();
    },
    ref: store.context.popupRef,
    onComplete() {
      if (open()) {
        store.context.onOpenChangeComplete?.(true);
      }
    },
  });

  createEffect(floatingTreeRoot, (treeRoot) => {
    function handleClose(event: {
      domEvent: Event | undefined;
      reason: MenuRoot.ChangeEventReason;
    }) {
      store.setOpen(false, createChangeEventDetails(event.reason, event.domEvent));
    }

    treeRoot.events.on('close', handleClose);

    return () => {
      treeRoot.events.off('close', handleClose);
    };
  });

  useHoverPopupInteraction(store as any, {
    get enabled() {
      return hoverEnabled() && !disabled() && !isContextMenu() && parent().type !== 'menubar';
    },
    get closeDelay() {
      return closeDelay();
    },
  });

  const setPopupElement = store.useStateSetter('popupElement');

  // Only a menu under a filter root bundles the handoff to a filterable parent.
  const useParentHandoff =
    useContext(MenuFilterImplContext)?.useParentHandoff ?? useNoParentHandoff;
  const { parentVirtualFocusRef, handleFocus } = useParentHandoff(
    store as any,
    untrack(parent),
    open,
    virtualFocus,
  );

  const state = createMemo<MenuPopupState>(() => ({
    transitionStatus: transitionStatus() as TransitionStatus,
    side: positioner.side,
    align: positioner.align,
    open: open(),
    nested: parent().type === 'menu',
    instant: instantType(),
  }));

  const returnFocus = () => {
    const currentParent = parent();
    let value = currentParent.type === undefined || isContextMenu();
    if (
      activeTriggerElement() ||
      (currentParent.type === 'menubar' && lastOpenChangeReason() !== REASONS.outsidePress)
    ) {
      value = true;
    }
    return value;
  };

  // Internal defaults rather than consumer targets, so focus that already moved is respected.
  const dynamicReturnFocus = () => submenuRootContext()?.getReturnElement ?? parentVirtualFocusRef;

  return (
    <FloatingFocusManager
      store={store as any}
      openInteractionType={openMethod()}
      modal={isContextMenu()}
      disabled={!mounted()}
      returnFocus={(componentProps.finalFocus ?? dynamicReturnFocus() ?? returnFocus()) as any}
      explicitReturnFocus={
        componentProps.finalFocus === undefined && dynamicReturnFocus() ? false : undefined
      }
      initialFocus={initialFocus() as any}
      restoreFocus
      getInsideElements={
        parent().type === undefined
          ? () => [store.context.beforeTriggerFocusGuardRef.current]
          : undefined
      }
      externalTree={parent().type !== 'menubar' ? floatingTreeRoot() : undefined}
      previousFocusableElement={activeTriggerElement() as HTMLElement | null}
      nextFocusableElement={
        parent().type === undefined ? store.context.triggerFocusTargetRef : undefined
      }
      beforeContentFocusGuardRef={store.context.beforeContentFocusGuardRef as any}
    >
      {untrack(() =>
        useRenderElement('div', componentProps, {
          state,
          ref: [
            (el: HTMLElement | null) => {
              store.context.popupRef.current = el;
            },
            setPopupElement as (el: HTMLElement | null) => void,
            registerIdRef,
          ],
          stateAttributesMapping: popupTransitionStateMapping,
          props: [
            (merged: Record<string, any>) => mergeProps(merged, popupProps()),
            {
              get id() {
                return id();
              },
              // A rendered `Menu.List` carries the `menu` semantics instead.
              get role() {
                return listElement() ? 'presentation' : 'menu';
              },
              // `menu` is implicitly vertical, so only the non-default value needs to be
              // rendered.
              get 'aria-orientation'() {
                return !listElement() && rootContext.orientation === 'horizontal'
                  ? 'horizontal'
                  : undefined;
              },
              get 'aria-labelledby'() {
                return listElement() ? undefined : ariaLabelledBy();
              },
              onKeyDown(event: KeyboardEvent) {
                submenuRootContext()?.onPopupKeyDown?.(event);
                if (insideToolbar && COMPOSITE_KEYS.has(event.key)) {
                  event.stopPropagation();
                }
              },
              onFocus() {
                handleFocus?.();
              },
            },
            {
              get style() {
                return getDisabledMountTransitionStyles(transitionStatus() as any).style;
              },
            },
            elementProps,
            {
              get 'data-rootownerid'() {
                return rootId();
              },
            },
          ],
        }),
      )}
    </FloatingFocusManager>
  );
}

const NO_PARENT_HANDOFF: MenuFilterParentHandoff = {
  parentVirtualFocusRef: undefined,
  handleFocus: undefined,
};

function useNoParentHandoff() {
  return NO_PARENT_HANDOFF;
}

/**
 * A container for the menu items.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export function MenuPopup(props: MenuPopup.Props) {
  const Popup = (useMenuFilterImpl()?.Popup ?? MenuPopupPlain) as (
    p: MenuPopup.Props,
  ) => JSX.Element;
  return <Popup {...props} />;
}

export interface MenuPopupProps extends BaseUIComponentProps<'div', MenuPopupState> {
  children?: JSX.Element;
  /**
   * @ignore
   */
  id?: string | undefined;
  /**
   * Determines the element to focus when the menu is closed.
   *
   * - `false`: Do not move focus.
   * - `true`: Move focus based on the default behavior (trigger or previously focused element).
   * - `RefObject`: Move focus to the ref element.
   * - `function`: Called with the interaction type (`mouse`, `touch`, `pen`, or `keyboard`).
   *   Return an element to focus, `true` to use the default behavior, or `false`/`undefined` to do nothing.
   */
  finalFocus?:
    | boolean
    | RefObject<HTMLElement | null>
    | ((closeType: InteractionType) => boolean | HTMLElement | null | void)
    | undefined;
}

export interface MenuPopupState {
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
  /**
   * The side of the anchor the component is placed on.
   */
  side: Side;
  /**
   * The alignment of the component relative to the anchor.
   */
  align: Align;
  /**
   * Whether the menu is currently open.
   */
  open: boolean;
  /**
   * Whether the component is nested.
   */
  nested: boolean;
  /**
   * Whether transitions should be skipped.
   */
  instant: 'dismiss' | 'click' | 'group' | 'trigger-change' | undefined;
}

export namespace MenuPopup {
  export type Props = MenuPopupProps;
  export type State = MenuPopupState;
}
