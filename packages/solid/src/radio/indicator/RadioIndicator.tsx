import { omit } from 'solid-js';
import type { BaseUIComponentProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import type { RadioRootState } from '../root/RadioRoot';
import { useRadioRootContext } from '../root/RadioRootContext';
import { stateAttributesMapping } from '../utils/stateAttributesMapping';
import { useOpenChangeComplete } from '../../internals/useOpenChangeComplete';
import { useTransitionStatus } from '../../internals/useTransitionStatus';
import type { TransitionStatus } from '../../internals/useTransitionStatus';

/**
 * Indicates whether the radio button is selected.
 * Renders a `<span>` element.
 *
 * Documentation: [Base UI Radio](https://base-ui.com/react/components/radio-group)
 */
export function RadioIndicator(componentProps: RadioIndicator.Props) {
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'keepMounted', 'children', 'ref');

  const rootState = useRadioRootContext();

  const rendered = () => rootState().checked;

  const { mounted, transitionStatus, setMounted } = useTransitionStatus(rendered);

  const state = (): RadioIndicatorState => ({
    ...rootState(),
    transitionStatus: transitionStatus(),
  });

  let indicatorElement: HTMLSpanElement | null = null;

  useOpenChangeComplete({
    batch: true,
    get enabled() {
      return !rendered();
    },
    get open() {
      return rendered();
    },
    ref: () => indicatorElement,
    onComplete() {
      if (!rendered()) {
        setMounted(false);
      }
    },
  });

  return useRenderElement('span', componentProps, {
    enabled: () => (componentProps.keepMounted ?? false) || mounted(),
    ref: (el: HTMLSpanElement | null) => {
      indicatorElement = el;
    },
    state,
    props: elementProps,
    stateAttributesMapping,
  });
}

export interface RadioIndicatorProps extends BaseUIComponentProps<'span', RadioIndicatorState> {
  /**
   * Whether to keep the HTML element in the DOM when the radio button is inactive.
   * @default false
   */
  keepMounted?: boolean | undefined;
}

export interface RadioIndicatorState extends RadioRootState {
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export namespace RadioIndicator {
  export type Props = RadioIndicatorProps;
  export type State = RadioIndicatorState;
}
