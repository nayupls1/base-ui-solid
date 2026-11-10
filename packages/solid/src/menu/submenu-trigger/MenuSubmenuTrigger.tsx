import { createEffect, createMemo, omit, onCleanup, Show, untrack } from 'solid-js';
import { isElementDisabled } from 'base-ui-solidjs-utils/isElementDisabled';
import { warn } from 'base-ui-solidjs-utils/warn';
import { EMPTY_OBJECT } from 'base-ui-solidjs-utils/empty';
import { platform } from 'base-ui-solidjs-utils/platform';
import { getTarget } from 'base-ui-solidjs-utils/shadowDom';
import { createSyncSignal } from 'base-ui-solidjs-utils/createSyncSignal';
import { useMenuFilterItem } from '../filter-root/MenuFilterContext';
import { mergeProps } from '../../merge-props';
import { reactiveMergeProps } from '../../internals/reactiveMergeProps';
import { safePolygon } from '../../utils/popups/interactions/safePolygon';
import { useClick } from '../../utils/popups/interactions/useClick';
import { useHoverTriggerInteraction } from '../../utils/popups/interactions/useHoverTriggerInteraction';
import type { BaseUIComponentProps, NonNativeButtonProps } from '../../internals/types';
import { useMenuRootContext } from '../root/MenuRootContext';
import { useBaseUiId } from '../../internals/useBaseUiId';
import { triggerOpenStateMapping } from '../../utils/popups/popupStateMapping';
import { useCompositeListItem } from '../../internals/composite/list/useCompositeListItem';
import { useMenuItem } from '../item/useMenuItem';
import { useRenderElement } from '../../internals/useRenderElement';
import { useMenuPositionerContext } from '../positioner/MenuPositionerContext';
import { useTriggerRegistration } from '../../utils/popups/popupStoreUtils';
import { useMenuSubmenuRootContext } from '../submenu-root/MenuSubmenuRootContext';
import { REASONS } from '../../internals/reasons';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { ownedProps } from '../../internals/ownedProps';

const VOICE_OVER_EXPANDED_PROPS = { 'aria-expanded': undefined };

