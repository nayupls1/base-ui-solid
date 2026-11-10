import type { JSX } from '@solidjs/web';
import { createSignal, omit, untrack } from 'solid-js';
import { useControlled } from 'base-ui-solidjs-utils/useControlled';
import { useMenuFilterImpl } from '../filter-root/MenuFilterContext';
import { MenuRadioGroupContext } from './MenuRadioGroupContext';
import { MenuGroupContext } from '../group/MenuGroupContext';
import { useRenderElement } from '../../internals/useRenderElement';
import type { BaseUIComponentProps } from '../../internals/types';
import type { MenuRoot } from '../root/MenuRoot';
import { ownedProps } from '../../internals/ownedProps';

/**
 * @internal
 */
export function MenuRadioGroupPlain(componentProps: MenuRadioGroup.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'style',
    'value',
    'defaultValue',
    'onValueChange',
    'disabled',
    'aria-labelledby',
    'ref',
  );

  const [labelId, setLabelId] = createSignal<string | undefined>(undefined, { ownedWrite: true });

  const [value, setValueUnwrapped] = useControlled({
    controlled: () => componentProps.value,
    default: untrack(() => componentProps.defaultValue),
    name: 'MenuRadioGroup',
  });

  const setValue = (newValue: any, eventDetails: MenuRadioGroup.ChangeEventDetails) => {
    componentProps.onValueChange?.(newValue, eventDetails);

    if (eventDetails.isCanceled) {
      return;
    }

    setValueUnwrapped(newValue);
  };

  const disabled = () => componentProps.disabled ?? false;

  const context: MenuRadioGroupContext = {
    get value() {
      return value();
    },
    setValue,
    get disabled() {
      return disabled();
    },
  };

  return (
    <MenuGroupContext value={setLabelId as any}>
      <MenuRadioGroupContext value={context}>
        {untrack(() =>
          useRenderElement('div', componentProps, {
            state: () => ({ disabled: disabled() }),
            props: [
              {
                role: 'group',
                get 'aria-labelledby'() {
                  return componentProps['aria-labelledby'] ?? labelId();
                },
                get 'aria-disabled'() {
                  return disabled() || undefined;
                },
              },
              elementProps,
            ],
          }),
        )}
      </MenuRadioGroupContext>
    </MenuGroupContext>
  );
}

/**
 * Groups related radio items.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export function MenuRadioGroup(props: MenuRadioGroup.Props) {
  const RadioGroup = (useMenuFilterImpl()?.RadioGroup ?? MenuRadioGroupPlain) as (
    p: MenuRadioGroup.Props,
  ) => JSX.Element;
  return <RadioGroup {...props} />;
}

export interface MenuRadioGroupProps extends BaseUIComponentProps<'div', MenuRadioGroupState> {
  /**
   * The content of the component.
   */
  children?: JSX.Element;
  /**
   * The controlled value of the radio item that should be currently selected.
   *
   * To render an uncontrolled radio group, use the `defaultValue` prop instead.
   */
  value?: any;
  /**
   * The uncontrolled value of the radio item that should be initially selected.
   *
   * To render a controlled radio group, use the `value` prop instead.
   */
  defaultValue?: any;
  /**
   * Function called when the selected value changes.
   */
  onValueChange?:
    ((value: any, eventDetails: MenuRadioGroup.ChangeEventDetails) => void) | undefined;
  /**
   * Whether the component should ignore user interaction.
   *
   * @default false
   */
  disabled?: boolean | undefined;
}

export interface MenuRadioGroupState {
  /**
   * Whether the component is disabled.
   */
  disabled: boolean;
}

export type MenuRadioGroupChangeEventReason = MenuRoot.ChangeEventReason;
export type MenuRadioGroupChangeEventDetails = MenuRoot.ChangeEventDetails;

export namespace MenuRadioGroup {
  export type Props = MenuRadioGroupProps;
  export type State = MenuRadioGroupState;
  export type ChangeEventReason = MenuRadioGroupChangeEventReason;
  export type ChangeEventDetails = MenuRadioGroupChangeEventDetails;
}
