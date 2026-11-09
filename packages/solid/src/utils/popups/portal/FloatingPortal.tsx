import { createContext, createMemo, createEffect, omit, Show, untrack, useContext } from 'solid-js';
import { Portal, type JSX } from '@solidjs/web';
import { isNode } from '@floating-ui/utils/dom';
import { addEventListener } from '@base-ui-solid/utils/addEventListener';
import { mergeCleanups } from '@base-ui-solid/utils/mergeCleanups';
import { useId } from '@base-ui-solid/utils/useId';
import { createSyncSignal } from '@base-ui-solid/utils/createSyncSignal';
import type { RefObject } from '@base-ui-solid/utils/types';
import { FocusGuard } from '../focus/FocusGuard';
import {
  enableFocusInside,
  disableFocusInside,
  getPreviousTabbable,
  getNextTabbable,
  isOutsideEvent,
} from '../focus/tabbable';
import { createChangeEventDetails } from '../../../internals/createBaseUIEventDetails';
import { REASONS } from '../../../internals/reasons';
import { createAttribute } from '../createAttribute';
import { useRenderElement, type RefInput } from '../../../internals/useRenderElement';
import { ownerVisuallyHidden } from '../../../internals/constants';
import type { BaseUIComponentProps } from '../../../internals/types';
import { ownedProps } from '../../../internals/ownedProps';

type FocusManagerState = null | {
  modal: boolean;
  open: boolean;
  onOpenChange(
    open: boolean,
    data?: { reason?: string | undefined; event?: Event | undefined },
  ): void;
  domReference: Element | null;
  closeOnFocusOut: boolean;
};

export interface PortalContextValue {
  /** Reactive (getter). */
  readonly portalNode: HTMLElement | null;
  setFocusManagerState: (value: FocusManagerState) => void;
  beforeInsideRef: RefObject<HTMLSpanElement | null>;
  afterInsideRef: RefObject<HTMLSpanElement | null>;
  beforeOutsideRef: RefObject<HTMLSpanElement | null>;
  afterOutsideRef: RefObject<HTMLSpanElement | null>;
}

const PortalContext = createContext<PortalContextValue | null>(null);

export const usePortalContext = () => useContext(PortalContext);

const attr = createAttribute('portal');

export type PortalContainer =
  | HTMLElement
  | ShadowRoot
  | null
  | RefObject<HTMLElement | ShadowRoot | null>
  | (() => HTMLElement | ShadowRoot | null | undefined);

export interface UseFloatingPortalNodeProps {
  container?: PortalContainer | undefined;
  componentProps?: Record<string, any> | undefined;
  elementProps?: Record<string, any> | undefined;
  children?: () => JSX.Element;
}

/**
 * Resolves the container and renders the portal node into it. Props are read lazily, so they can
 * be getters.
 */
export function useFloatingPortalNode(props: UseFloatingPortalNodeProps) {
  const uniqueId = useId();
  const portalContext = usePortalContext();

  const [portalNode, setPortalNode] = createSyncSignal<HTMLElement | null>(null);

  const containerElement = createMemo<HTMLElement | ShadowRoot | null>(() => {
    const containerProp = props.container;
    if (containerProp === null) {
      return null;
    }
    let resolved: HTMLElement | ShadowRoot | null | undefined;
    if (containerProp) {
      if (typeof containerProp === 'function') {
        resolved = containerProp();
      } else if (isNode(containerProp)) {
        resolved = containerProp as HTMLElement | ShadowRoot;
      } else {
        resolved = (containerProp as RefObject<HTMLElement | ShadowRoot | null>).current;
      }
    }
    return resolved ?? portalContext?.portalNode ?? (typeof document !== 'undefined' ? document.body : null);
  });

  const subtree = () => (
    <Show when={containerElement()}>
      {(container) => (
        <Portal mount={container() as HTMLElement}>
          {untrack(() =>
            useRenderElement('div', props.componentProps ?? {}, {
              ref: [
                (node: HTMLElement | null) => {
                  setPortalNode(node);
                },
                props.componentProps?.ref,
              ],
              props: [
                {
                  id: uniqueId,
                  [attr]: '',
                },
                props.elementProps,
              ],
              children: () => props.children?.(),
            }),
          )}
        </Portal>
      )}
    </Show>
  );

  return {
    node: portalNode,
    nodeId: uniqueId,
    subtree,
  };
}

/**
 * Portals the floating element into a given container element — by default,
 * outside of the app root and into the body.
 * This is necessary to ensure the floating element can appear outside any
 * potential parent containers that cause clipping (such as `overflow: hidden`),
 * while retaining its location in the component tree.
 * @see https://floating-ui.com/docs/FloatingPortal
 * @internal
 */
