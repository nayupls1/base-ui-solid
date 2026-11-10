import { omit } from 'solid-js';
import type { BaseUIComponentProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import type { SliderRootState } from '../root/SliderRoot';
import { useSliderRootContext } from '../root/SliderRootContext';
import { sliderStateAttributesMapping } from '../root/stateAttributesMapping';
import { ownedProps } from '../../internals/ownedProps';

/**
 * Contains the slider indicator and represents the entire range of the slider.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Slider](https://base-ui.com/react/components/slider)
 */
export function SliderTrack(componentProps: SliderTrack.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'children', 'ref');
  const ctx = useSliderRootContext();

  return useRenderElement('div', componentProps, {
    state: () => ctx.state,
    props: [
      {
        style: {
          position: 'relative',
        },
      },
      elementProps,
    ],
    stateAttributesMapping: sliderStateAttributesMapping as any,
  });
}

export interface SliderTrackState extends SliderRootState {}

export interface SliderTrackProps extends BaseUIComponentProps<'div', SliderTrackState> {}

export namespace SliderTrack {
  export type State = SliderTrackState;
  export type Props = SliderTrackProps;
}
