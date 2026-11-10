import { omit } from 'solid-js';
import { isHTMLElement } from '@floating-ui/utils/dom';
import type { BaseUIComponentProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import {
  focusElementWithVisible,
  getControlById,
  useLabel,
} from '../../internals/labelable-provider/useLabel';
import type { SliderRootState } from '../root/SliderRoot';
import { useSliderRootContext } from '../root/SliderRootContext';
import { sliderStateAttributesMapping } from '../root/stateAttributesMapping';
import { ownedProps } from '../../internals/ownedProps';

/**
 * An accessible label that is automatically associated with the slider thumbs.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Slider](https://base-ui.com/react/components/slider)
 */
export function SliderLabel(componentProps: SliderLabel.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'id' as any, 'ref');
  const ctx = useSliderRootContext();

  function focusControl(event: MouseEvent, controlId: string | undefined) {
    if (controlId) {
      const controlElement = getControlById(event.currentTarget as Element, controlId);
      if (isHTMLElement(controlElement)) {
        focusElementWithVisible(controlElement);
        return;
      }
    }

    const fallbackInputs = ctx.controlRef.current?.querySelectorAll('input[type="range"]');
    const fallbackInput = fallbackInputs?.length === 1 ? fallbackInputs[0] : null;
    if (isHTMLElement(fallbackInput)) {
      focusElementWithVisible(fallbackInput);
    }
  }

  const labelProps = useLabel({
    get id() {
      return ctx.rootLabelId;
    },
    setLabelId: ctx.setLabelId,
    focusControl,
  } as any);

  return useRenderElement('div', componentProps, {
    state: () => ctx.state,
    props: [labelProps, elementProps],
    stateAttributesMapping: sliderStateAttributesMapping as any,
  });
}

export type SliderLabelState = SliderRoot.State;

export interface SliderLabelProps extends Omit<
  BaseUIComponentProps<'div', SliderLabel.State>,
  'id'
> {}

export namespace SliderLabel {
  export type State = SliderLabelState;
  export type Props = SliderLabelProps;
}
