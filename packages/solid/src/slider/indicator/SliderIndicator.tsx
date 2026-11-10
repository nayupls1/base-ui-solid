import type { JSX } from '@solidjs/web';
import { omit } from 'solid-js';
import type { BaseUIComponentProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useIsHydrating } from '../../utils/useIsHydrating';
import { valueToPercent } from '../../utils/valueToPercent';
import type { SliderRootState } from '../root/SliderRoot';
import { useSliderRootContext } from '../root/SliderRootContext';
import { sliderStateAttributesMapping } from '../root/stateAttributesMapping';
import { ownedProps } from '../../internals/ownedProps';

function getIndicatorStyles(
  vertical: boolean,
  range: boolean,
  inset: boolean,
  start: number | undefined,
  end: number | undefined,
  forceHidden: boolean,
): JSX.CSSProperties & Record<string, unknown> {
  const styles: JSX.CSSProperties & Record<string, unknown> = {
    visibility:
      forceHidden || (inset && (start === undefined || (range && end === undefined)))
        ? ('hidden' as const)
        : undefined,
    position: vertical ? 'absolute' : 'relative',
    [vertical ? 'width' : 'height']: 'inherit',
  };

  let startValue: string = `${start ?? 0}%`;
  let sizeValue: string = `${(end ?? 0) - (start ?? 0)}%`;

  if (inset) {
    styles['--start-position'] = startValue;
    startValue = 'var(--start-position)';

    if (range) {
      styles['--relative-size'] = sizeValue;
      sizeValue = 'var(--relative-size)';
    }
  }

  styles[vertical ? 'bottom' : 'inset-inline-start'] = range ? startValue : '0';
  styles[vertical ? 'height' : 'width'] = range ? sizeValue : startValue;

  return styles;
}

/**
 * Visualizes the current value of the slider.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Slider](https://base-ui.com/react/components/slider)
 */
export function SliderIndicator(componentProps: SliderIndicator.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'children', 'ref');
  const ctx = useSliderRootContext();
  const isHydrating = useIsHydrating();

  const style = () => {
    const values = ctx.values;
    const inset = ctx.inset;
    return getIndicatorStyles(
      ctx.orientation === 'vertical',
      values.length > 1,
      inset,
      inset ? ctx.indicatorPosition[0] : valueToPercent(values[0], ctx.min, ctx.max),
      inset ? ctx.indicatorPosition[1] : valueToPercent(values[values.length - 1], ctx.min, ctx.max),
      inset && ctx.renderBeforeHydration && Boolean(isHydrating),
    );
  };

  return useRenderElement('div', componentProps, {
    state: () => ctx.state,
    props: [
      {
        get 'data-base-ui-slider-indicator'() {
          return ctx.renderBeforeHydration ? '' : undefined;
        },
        get style() {
          return style();
        },
      },
      elementProps,
    ],
    stateAttributesMapping: sliderStateAttributesMapping as any,
  });
}

export interface SliderIndicatorState extends SliderRootState {}

export interface SliderIndicatorProps extends BaseUIComponentProps<'div', SliderIndicatorState> {}

export namespace SliderIndicator {
  export type State = SliderIndicatorState;
  export type Props = SliderIndicatorProps;
}
