import { createMemo, omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { formatNumber } from '@base-ui-solid/utils/formatNumber';
import type { BaseUIComponentProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useFormatLocale } from '../../utils/useFormatLocale';
import type { SliderRootState } from '../root/SliderRoot';
import { useSliderRootContext } from '../root/SliderRootContext';
import { sliderStateAttributesMapping } from '../root/stateAttributesMapping';
import { ownedProps } from '../../internals/ownedProps';

/**
 * Displays the current value of the slider as text.
 * Renders an `<output>` element.
 *
 * Documentation: [Base UI Slider](https://base-ui.com/react/components/slider)
 */
export function SliderValue(componentProps: SliderValue.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(
    componentProps,
    'aria-live',
    'render',
    'class',
    'children',
    'style',
    'ref',
  );
  const ctx = useSliderRootContext();

  const outputFor = () =>
    Array.from(ctx.thumbMap.values(), (metadata: any) => metadata?.inputId)
      .join(' ')
      .trim() || undefined;

  const formattedValues = createMemo(() => {
    const formatLocale = useFormatLocale(ctx.locale);
    return ctx.values.map((v) => formatNumber(v, formatLocale, ctx.format));
  });

  return useRenderElement('output', componentProps, {
    state: () => ctx.state,
    props: [
      {
        get 'aria-live'() {
          return componentProps['aria-live'] ?? 'off';
        },
        get for() {
          return outputFor();
        },
      },
      elementProps,
    ],
    children: () => {
      const children = componentProps.children as any;
      return typeof children === 'function'
        ? children(formattedValues(), ctx.values)
        : formattedValues().join(' – ');
    },
    stateAttributesMapping: sliderStateAttributesMapping as any,
  });
}

export interface SliderValueState extends SliderRootState {}

export interface SliderValueProps extends Omit<
  BaseUIComponentProps<'output', SliderValueState>,
  'children'
> {
  children?:
    | null
    | ((formattedValues: readonly string[], values: readonly number[]) => JSX.Element)
    | undefined;
}

export namespace SliderValue {
  export type State = SliderValueState;
  export type Props = SliderValueProps;
}
