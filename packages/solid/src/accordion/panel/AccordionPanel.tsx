import { createEffect, createMemo, omit } from 'solid-js';
import { warn } from 'base-ui-solidjs-utils/warn';
import type { BaseUIComponentProps } from '../../internals/types';
import { resolveStyle } from '../../utils/resolveStyle';
import { useCollapsibleRootContext } from '../../collapsible/root/CollapsibleRootContext';
import { useCollapsiblePanel } from '../../collapsible/panel/useCollapsiblePanel';
import { useAccordionRootContext } from '../root/AccordionRootContext';
import type { AccordionRoot } from '../root/AccordionRoot';
import type { AccordionItemState } from '../item/AccordionItem';
import { useAccordionItemContext } from '../item/AccordionItemContext';
import { accordionStateAttributesMapping } from '../item/stateAttributesMapping';
import * as AccordionPanelCssVars from './AccordionPanelCssVars';
import { useRenderElement } from '../../internals/useRenderElement';
import type { TransitionStatus } from '../../internals/useTransitionStatus';
import { ownedProps } from '../../internals/ownedProps';

/**
 * A collapsible panel with the accordion item contents.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Accordion](https://base-ui.com/react/components/accordion)
 */
export function AccordionPanel(componentProps: AccordionPanel.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(
    componentProps,
    'class',
    'hiddenUntilFound',
    'keepMounted',
    'id',
    'render',
    'style',
    'children',
    'ref',
  );

  const rootContext = useAccordionRootContext();
  const collapsible = useCollapsibleRootContext();

  const hiddenUntilFound = () => componentProps.hiddenUntilFound ?? rootContext.hiddenUntilFound();
  const keepMounted = () => componentProps.keepMounted ?? rootContext.keepMounted();
  const registeredId = () => componentProps.id || undefined;
  const id = () => componentProps.id ?? collapsible.defaultPanelId();

  if (process.env.NODE_ENV !== 'production') {
    createEffect(
      () => [hiddenUntilFound(), componentProps.keepMounted] as const,
      ([isHiddenUntilFound, keepMountedProp]) => {
        if (keepMountedProp === false && isHiddenUntilFound) {
          warn(
            'The `keepMounted={false}` prop on an `Accordion.Panel` is ignored when `hiddenUntilFound` is enabled on the panel or root, since the panel must remain mounted while closed.',
          );
        }
      },
    );
  }

  createEffect(registeredId, (currentRegisteredId) => {
    collapsible.setPanelIdState((currentId) =>
      currentRegisteredId ?? (currentId === null ? undefined : currentId),
    );
    return () => {
      collapsible.setPanelIdState((currentId) =>
        currentId === currentRegisteredId ? null : currentId,
      );
    };
  });

  const panel = useCollapsiblePanel({
    get externalRef() {
      return componentProps.ref;
    },
    get hiddenUntilFound() {
      return hiddenUntilFound();
    },
    get id() {
      return id();
    },
    get keepMounted() {
      return keepMounted();
    },
    get mounted() {
      return collapsible.mounted();
    },
    onOpenChange: collapsible.onOpenChange,
    get open() {
      return collapsible.open();
    },
    setMounted: collapsible.setMounted,
    setOpen: collapsible.setOpen,
    get transitionStatus() {
      return collapsible.transitionStatus();
    },
  });

  const itemContext = useAccordionItemContext();

  const panelState = createMemo<AccordionPanelState>(() => ({
    ...itemContext.state(),
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
          get 'aria-labelledby'() {
            return itemContext.triggerId();
          },
          role: 'region',
          get style() {
            const height = panel.height();
            const width = panel.width();
            return {
              [AccordionPanelCssVars.accordionPanelHeight]:
                height === undefined ? 'auto' : `${height}px`,
              [AccordionPanelCssVars.accordionPanelWidth]:
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
      stateAttributesMapping: accordionStateAttributesMapping,
    },
  );
}

export interface AccordionPanelState extends AccordionItemState {
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export interface AccordionPanelProps
  extends
    BaseUIComponentProps<'div', AccordionPanelState>,
    Pick<AccordionRoot.Props, 'hiddenUntilFound' | 'keepMounted'> {}

export namespace AccordionPanel {
  export type State = AccordionPanelState;
  export type Props = AccordionPanelProps;
}
