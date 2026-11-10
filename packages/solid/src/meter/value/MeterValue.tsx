import type { MeterRootState } from '../root/MeterRoot';
import type { JSX } from '@solidjs/web';
import { omit } from 'solid-js';
import type { BaseUIComponentProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { formatRangeValue } from '../../utils/formatRangeValue';
import { useFormatLocale } from '../../utils/useFormatLocale';
import { useMeterRootContext } from '../root/MeterRootContext';
import { ownedProps } from '../../internals/ownedProps';

/**
 * A text element displaying the current value.
 * Renders a `<span>` element.
 *
 * Documentation: [Base UI Meter](https://base-ui.com/react/components/meter)
 */
export function MeterValue(componentProps: MeterValue.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(componentProps, 'class', 'render', 'children', 'style', 'ref');

  const context = useMeterRootContext();
  const formattedValue = () =>
    formatRangeValue(
      context.clampedValue,
      context.percentageValue,
      useFormatLocale(context.locale),
      context.format,
    );

  return useRenderElement('span', componentProps, {
    props: [{ 'aria-hidden': true }, elementProps],
    children: () => {
      const children = componentProps.children;
      return typeof children === 'function'
        ? (children as Function)(formattedValue(), context.value)
        : formattedValue();
    },
  });
}

export interface MeterValueState extends MeterRootState {}

export interface MeterValueProps extends Omit<
  BaseUIComponentProps<'span', MeterValueState>,
  'children'
> {
  children?: null | ((formattedValue: string, value: number) => JSX.Element) | undefined;
}

export namespace MeterValue {
  export type State = MeterValueState;
  export type Props = MeterValueProps;
}
