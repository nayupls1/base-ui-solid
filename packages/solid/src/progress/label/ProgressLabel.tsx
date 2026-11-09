import { omit } from 'solid-js';
import { useRenderElement } from '../../internals/useRenderElement';
import { useRegisteredLabelId } from '../../utils/useRegisteredLabelId';
import { useProgressRootContext } from '../root/ProgressRootContext';
import { progressStateAttributesMapping } from '../root/stateAttributesMapping';
import type { ProgressRootState } from '../root/ProgressRoot';
import type { BaseUIComponentProps } from '../../internals/types';

/**
 * An accessible label for the progress bar.
 * Renders a `<span>` element.
 *
 * Documentation: [Base UI Progress](https://base-ui.com/react/components/progress)
 */
export function ProgressLabel(componentProps: ProgressLabel.Props) {
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'id', 'children', 'ref');

  const context = useProgressRootContext();

  const id = useRegisteredLabelId(() => componentProps.id, context.setLabelId);

  return useRenderElement('span', componentProps, {
    state: () => context.state,
    props: [
      {
        get id() {
          return id();
        },
        role: 'presentation',
      },
      elementProps,
    ],
    stateAttributesMapping: progressStateAttributesMapping,
  });
}

export interface ProgressLabelState extends ProgressRootState {}

export interface ProgressLabelProps extends BaseUIComponentProps<'span', ProgressLabelState> {}

export namespace ProgressLabel {
  export type State = ProgressLabelState;
  export type Props = ProgressLabelProps;
}