function MenuSubmenuTriggerPlain(componentProps: MenuSubmenuTrigger.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'style',
    'label',
    'id',
    'nativeButton',
    'openOnHover',
    'delay',
    'closeDelay',
    'disabled',
    'children',
    'ref',
  );
  const openOnHover = () => componentProps.openOnHover ?? true;
  const delay = () => componentProps.delay ?? 100;
  const closeDelay = () => componentProps.closeDelay ?? 0;

  const context = useMenuRootContext(true);
  if (context?.parent.type !== 'menu') {
    throw new Error('Base UI: <Menu.SubmenuTrigger> must be placed in <Menu.SubmenuRoot>.');
  }

  const menuPositionerContext = useMenuPositionerContext(true);
  const submenuRootContext = useMenuSubmenuRootContext();

  const { store, parentVirtualFocus } = context;
  const parentMenuStore = context.parent.store;

  const listItem = useCompositeListItem({
    guess: true,
    get label() {
      return componentProps.label;
    },
  });
  const thisTriggerId = useBaseUiId(() => componentProps.id);

  const open = store.useState('open');
  let focusReturnedThroughGuard = false;
  const positionerElement = store.useState('positionerElement');
  const floatingTreeRoot = store.useState('floatingTreeRoot');
  const popupId = store.useState('triggerPopupId', thisTriggerId);

  const baseRegisterTrigger = useTriggerRegistration(thisTriggerId, store as any);

  const registerTrigger = (element: Element | null) => {
    baseRegisterTrigger(element);

    const activeTriggerElement = store.select('activeTriggerElement');
    if (
      element !== null &&
      store.select('open') &&
      (activeTriggerElement === element || store.select('activeTriggerId') == null)
    ) {
      store.update({
        activeTriggerId: untrack(thisTriggerId) ?? null,
        activeTriggerElement: element,
        closeDelay: untrack(closeDelay),
      } as any);
    }
  };

  const [triggerElement, setTriggerElement] = createSyncSignal<HTMLElement | null>(null);

  const handleTriggerElementRef = (el: HTMLElement | null) => {
    setTriggerElement(el);
    store.set('activeTriggerElement', el);
  };

  // Register the rendered element when the id changes too (a ref doesn't re-run then).
  createEffect(
    () => [thisTriggerId(), triggerElement()] as const,
    ([, element]) => {
      registerTrigger(element);
      return () => registerTrigger(null);
    },
  );

  createEffect(
    () => [open(), positionerElement()] as const,
    ([isOpen, positioner]) => {
      if (!isOpen || !positioner) {
        return undefined;
      }

      function handleGuardFocusOut(event: FocusEvent) {
        if (getTarget(event) === store.context.beforeContentFocusGuardRef.current) {
          focusReturnedThroughGuard = event.relatedTarget === triggerElement();
        }
      }

      // Observe focus leaving the guard inside its positioner. When the portal is in a shadow
      // root, the trigger's focus event can report the shadow host as `relatedTarget`.
      positioner.addEventListener('focusout', handleGuardFocusOut, true);
      return () => {
        focusReturnedThroughGuard = false;
        positioner.removeEventListener('focusout', handleGuardFocusOut, true);
      };
    },
  );

  store.useSyncedValue('closeDelay', closeDelay);

  const rootDisabled = store.useState('disabled');
  const parentDisabled = parentMenuStore.useState('disabled');

  const disabled = () => (componentProps.disabled ?? false) || rootDisabled() || parentDisabled();

  if (process.env.NODE_ENV !== 'production') {
    createEffect(
      () => [triggerElement(), disabled()] as const,
      ([element, isDisabled]) => {
        if (element && isElementDisabled(element) && !isDisabled) {
          warn(
            'A disabled element was detected on <Menu.SubmenuTrigger>. To properly disable the trigger, use the `disabled` prop on the component instead of setting it on the rendered element.',
          );
        }
      },
    );
  }

  const itemProps = parentMenuStore.useState('itemProps');
  const highlighted = parentMenuStore.useState('isActive', listItem.index);

  const itemMetadata = {
    type: 'submenu-trigger' as const,
    setActive(event: MouseEvent) {
      if (parentMenuStore.select('highlightItemOnHover')) {
        parentMenuStore.setActiveIndex(untrack(listItem.index), REASONS.pointer, event);
      }
    },
  };

  const { getItemProps, itemRef } = useMenuItem({
    closeOnClick: false,
    get disabled() {
      return disabled();
    },
    get highlighted() {
      return highlighted();
    },
    get id() {
      return thisTriggerId();
    },
    store,
    typingRef: parentMenuStore.context.typingRef,
    get nativeButton() {
      return componentProps.nativeButton ?? false;
    },
    itemMetadata,
    get nodeId() {
      return menuPositionerContext?.context.nodeId;
    },
  });

  const hoverEnabled = store.useState('hoverEnabled');

  const hoverProps = useHoverTriggerInteraction(
    store as any,
    {
      get enabled() {
        return hoverEnabled() && openOnHover() && !disabled();
      },
      handleClose: safePolygon({ blockPointerEvents: true }),
      mouseOnly: true,
      move: true,
      get restMs() {
        return delay();
      },
      get delay() {
        return { open: delay(), close: closeDelay() };
      },
      get shouldOpen() {
        return delay() > 0 ? () => parentMenuStore.select('allowMouseEnter') : undefined;
      },
      triggerElement,
      get externalTree() {
        return floatingTreeRoot();
      },
      // Chrome can drop the trigger's `mouseleave` during a fast pointer sweep,
      // leaving a stale submenu open (see #5152) — cancel from `mouseout` too.
      guardStaleOpen: true,
    } as any,
  );

  const click = useClick(
    store as any,
    {
      get enabled() {
        return !disabled();
      },
      event: 'mousedown',
      // Without toggling, TalkBack users cannot close the submenu to reach the next parent menu
      // item. Keep toggling enabled so activating its trigger closes it.
      toggle: true,
      get ignoreMouse() {
        return openOnHover();
      },
      stickIfOpen: () => untrack(openOnHover),
    } as any,
  );

  const rootTriggerProps = store.useState('triggerProps', true);

  const state = createMemo<MenuSubmenuTriggerState>(() => ({
    disabled: disabled(),
    highlighted: highlighted(),
    open: open(),
  }));

  const openMethod = store.useState('openMethod');
  const lastOpenChangeReason = store.useState('lastOpenChangeReason');
  // Arrow keys open the submenu through list navigation without dispatching a click, so
  // `openMethod` stays null there; Enter and Space do dispatch one and report `keyboard`.
  const shouldOmitExpanded = () =>
    open() &&
    (lastOpenChangeReason() === REASONS.listNavigation || openMethod() === 'keyboard') &&
    platform.screenReader.voiceOver;

  return useRenderElement('div', componentProps, {
    state,
    stateAttributesMapping: triggerOpenStateMapping,
    props: [
      (merged: Record<string, any>) => mergeProps(merged, click.reference ?? EMPTY_OBJECT),
      hoverProps,
      (merged: Record<string, any>) => {
        const { id, ...rest } = (rootTriggerProps() ?? EMPTY_OBJECT) as Record<string, any>;
        void id;
        return mergeProps(merged, rest);
      },
      // MenuFilterSubmenuRoot overrides the generic trigger handler because entry and exit
      // depend on both the parent and child menu orientations.
      submenuRootContext?.onTriggerKeyDown
        ? { onKeyDown: submenuRootContext.onTriggerKeyDown }
        : EMPTY_OBJECT,
      (merged: Record<string, any>) => mergeProps(merged, itemProps()),
      // Opening a submenu changes the trigger's expanded state while the trigger still holds
      // focus, and VoiceOver announces that state change instead of the submenu item that focus
      // moves to a moment later. Dropping the state while the submenu is open avoids the
      // announcement; `aria-haspopup` still conveys that the item opens a submenu.
      (merged: Record<string, any>) =>
        shouldOmitExpanded() ? { ...merged, ...VOICE_OVER_EXPANDED_PROPS } : merged,
      {
        get 'aria-controls'() {
          return popupId();
        },
        // A virtually focused parent keeps real focus on its input, so the trigger must stay out
        // of the tab order.
        get tabindex() {
          return parentVirtualFocus || !(open() || highlighted()) ? -1 : 0;
        },
        onFocus(event: FocusEvent) {
          // Close when focus returns through the submenu's guard to its trigger. Direct focus
          // from a submenu item, such as on hover, leaves the submenu open.
          if (store.select('open') && focusReturnedThroughGuard) {
            focusReturnedThroughGuard = false;
            store.setOpen(false, createChangeEventDetails(REASONS.focusOut, event));
          }
        },
        onBlur() {
          if (untrack(highlighted)) {
            parentMenuStore.setActiveIndex(null, REASONS.none);
          }
        },
      },
      elementProps,
      // `getItemProps` stays last so `useButton` keeps gating consumer handlers while disabled.
      getItemProps,
    ],
    ref: [listItem.ref, itemRef, registerTrigger, handleTriggerElementRef],
  });
}

