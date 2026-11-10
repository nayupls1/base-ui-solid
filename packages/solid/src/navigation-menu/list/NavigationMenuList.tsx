import type { JSX } from '@solidjs/web';
import { createSignal, omit, onCleanup, Show, untrack } from 'solid-js';
import { EMPTY_OBJECT } from '@base-ui-solid/utils/empty';
import { closest, getTarget } from '@base-ui-solid/utils/shadowDom';
import { useDismiss } from '../../utils/popups/interactions/useDismiss';
import { useHoverPopupInteraction } from '../../utils/popups/interactions/useHoverPopupInteraction';
import type { BaseUIComponentProps, HTMLProps } from '../../internals/types';
import { CompositeRoot } from '../../internals/composite/root/CompositeRoot';
import {
  useNavigationMenuRootContext,
  useNavigationMenuTreeContext,
} from '../root/NavigationMenuRootContext';
import { NAVIGATION_MENU_TRIGGER_IDENTIFIER } from '../utils/constants';
import { NavigationMenuDismissContext } from './NavigationMenuDismissContext';
import type { FloatingRootStore } from '../../utils/popups/floating-root/FloatingRootStore';
import type { ElementProps } from '../../utils/popups/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { mergeProps } from '../../merge-props';
import { ownedProps } from '../../internals/ownedProps';

/**
 * Contains a list of navigation menu items.
 * Renders a `<ul>` element.
 *
 * Documentation: [Base UI Navigation Menu](https://base-ui.com/react/components/navigation-menu)
 */
export function NavigationMenuList(componentProps: NavigationMenuList.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'children', 'ref');

  const nodeId = useNavigationMenuTreeContext() ?? undefined;

  const root = useNavigationMenuRootContext();
  const nested = root.nested;

  const [dismissProps, setDismissProps] = createSignal<ElementProps | undefined>(undefined, {
    ownedWrite: true,
  });

  const dismissContext: Partial<ElementProps> = {
    get reference() {
      return dismissProps()?.reference;
    },
    get floating() {
      return dismissProps()?.floating;
    },
  };

  const state = (): NavigationMenuListState => ({
    open: root.open,
  });

  // `stopEventPropagation` won't stop the propagation if the end of the list is reached,
  // but we want to block it in this case.
  // When nested, skip this handler so arrow keys can reach the parent CompositeRoot.
  const defaultProps: HTMLProps = nested
    ? EMPTY_OBJECT
    : ({
        onKeyDown(event: KeyboardEvent) {
          const orientation = root.orientation;
          const shouldStop =
            (orientation === 'horizontal' &&
              (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) ||
            (orientation === 'vertical' && (event.key === 'ArrowUp' || event.key === 'ArrowDown'));

          if (shouldStop) {
            event.stopPropagation();
          }
        },
      } as any);

  const props = [
    (merged: Record<string, any>) => mergeProps(merged, dismissProps()?.floating ?? EMPTY_OBJECT),
    defaultProps,
    elementProps,
  ];

  // The interaction hooks are bound to the active trigger's floating root store, so they run in
  // a child that is recreated whenever that store changes.
  const interactions = (
    <Show when={root.floatingRootStore} keyed>
      {(store: FloatingRootStore) => (
        <ListInteractions store={store} nodeId={nodeId} setDismissProps={setDismissProps} />
      )}
    </Show>
  );

  if (nested) {
    // When nested, skip the CompositeRoot wrapper so that triggers can participate
    // in the parent Content's composite navigation context. The key propagation
    // guard is already omitted through `defaultProps` above.
    return (
      <NavigationMenuDismissContext value={dismissContext}>
        {interactions}
        {untrack(() =>
          useRenderElement('ul', componentProps, {
            state,
            props: props as any,
          }),
        )}
      </NavigationMenuDismissContext>
    );
  }

  return (
    <NavigationMenuDismissContext value={dismissContext}>
      {interactions}
      <CompositeRoot
        render={componentProps.render as any}
        class={componentProps.class as any}
        style={componentProps.style as any}
        state={state()}
        refs={[componentProps.ref as any]}
        props={props as any}
        loopFocus={false}
        orientation={root.orientation}
        tag="ul"
      >
        {componentProps.children}
      </CompositeRoot>
    </NavigationMenuDismissContext>
  );
}

function ListInteractions(props: {
  store: FloatingRootStore;
  nodeId: string | undefined;
  setDismissProps: (value: ElementProps | undefined) => void;
}): JSX.Element {
  const root = useNavigationMenuRootContext();
  const store = untrack(() => props.store);

  const interactionsEnabled = () => root.positionerElement != null || root.value == null;
  const hoverInteractionsEnabled = () =>
    root.positionerElement != null || root.viewportElement != null || root.value == null;

  useHoverPopupInteraction(store as any, {
    get enabled() {
      return hoverInteractionsEnabled();
    },
    closeDelay: () => root.closeDelay,
    nodeId: untrack(() => props.nodeId),
  });

  const dismiss = useDismiss(
    store as any,
    {
      get enabled() {
        return interactionsEnabled();
      },
      outsidePressEvent: 'intentional',
      outsidePress(event: Event) {
        const target = getTarget(event) as HTMLElement | null;
        const closestNavigationMenuTrigger = closest(
          target,
          `[${NAVIGATION_MENU_TRIGGER_IDENTIFIER}]`,
        );
        return closestNavigationMenuTrigger === null;
      },
    } as any,
  );

  untrack(() => props.setDismissProps)(dismiss);
  onCleanup(() => {
    props.setDismissProps(undefined);
  });

  return null;
}

export interface NavigationMenuListState {
  /**
   * If `true`, the popup is open.
   */
  open: boolean;
}

export interface NavigationMenuListProps extends BaseUIComponentProps<
  'ul',
  NavigationMenuListState
> {}

export namespace NavigationMenuList {
  export type State = NavigationMenuListState;
  export type Props = NavigationMenuListProps;
}
