import { omit } from 'solid-js';
import { useCheckboxRootContext } from '../root/CheckboxRootContext';
import { useRenderElement } from '../../internals/useRenderElement';
import { getCheckboxStateAttributesMapping } from '../utils/getCheckboxStateAttributesMapping';
import type { CheckboxRootState } from '../root/CheckboxRoot';
import type { BaseUIComponentProps } from '../../internals/types';
import { useOpenChangeComplete } from '../../internals/useOpenChangeComplete';
import { useTransitionStatus } from '../../internals/useTransitionStatus';
import type { TransitionStatus } from '../../internals/useTransitionStatus';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import { transitionStatusMapping } from '../../internals/stateAttributesMapping';
import { ownedProps } from '../../internals/ownedProps';

/**
 * Indicates whether the checkbox is ticked.
 * Renders a `<span>` element.
 *
 * Documentation: [Base UI Checkbox](https://base-ui.com/react/components/checkbox)
 */
export function CheckboxIndicator(componentProps: CheckboxIndicator.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'keepMounted', 'children', 'ref');

  const rootState = useCheckboxRootContext();

  const rendered = () => rootState().checked || rootState().indeterminate;

  const { mounted, transitionStatus, setMounted } = useTransitionStatus(rendered);

  let indicatorElement: HTMLSpanElement | null = null;

  const state = (): CheckboxIndicatorState => ({
    ...rootState(),
    transitionStatus: transitionStatus(),
  });

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

  const stateAttributesMapping: StateAttributesMapping<CheckboxIndicatorState> = {
    ...getCheckboxStateAttributesMapping({
      get indeterminate() {
        return rootState().indeterminate;
      },
    } as CheckboxRootState),
    ...transitionStatusMapping,
  };

  return useRenderElement('span', componentProps, {
    enabled: () => (componentProps.keepMounted ?? false) || mounted(),
    ref: (el: HTMLSpanElement | null) => {
      indicatorElement = el;
    },
    state,
    stateAttributesMapping,
    props: elementProps,
  });
}

export interface CheckboxIndicatorState extends CheckboxRootState {
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export interface CheckboxIndicatorProps extends BaseUIComponentProps<
  'span',
  CheckboxIndicatorState
> {
  /**
   * Whether to keep the element in the DOM when the checkbox is not checked.
   * @default false
   */
  keepMounted?: boolean | undefined;
}

export namespace CheckboxIndicator {
  export type State = CheckboxIndicatorState;
  export type Props = CheckboxIndicatorProps;
}
