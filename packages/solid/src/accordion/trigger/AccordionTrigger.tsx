import { createEffect, omit } from 'solid-js';
import { triggerOpenStateMapping } from '../../utils/collapsibleOpenStateMapping';
import type { BaseUIComponentProps, NativeButtonProps } from '../../internals/types';
import { useButton } from '../../internals/use-button';
import { useCollapsibleRootContext } from '../../collapsible/root/CollapsibleRootContext';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import type { AccordionItemState } from '../item/AccordionItem';
import { useAccordionItemContext } from '../item/AccordionItemContext';
import { accordionStateAttributesMapping } from '../item/stateAttributesMapping';
import { useRenderElement } from '../../internals/useRenderElement';

const stateAttributesMapping: StateAttributesMapping<AccordionItemState> = {
  ...accordionStateAttributesMapping,
  ...triggerOpenStateMapping,
};

/**
 * A button that opens and closes the corresponding panel.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Accordion](https://base-ui.com/react/components/accordion)
 */
export function AccordionTrigger(componentProps: AccordionTrigger.Props) {
  const elementProps = omit(
    componentProps,
    'disabled',
    'class',
    'id',
    'render',
    'nativeButton',
    'style',
    'children',
    'ref',
  );

  const collapsibleContext = useCollapsibleRootContext();

  const disabled = () => componentProps.disabled || collapsibleContext.disabled();

  const { getButtonProps, buttonRef } = useButton({
    get disabled() {
      return disabled();
    },
    get native() {
      return componentProps.nativeButton ?? true;
    },
  });

  const itemContext = useAccordionItemContext();
  const registeredId = () => componentProps.id || undefined;
  const id = () => registeredId() ?? itemContext.defaultTriggerId();

  createEffect(registeredId, (currentRegisteredId) => {
    itemContext.setTriggerId((currentId) =>
      currentRegisteredId ?? (currentId === null ? undefined : currentId),
    );
    return () => {
      itemContext.setTriggerId((currentId) =>
        currentId === currentRegisteredId ? null : currentId,
      );
    };
  });

  return useRenderElement('button', componentProps, {
    state: () => ({ ...itemContext.state(), disabled: disabled() }),
    ref: buttonRef,
    props: [
      {
        get 'aria-controls'() {
          return collapsibleContext.open() ? collapsibleContext.panelId() : undefined;
        },
        get 'aria-expanded'() {
          return collapsibleContext.open();
        },
        get id() {
          return id();
        },
        onClick: collapsibleContext.handleTrigger,
      },
      elementProps,
      getButtonProps,
    ],
    stateAttributesMapping,
  });
}

export interface AccordionTriggerState extends AccordionItemState {}

export interface AccordionTriggerProps
  extends NativeButtonProps, BaseUIComponentProps<'button', AccordionTriggerState> {}

export namespace AccordionTrigger {
  export type State = AccordionTriggerState;
  export type Props = AccordionTriggerProps;
}
