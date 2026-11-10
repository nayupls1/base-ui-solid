import type { JSX } from '@solidjs/web';
import { createEffect, createMemo, createSignal, omit } from 'solid-js';
import {
  FloatingNode,
  FloatingTree,
  useFloatingNodeId,
  useFloatingTree,
} from '../utils/popups/tree/FloatingTree';
import type { MenuRoot } from '../menu/root/MenuRoot';
import type { BaseUIComponentProps } from '../internals/types';
import { MenubarContext, useMenubarContext } from './MenubarContext';
import { CompositeRoot } from '../internals/composite/root/CompositeRoot';
import { useBaseUiId } from '../internals/useBaseUiId';
import type { MenuOpenEventDetails } from '../menu/utils/types';
import type { StateAttributesMapping } from '../internals/getStateAttributesProps';
import * as MenubarDataAttributes from './MenubarDataAttributes';
import { REASONS } from '../internals/reasons';
import { ownedProps } from '../internals/ownedProps';

const menubarStateAttributesMapping: StateAttributesMapping<MenubarState> = {
  hasSubmenuOpen(value) {
    return value ? { [MenubarDataAttributes.hasSubmenuOpen]: '' } : null;
  },
};

/**
 * The container for menus.
 *
 * Documentation: [Base UI Menubar](https://base-ui.com/react/components/menubar)
 */
export function Menubar(props: Menubar.Props) {
  props = ownedProps(props);
  const elementProps = omit(
    props,
    'orientation',
    'loopFocus',
    'render',
    'class',
    'modal',
    'disabled',
    'id',
    'style',
    'children',
    'ref',
  );
  const orientation = () => props.orientation ?? 'horizontal';
  const modal = () => props.modal ?? true;

  const [contentElement, setContentElement] = createSignal<HTMLElement | null>(null, {
    ownedWrite: true,
  });
  const [hasSubmenuOpen, setHasSubmenuOpen] = createSignal(false, { ownedWrite: true });

  const id = useBaseUiId(() => props.id);

  const state = createMemo<MenubarState>(() => ({
    orientation: orientation(),
    modal: modal(),
    hasSubmenuOpen: hasSubmenuOpen(),
  }));

  const context: MenubarContext = {
    get contentElement() {
      return contentElement();
    },
    setContentElement,
    setHasSubmenuOpen,
    get hasSubmenuOpen() {
      return hasSubmenuOpen();
    },
    get modal() {
      return modal();
    },
    get disabled() {
      return props.disabled ?? false;
    },
    get orientation() {
      return orientation();
    },
    allowMouseUpTriggerRef: { current: false },
    get rootId() {
      return id();
    },
  };

  return (
    <MenubarContext value={context}>
      <FloatingTree>
        <MenubarContent>
          <CompositeRoot
            render={props.render as any}
            class={props.class as any}
            style={props.style as any}
            state={state()}
            stateAttributesMapping={menubarStateAttributesMapping as any}
            refs={[props.ref as any, setContentElement]}
            props={[
              {
                role: 'menubar',
                get id() {
                  return id();
                },
                get 'aria-orientation'() {
                  return orientation();
                },
              },
              elementProps,
            ]}
            orientation={orientation()}
            loopFocus={props.loopFocus ?? true}
            enableHomeAndEndKeys
            highlightItemOnHover={hasSubmenuOpen()}
          >
            {props.children}
          </CompositeRoot>
        </MenubarContent>
      </FloatingTree>
    </MenubarContext>
  );
}

function MenubarContent(props: { children?: JSX.Element }) {
  const nodeId = useFloatingNodeId();
  const { events: menuEvents } = useFloatingTree()!;
  const rootContext = useMenubarContext();

  createEffect(
    () => 0,
    () => {
      function onSubmenuOpenChange(details: MenuOpenEventDetails) {
        if (!details.nodeId || details.parentNodeId !== nodeId) {
          return;
        }

        if (details.open) {
          if (!rootContext.hasSubmenuOpen) {
            rootContext.setHasSubmenuOpen(true);
          }
        } else if (
          details.reason !== REASONS.siblingOpen &&
          details.reason !== REASONS.listNavigation
        ) {
          rootContext.setHasSubmenuOpen(false);
        }
      }

      menuEvents.on('menuopenchange', onSubmenuOpenChange);

      return () => {
        menuEvents.off('menuopenchange', onSubmenuOpenChange);
      };
    },
  );

  return <FloatingNode id={nodeId}>{props.children}</FloatingNode>;
}

export interface MenubarState {
  /**
   * The orientation of the menubar.
   */
  orientation: MenuRoot.Orientation;
  /**
   * Whether the menubar is modal.
   */
  modal: boolean;
  /**
   * Whether any submenu within the menubar is open.
   */
  hasSubmenuOpen: boolean;
}

export interface MenubarProps extends BaseUIComponentProps<'div', MenubarState> {
  /**
   * Whether the menubar is modal.
   * @default true
   */
  modal?: boolean | undefined;
  /**
   * Whether the whole menubar is disabled.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * The orientation of the menubar.
   * @default 'horizontal'
   */
  orientation?: MenuRoot.Orientation | undefined;
  /**
   * Whether to loop keyboard focus back to the first item
   * when the end of the list is reached while using the arrow keys.
   * @default true
   */
  loopFocus?: boolean | undefined;
}

export namespace Menubar {
  export type State = MenubarState;
  export type Props = MenubarProps;
}
