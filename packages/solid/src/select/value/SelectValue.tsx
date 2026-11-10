import type { JSX } from '@solidjs/web';
import { createMemo, omit } from 'solid-js';
import type { BaseUIComponentProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useSelectRootContext } from '../root/SelectRootContext';
import { resolveMultipleLabels, resolveSelectedLabel } from '../../internals/resolveValueLabel';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import { ownedProps } from '../../internals/ownedProps';

const stateAttributesMapping: StateAttributesMapping<SelectValueState> = {
  value: () => null,
};

/**
 * A text label of the currently selected item.
 * Renders a `<span>` element.
 *
 * Documentation: [Base UI Select](https://base-ui.com/react/components/select)
 */
export function SelectValue(componentProps: SelectValue.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(
    componentProps,
    'class',
    'render',
    'children',
    'placeholder',
    'style',
    'ref',
  );

  const store = useSelectRootContext();
  const value = store.useState('selectedValue');
  const items = store.useState('items');
  const itemToStringLabel = store.useState('itemToStringLabel');
  const hasSelectedValue = store.useState('hasSelectedValue');

  const shouldCheckNullItemLabel = () =>
    !hasSelectedValue() && componentProps.placeholder != null && componentProps.children == null;
  const hasNullLabel = store.useState('hasNullItemLabel', shouldCheckNullItemLabel);

  const state = createMemo<SelectValueState>(() => ({
    value: value(),
    placeholder: !hasSelectedValue(),
  }));

  const children = () => {
    const childrenProp = componentProps.children as any;
    const currentValue = value();
    if (typeof childrenProp === 'function') {
      return childrenProp(currentValue);
    }
    if (childrenProp != null) {
      return childrenProp;
    }
    if (shouldCheckNullItemLabel() && !hasNullLabel()) {
      return componentProps.placeholder;
    }
    if (Array.isArray(currentValue)) {
      return resolveMultipleLabels(currentValue, items(), itemToStringLabel());
    }
    return resolveSelectedLabel(currentValue, items(), itemToStringLabel());
  };

  return useRenderElement('span', componentProps, {
    state,
    ref: (el: HTMLSpanElement | null) => {
      store.context.valueRef.current = el;
    },
    props: [elementProps],
    children,
    stateAttributesMapping,
  });
}

export interface SelectValueState {
  /**
   * The value of the currently selected item.
   */
  value: any;
  /**
   * Whether the placeholder is being displayed.
   */
  placeholder: boolean;
}

export interface SelectValueProps extends Omit<
  BaseUIComponentProps<'span', SelectValueState>,
  'children'
> {
  /**
   * Accepts a function that returns a `ReactNode` to format the selected value.
   * Treat the value as read-only: in `multiple` mode it may be a shared frozen array
   * when nothing is selected.
   * @example
   * ```tsx
   * <Select.Value>
   *   {(value: string | null) => value ? labels[value] : 'No value'}
   * </Select.Value>
   * ```
   */
  children?: JSX.Element | ((value: any) => JSX.Element);
  /**
   * The placeholder value to display when no value is selected.
   * This is overridden by `children` if specified, or by a null item's label in `items`.
   */
  placeholder?: JSX.Element;
}

export namespace SelectValue {
  export type State = SelectValueState;
  export type Props = SelectValueProps;
}
