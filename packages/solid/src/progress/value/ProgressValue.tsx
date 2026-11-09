import type { JSX } from '@solidjs/web';
import { omit } from 'solid-js';
import type { BaseUIComponentProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { formatRangeValue } from '../../utils/formatRangeValue';
import { useFormatLocale } from '../../utils/useFormatLocale';
import { useProgressRootContext } from '../root/ProgressRootContext';
import type { ProgressRootState } from '../root/ProgressRoot';
import { progressStateAttributesMapping } from '../root/stateAttributesMapping';
import { ownedProps } from '../../internals/ownedProps';

/**
 * A text label displaying the current value.
 * Renders a `<span>` element.
 *
 * Documentation: [Base UI Progress](https://base-ui.com/react/components/progress)
 */
export function ProgressValue(componentProps: ProgressValue.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(componentProps, 'class', 'render', 'children', 'style', 'ref');

  const context = useProgressRootContext();
  const formattedValue = () =>
    formatRangeValue(
      context.clampedValue,
      context.percentageValue,
      useFormatLocale(context.locale),
      context.format,
    );

  const indeterminate = () => context.state.status === 'indeterminate';

  return useRenderElement('span', componentProps, {
    state: () => context.state,
    props: [{ 'aria-hidden': true }, elementProps],
    children: () => {
      const children = componentProps.children;
      if (typeof children === 'function') {
        return (children as Function)(
          indeterminate() ? 'indeterminate' : formattedValue(),
          context.value,
        );
      }
      return indeterminate() ? null : formattedValue();
    },
    stateAttributesMapping: progressStateAttributesMapping,
  });
}

export interface ProgressValueState extends ProgressRootState {}

export interface ProgressValueProps extends Omit<
  BaseUIComponentProps<'span', ProgressValueState>,
  'children'
> {
  children?:
    null | ((formattedValue: string | null, value: number | null) => JSX.Element) | undefined;
}

export namespace ProgressValue {
  export type State = ProgressValueState;
  export type Props = ProgressValueProps;
}