export function FloatingPortal(componentProps: FloatingPortal.Props<any>) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'style',
    'children',
    'container',
    'portalOwnerRole',
    'ref',
  );

  const beforeOutsideRef: RefObject<HTMLSpanElement | null> = { current: null };
  const afterOutsideRef: RefObject<HTMLSpanElement | null> = { current: null };
  const beforeInsideRef: RefObject<HTMLSpanElement | null> = { current: null };
  const afterInsideRef: RefObject<HTMLSpanElement | null> = { current: null };

  const [focusManagerState, setFocusManagerState] = createSyncSignal<FocusManagerState>(null);
  let focusInsideDisabled = false;

  const portal = useFloatingPortalNode({
    get container() {
      return componentProps.container;
    },
    componentProps: {
      get render() {
        return componentProps.render;
      },
      get class() {
        return componentProps.class;
      },
      get style() {
        return componentProps.style;
      },
      get ref() {
        return componentProps.ref;
      },
    },
    elementProps,
    children: () => componentProps.children,
  });

  const portalNode = portal.node;

  const modal = () => focusManagerState()?.modal;
  const open = () => focusManagerState()?.open;

  const shouldRenderGuards = () => {
    const state = focusManagerState();
    return !!state && !state.modal && state.open && !!portalNode();
  };

  createEffect(
    () => [portalNode(), modal()] as const,
    ([node, isModal]) => {
      if (!node || isModal) {
        return undefined;
      }

      // Make sure elements inside the portal element are tabbable only when the
      // portal has already been focused, either by tabbing into a focus trap
      // element outside or using the mouse.
      function onFocus(event: FocusEvent) {
        if (node && event.relatedTarget && isOutsideEvent(event)) {
          if (event.type === 'focusin') {
            if (focusInsideDisabled) {
              enableFocusInside(node);
              focusInsideDisabled = false;
            }
          } else {
            disableFocusInside(node);
            focusInsideDisabled = true;
          }
        }
      }

      return mergeCleanups(
        addEventListener(node, 'focusin', onFocus, true),
        addEventListener(node, 'focusout', onFocus, true),
      );
    },
  );

  createEffect(
    () => [open(), portalNode()] as const,
    ([isOpen, node]) => {
      if (!node || isOpen !== true || !focusInsideDisabled) {
        return;
      }

      enableFocusInside(node);
      focusInsideDisabled = false;
    },
  );

  const portalContextValue: PortalContextValue = {
    beforeOutsideRef,
    afterOutsideRef,
    beforeInsideRef,
    afterInsideRef,
    get portalNode() {
      return portalNode();
    },
    setFocusManagerState: (value) => {
      setFocusManagerState(value);
    },
  };

  return (
    <PortalContext value={portalContextValue}>
      <Show when={shouldRenderGuards()}>
        <FocusGuard
          data-type="outside"
          ref={(el: HTMLSpanElement) => {
            beforeOutsideRef.current = el;
          }}
          onFocus={(event: FocusEvent) => {
            const node = portalNode();
            if (node && isOutsideEvent(event, node)) {
              beforeInsideRef.current?.focus();
            } else {
              const state = focusManagerState();
              const domReference = state ? state.domReference : null;
              const prevTabbable = getPreviousTabbable(domReference);
              prevTabbable?.focus();
            }
          }}
        />
        <span
          role={componentProps.portalOwnerRole}
          aria-owns={portal.nodeId}
          style={ownerVisuallyHidden}
        />
      </Show>
      {untrack(portal.subtree)}
      <Show when={shouldRenderGuards()}>
        <FocusGuard
          data-type="outside"
          ref={(el: HTMLSpanElement) => {
            afterOutsideRef.current = el;
          }}
          onFocus={(event: FocusEvent) => {
            const node = portalNode();
            if (node && isOutsideEvent(event, node)) {
              afterInsideRef.current?.focus();
            } else {
              const state = focusManagerState();
              const domReference = state ? state.domReference : null;
              const nextTabbable = getNextTabbable(domReference);
              nextTabbable?.focus();

              if (state?.closeOnFocusOut) {
                state?.onOpenChange(false, createChangeEventDetails(REASONS.focusOut, event));
              }
            }
          }}
        />
      </Show>
    </PortalContext>
  );
}

export interface FloatingPortalState {}

export namespace FloatingPortal {
  export type State = FloatingPortalState;
  export interface Props<TState> extends BaseUIComponentProps<'div', TState> {
    /**
     * A parent element to render the portal element into.
     */
    container?: PortalContainer | undefined;
    /**
     * @ignore
     * The role for the hidden `aria-owns` owner element.
     */
    portalOwnerRole?: string | undefined;
    ref?: RefInput<HTMLDivElement> | undefined;
  }
}
