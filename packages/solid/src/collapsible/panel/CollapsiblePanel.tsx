import { createEffect, createMemo, omit } from 'solid-js';
import { warn } from 'base-ui-solidjs-utils/warn';
import type { BaseUIComponentProps } from '../../internals/types';
import { resolveStyle } from '../../utils/resolveStyle';
import { useRenderElement } from '../../internals/useRenderElement';
import { useCollapsibleRootContext } from '../root/CollapsibleRootContext';
import type { CollapsibleRootState } from '../root/CollapsibleRoot';
import { collapsibleStateAttributesMapping } from '../root/stateAttributesMapping';
import { useCollapsiblePanel } from './useCollapsiblePanel';
import * as CollapsiblePanelCssVars from './CollapsiblePanelCssVars';
import type { TransitionStatus } from '../../internals/useTransitionStatus';
import { ownedProps } from '../../internals/ownedProps';

/**
 * A panel with the collapsible contents.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Collapsible](https://base-ui.com/react/components/collapsible)
 */
export function CollapsiblePanel(componentProps: CollapsiblePanel.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(
    componentProps,
    'class',
    'hiddenUntilFound',
    'keepMounted',
    'render',
    'id',
    'style',
    'children',
    'ref',
  );

  if (process.env.NODE_ENV !== 'production') {
    createEffect(
      () => [componentProps.hiddenUntilFound, componentProps.keepMounted] as const,
      ([hiddenUntilFound, keepMounted]) => {
        if (hiddenUntilFound && keepMounted === false) {
          warn(
            'The `keepMounted={false}` prop on `Collapsible.Panel` is ignored when `hiddenUntilFound` is enabled, since the panel must remain mounted while closed.',
          );
        }
      },
    );
  }

  const context = useCollapsibleRootContext();

  const registeredId = () => componentProps.id || undefined;
  const id = () => registeredId() ?? context.defaultPanelId();

  createEffect(registeredId, (currentRegisteredId) => {
    context.setPanelIdState((currentId) =>
      currentRegisteredId ?? (currentId === null ? undefined : currentId),
    );
    return () => {
      context.setPanelIdState((currentId) =>
        currentId === currentRegisteredId ? null : currentId,
      );
    };
  });

  const panel = useCollapsiblePanel({
    get externalRef() {
      return componentProps.ref;
    },
    get hiddenUntilFound() {
      return componentProps.hiddenUntilFound ?? false;
    },
    get id() {
      return id();
    },
    get keepMounted() {
      return componentProps.keepMounted ?? false;
    },
    get mounted() {
      return context.mounted();
    },
    onOpenChange: context.onOpenChange,
    get open() {
      return context.open();
    },
    setMounted: context.setMounted,
    setOpen: context.setOpen,
    get transitionStatus() {
      return context.transitionStatus();
    },
  });

  const panelState = createMemo<CollapsiblePanelState>(() => ({
    ...context.state(),
    transitionStatus: panel.transitionStatus(),
  }));

  return useRenderElement(
    'div',
    {
      get class() {
        return componentProps.class;
      },
      get render() {
        return componentProps.render;
      },
      get children() {
        return componentProps.children;
      },
    },
    {
      enabled: panel.shouldRender,
      state: panelState,
      ref: panel.ref,
      props: [
        panel.props,
        {
          get style() {
            const height = panel.height();
            const width = panel.width();
            return {
              [CollapsiblePanelCssVars.collapsiblePanelHeight]:
                height === undefined ? 'auto' : `${height}px`,
              [CollapsiblePanelCssVars.collapsiblePanelWidth]:
                width === undefined ? 'auto' : `${width}px`,
            };
          },
        },
        elementProps,
        {
          get style() {
            return resolveStyle(componentProps.style, panelState());
          },
        },
        {
          get style() {
            return panel.shouldPreventOpenAnimation() ? { 'animation-name': 'none' } : undefined;
          },
        },
      ],
      stateAttributesMapping: collapsibleStateAttributesMapping,
    },
  );
}

export interface CollapsiblePanelState extends CollapsibleRootState {
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export interface CollapsiblePanelProps extends BaseUIComponentProps<'div', CollapsiblePanelState> {
  /**
   * Allows the browser's built-in page search to find and expand the panel contents.
   *
   * Overrides the `keepMounted` prop and uses `hidden="until-found"`
   * to hide the element without removing it from the DOM.
   *
   * @default false
   */
  hiddenUntilFound?: boolean | undefined;
  /**
   * Whether to keep the element in the DOM while the panel is hidden.
   * This prop is ignored when `hiddenUntilFound` is used.
   * @default false
   */
  keepMounted?: boolean | undefined;
}

export namespace CollapsiblePanel {
  export type State = CollapsiblePanelState;
  export type Props = CollapsiblePanelProps;
}
