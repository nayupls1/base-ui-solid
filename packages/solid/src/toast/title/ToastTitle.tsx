import { omit, Show, untrack } from 'solid-js';
import type { BaseUIComponentProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useToastLabelElement, useToastLabelPart } from '../utils/useToastLabelPart';
import { ownedProps } from '../../internals/ownedProps';

/**
 * A title that labels the toast.
 * Renders an `<h2>` element.
 *
 * Documentation: [Base UI Toast](https://base-ui.com/react/components/toast)
 */
export function ToastTitle(componentProps: ToastTitle.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'id', 'children', 'ref');

  const { id, children, type, setId } = useToastLabelPart(
    () => componentProps.id,
    () => componentProps.children,
    'title',
  );

  const state = (): ToastTitleState => ({ type: type() });

  const shouldRender = useToastLabelElement(children, id, setId);

  return (
    <Show when={shouldRender()}>
      {untrack(() =>
        useRenderElement('h2', componentProps, {
          state,
          props: [
            elementProps,
            {
              get id() {
                return id() as string | undefined;
              },
            },
          ],
          children,
        }),
      )}
    </Show>
  );
}

export interface ToastTitleState {
  /**
   * The type of the toast.
   */
  type: string | undefined;
}

export interface ToastTitleProps extends BaseUIComponentProps<'h2', ToastTitleState> {}

export namespace ToastTitle {
  export type State = ToastTitleState;
  export type Props = ToastTitleProps;
}
