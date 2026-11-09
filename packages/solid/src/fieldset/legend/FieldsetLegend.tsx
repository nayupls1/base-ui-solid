import { omit } from 'solid-js';
import { useRenderElement } from '../../internals/useRenderElement';
import { useFieldsetRootContext } from '../root/FieldsetRootContext';
import type { BaseUIComponentProps } from '../../internals/types';
import { useRegisteredLabelId } from '../../utils/useRegisteredLabelId';

/**
 * An accessible label that is automatically associated with the fieldset.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Fieldset](https://base-ui.com/react/components/fieldset)
 */
export function FieldsetLegend(componentProps: FieldsetLegend.Props) {
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'id', 'children', 'ref');

  const context = useFieldsetRootContext();

  const id = useRegisteredLabelId(() => componentProps.id, context.setLegendId);

  const state = (): FieldsetLegendState => ({
    disabled: context.disabled,
  });

  return useRenderElement('div', componentProps, {
    state,
    props: [
      {
        get id() {
          return id();
        },
      },
      elementProps,
    ],
  });
}

export interface FieldsetLegendState {
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
}

export interface FieldsetLegendProps extends BaseUIComponentProps<'div', FieldsetLegendState> {}

export namespace FieldsetLegend {
  export type State = FieldsetLegendState;
  export type Props = FieldsetLegendProps;
}
