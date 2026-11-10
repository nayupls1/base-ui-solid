import { omit, Show, untrack } from 'solid-js';
import type { BaseUIComponentProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useToastLabelElement, useToastLabelPart } from '../utils/useToastLabelPart';
import { ownedProps } from '../../internals/ownedProps';

/**
 * A description that describes the toast.
 * Renders a `<p>` element.
 *
 * Documentation: [Base UI Toast](https://base-ui.com/react/components/toast)
 */
export function ToastDescription(componentProps: ToastDescription.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'id', 'children', 'ref');

  const { id, children, type, setId } = useToastLabelPart(
    () => componentProps.id,
    () => componentProps.children,
    'description',
  );

  const state = (): ToastDescriptionState => ({ type: type() });

  const shouldRender = useToastLabelElement(children, id, setId);

  return (
    <Show when={shouldRender()}>
      {untrack(() =>
        useRenderElement('p', componentProps, {
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

export interface ToastDescriptionState {
  /**
   * The type of the toast.
   */
  type: string | undefined;
}

export interface ToastDescriptionProps extends BaseUIComponentProps<'p', ToastDescriptionState> {}

export namespace ToastDescription {
  export type State = ToastDescriptionState;
  export type Props = ToastDescriptionProps;
}
