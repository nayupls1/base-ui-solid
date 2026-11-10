import { createEffect, createMemo, createSignal, Match, omit, Switch, untrack } from 'solid-js';
import { Portal } from '@solidjs/web';
import { inertValue } from 'base-ui-solidjs-utils/inertValue';
import { EMPTY_OBJECT } from 'base-ui-solidjs-utils/empty';
import { contains, getTarget } from 'base-ui-solidjs-utils/shadowDom';
import { FloatingNode } from '../../utils/popups/tree/FloatingTree';
import type { BaseUIComponentProps, HTMLProps } from '../../internals/types';
import {
  useNavigationMenuRootContext,
  useNavigationMenuTreeContext,
} from '../root/NavigationMenuRootContext';
import { useNavigationMenuItemContext } from '../item/NavigationMenuItemContext';
import type { TransitionStatus } from '../../internals/useTransitionStatus';
import { useTransitionStatus } from '../../internals/useTransitionStatus';
import { useOpenChangeComplete } from '../../internals/useOpenChangeComplete';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import { CompositeRoot } from '../../internals/composite/root/CompositeRoot';
import { popupTransitionStateMapping } from '../../utils/popups/popupStateMapping';
import * as NavigationMenuContentDataAttributes from './NavigationMenuContentDataAttributes';
import { ownedProps } from '../../internals/ownedProps';

const stateAttributesMapping: StateAttributesMapping<NavigationMenuContentState> = {
  ...popupTransitionStateMapping,
  activationDirection(value) {
    if (!value) {
      return null;
    }
    return {
      [NavigationMenuContentDataAttributes.activationDirection]: value,
    };
  },
};

/**
 * A container for the content of the navigation menu item that is moved into the popup
 * when the item is active.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Navigation Menu](https://base-ui.com/react/components/navigation-menu)
 */
export function NavigationMenuContent(componentProps: NavigationMenuContent.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'style',
    'keepMounted',
    'children',
    'ref',
  );

  const keepMounted = () => componentProps.keepMounted ?? false;

  const root = useNavigationMenuRootContext();
  const { currentContentRef } = root;
  const item = useNavigationMenuItemContext();
  const nodeId = useNavigationMenuTreeContext() ?? undefined;

  const open = createMemo(() => root.mounted && root.value === item.value);

  let element: HTMLDivElement | null = null;

  const [hasMountedInPortal, setHasMountedInPortal] = createSignal(false, { ownedWrite: true });
  const [focusInside, setFocusInside] = createSignal(false, { ownedWrite: true });

  const { mounted, setMounted, transitionStatus } = useTransitionStatus(open);

  // If the popup unmounts before the content's exit animation completes, reset the internal
  // mounted state so the next open can re-enter via `transitionStatus="starting"`.
  createEffect(
    () => [mounted(), root.mounted] as const,
    ([isMounted, popupMounted]) => {
      if (isMounted && !popupMounted) {
        setMounted(false);
      }
    },
  );

  useOpenChangeComplete({
    ref: () => element,
    get open() {
      return open();
    },
    onComplete() {
      if (!untrack(open)) {
        setMounted(false);
      }
    },
  });

  // When a content re-enters while still mounted (e.g. switching top-level triggers
  // back before the exit animation completes), the DOM element hasn't changed so the
  // ref won't fire again. Ensure the shared ref is updated so the
  // MutationObserver in the trigger watches the correct content element.
  createEffect(open, (isOpen) => {
    if (isOpen && element) {
      currentContentRef.current = element;
    }
  });

  const state = createMemo<NavigationMenuContentState>(() => ({
    open: open(),
    transitionStatus: transitionStatus(),
    activationDirection: root.activationDirection,
  }));

  const handleCurrentContentRef = (node: HTMLDivElement | null) => {
    element = node;
    // Inactive `keepMounted` content also mounts in the viewport; only the
    // active content can own the shared sizing observer target.
    if (node && untrack(open)) {
      currentContentRef.current = node;
    }
  };

  const commonProps = {
    onFocus(event: FocusEvent) {
      const target = getTarget(event) as Element | null;
      if (target?.hasAttribute('data-base-ui-focus-guard')) {
        return;
      }
      setFocusInside(true);
    },
    onBlur(event: FocusEvent) {
      if (!contains(event.currentTarget as Element, event.relatedTarget as Element | null)) {
        setFocusInside(false);
      }
    },
  };

  const defaultProps: HTMLProps = {
    ...commonProps,
    get style() {
      return !open() && mounted() ? { position: 'absolute', top: 0, left: 0 } : undefined;
    },
    get inert() {
      return !open() && mounted() ? inertValue(!focusInside()) : undefined;
    },
  } as any;

  const portalContainer = () => root.viewportTargetElement || root.viewportElement;
  const hidden = () => keepMounted() && !mounted();
  const shouldRenderInline = () => keepMounted() && !portalContainer() && !hasMountedInPortal();

  createEffect(
    () => keepMounted() && portalContainer() != null,
    (shouldMark) => {
      if (shouldMark && !untrack(hasMountedInPortal)) {
        setHasMountedInPortal(true);
      }
    },
  );

  return (
    <Switch>
      <Match when={shouldRenderInline()}>
        <CompositeRoot
          render={componentProps.render as any}
          class={componentProps.class as any}
          style={componentProps.style as any}
          state={state()}
          refs={[componentProps.ref as any]}
          props={[defaultProps, { hidden: true }, elementProps] as any}
          stateAttributesMapping={stateAttributesMapping as any}
        >
          {componentProps.children}
        </CompositeRoot>
      </Match>
      <Match when={portalContainer() != null && (mounted() || keepMounted())}>
        <Portal mount={portalContainer()!}>
          <FloatingNode id={nodeId}>
            <CompositeRoot
              render={componentProps.render as any}
              class={componentProps.class as any}
              style={componentProps.style as any}
              state={state()}
              refs={[componentProps.ref as any, handleCurrentContentRef] as any}
              props={
                [
                  defaultProps,
                  {
                    get hidden() {
                      return hidden() ? true : undefined;
                    },
                  },
                  elementProps,
                ] as any
              }
              stateAttributesMapping={stateAttributesMapping as any}
            >
              {componentProps.children}
            </CompositeRoot>
          </FloatingNode>
        </Portal>
      </Match>
    </Switch>
  );
}

export interface NavigationMenuContentState {
  /**
   * If `true`, the component is open.
   */
  open: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
  /**
   * The direction of the activation.
   */
  activationDirection: 'left' | 'right' | 'up' | 'down' | null;
}

export interface NavigationMenuContentProps extends BaseUIComponentProps<
  'div',
  NavigationMenuContentState
> {
  /**
   * Whether to keep the content mounted in the DOM while the popup is closed.
   * Ensures the content is present during server-side rendering for web crawlers.
   * @default false
   */
  keepMounted?: boolean | undefined;
}

export namespace NavigationMenuContent {
  export type State = NavigationMenuContentState;
  export type Props = NavigationMenuContentProps;
}
