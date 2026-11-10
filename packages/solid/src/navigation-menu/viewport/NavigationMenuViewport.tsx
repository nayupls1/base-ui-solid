import type { JSX } from '@solidjs/web';
import { createEffect, createMemo, omit, Show, untrack } from 'solid-js';
import { inertValue } from '@base-ui-solid/utils/inertValue';
import { contains } from '@base-ui-solid/utils/shadowDom';
import type { BaseUIComponentProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useNavigationMenuRootContext } from '../root/NavigationMenuRootContext';
import { FocusGuard } from '../../utils/popups/focus/FocusGuard';
import {
  getNextTabbable,
  getPreviousTabbable,
  isOutsideEvent,
} from '../../utils/popups/focus/tabbable';
import { getEmptyRootStore } from '../../utils/popups/floating-root/getEmptyRootStore';
import { useNavigationMenuPositionerContext } from '../positioner/NavigationMenuPositionerContext';
import { useBaseUiId } from '../../internals/useBaseUiId';
import { ownedProps } from '../../internals/ownedProps';

const EMPTY_ROOT_STORE = getEmptyRootStore();

function Guards(props: { children: JSX.Element }) {
  const root = useNavigationMenuRootContext();
  const hasPositioner = Boolean(useNavigationMenuPositionerContext(true));

  const referenceElement = () => root.positionerElement || root.viewportElement;

  return (
    <Show when={root.floatingRootStore || hasPositioner} fallback={props.children}>
      <FocusGuard
        ref={(el: HTMLSpanElement) => {
          root.beforeInsideRef.current = el;
        }}
        onFocus={(event: FocusEvent) => {
          const reference = referenceElement();
          if (reference && isOutsideEvent(event, reference)) {
            getNextTabbable(reference)?.focus();
          } else {
            root.beforeOutsideRef.current?.focus();
          }
        }}
      />
      {props.children}
      <FocusGuard
        ref={(el: HTMLSpanElement) => {
          root.afterInsideRef.current = el;
        }}
        onFocus={(event: FocusEvent) => {
          const reference = referenceElement();
          if (reference && isOutsideEvent(event, reference)) {
            getPreviousTabbable(reference)?.focus();
          } else {
            root.afterOutsideRef.current?.focus();
          }
        }}
      />
    </Show>
  );
}

/**
 * The clipping viewport of the navigation menu's current content.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Navigation Menu](https://base-ui.com/react/components/navigation-menu)
 */
export function NavigationMenuViewport(componentProps: NavigationMenuViewport.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'children', 'id', 'ref');

  const id = useBaseUiId(() => componentProps.id as string | undefined);

  const root = useNavigationMenuRootContext();

  const positioning = useNavigationMenuPositionerContext(true);
  const hasPositioner = Boolean(positioning);
  const domReference = createMemo(() =>
    (root.floatingRootStore || EMPTY_ROOT_STORE).get('anchorElement'),
  );

  createEffect(domReference, (reference) => {
    if (reference) {
      root.prevTriggerElementRef.current = reference;
    }
  });

  const children = () =>
    hasPositioner ? (
      componentProps.children
    ) : (
      <Guards>
        <div ref={(el: HTMLDivElement) => root.setViewportTargetElement(el)}>
          {componentProps.children}
        </div>
      </Guards>
    );

  const element = () =>
    useRenderElement('div', componentProps, {
      ref: (el: HTMLElement | null) => root.setViewportElement(el),
      props: [
        {
          get id() {
            return id();
          },
          onBlur(event: FocusEvent) {
            const relatedTarget = event.relatedTarget as Element | null;
            const currentTarget = event.currentTarget as Element;

            // If focus is leaving the viewport and not going to the trigger, make it inert
            // to prevent a focus loop.
            if (
              relatedTarget &&
              !contains(currentTarget, relatedTarget) &&
              relatedTarget !== domReference()
            ) {
              root.setViewportInert(true);
            }
          },
          get inert() {
            return !hasPositioner && root.viewportInert ? inertValue(true) : undefined;
          },
        },
        elementProps,
      ],
      children,
    });

  return hasPositioner ? <Guards>{untrack(element)}</Guards> : untrack(element);
}

export interface NavigationMenuViewportState {}

export interface NavigationMenuViewportProps extends BaseUIComponentProps<
  'div',
  NavigationMenuViewportState
> {}

export namespace NavigationMenuViewport {
  export type State = NavigationMenuViewportState;
  export type Props = NavigationMenuViewportProps;
}