/**
 * A menu item that opens a submenu.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export function MenuSubmenuTrigger(props: MenuSubmenuTrigger.Props) {
  const filterItem = useMenuFilterItem(props, 'submenu-trigger');

  return (
    <Show when={filterItem.visible()}>
      <MenuSubmenuTriggerPlain
        {...((filterItem.props
          ? reactiveMergeProps(filterItem.props as any, props)
          : props) as any)}
        ref={[props.ref, filterItem.ref] as any}
      />
    </Show>
  );
}

export interface MenuSubmenuTriggerState {
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Whether the item is highlighted.
   */
  highlighted: boolean;
  /**
   * Whether the menu is currently open.
   */
  open: boolean;
}

export interface MenuSubmenuTriggerProps
  extends NonNativeButtonProps, BaseUIComponentProps<'div', MenuSubmenuTriggerState> {
  onClick?: BaseUIComponentProps<'div', MenuSubmenuTriggerState>['onClick'] | undefined;
  /**
   * Overrides the text used for keyboard text navigation and filtering.
   * Falls back to the rendered text when not provided.
   */
  label?: string | undefined;
  /**
   * @ignore
   */
  id?: string | undefined;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * How long to wait before the menu may be opened on hover. Specified in milliseconds.
   *
   * Requires the `openOnHover` prop.
   * @default 100
   */
  delay?: number | undefined;
  /**
   * How long to wait before closing the menu that was opened on hover.
   * Specified in milliseconds.
   *
   * Requires the `openOnHover` prop.
   * @default 0
   */
  closeDelay?: number | undefined;
  /**
   * Whether the menu should also open when the trigger is hovered.
   * @default true
   */
  openOnHover?: boolean | undefined;
}

export namespace MenuSubmenuTrigger {
  export type Props = MenuSubmenuTriggerProps;
  export type State = MenuSubmenuTriggerState;
}
