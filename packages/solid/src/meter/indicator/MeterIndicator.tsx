import type { MeterRootState } from '../root/MeterRoot';
import { omit } from 'solid-js';
import { useRenderElement } from '../../internals/useRenderElement';
import type { BaseUIComponentProps } from '../../internals/types';
import { useMeterRootContext } from '../root/MeterRootContext';
import { ownedProps } from '../../internals/ownedProps';

/**
 * Visualizes the position of the value along the range.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Meter](https://base-ui.com/react/components/meter)
 */
export function MeterIndicator(componentProps: MeterIndicator.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'children', 'ref');

  const context = useMeterRootContext();

  return useRenderElement('div', componentProps, {
    props: [
      {
        get style() {
          return {
            'inset-inline-start': '0',
            height: 'inherit',
            width: `${context.percentageValue}%`,
          };
        },
      },
      elementProps,
    ],
  });
}

export interface MeterIndicatorState extends MeterRootState {}

export interface MeterIndicatorProps extends BaseUIComponentProps<'div', MeterIndicatorState> {}

export namespace MeterIndicator {
  export type State = MeterIndicatorState;
  export type Props = MeterIndicatorProps;
}
