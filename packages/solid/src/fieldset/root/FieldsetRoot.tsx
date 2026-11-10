import { omit, untrack } from 'solid-js';
import { createSyncSignal } from 'base-ui-solidjs-utils/createSyncSignal';
import { FieldsetRootContext, useFieldsetRootContext } from './FieldsetRootContext';
import type { BaseUIComponentProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { ownedProps } from '../../internals/ownedProps';

/**
 * Groups a shared legend with related controls.
 * Renders a `<fieldset>` element.
 *
 * Documentation: [Base UI Fieldset](https://base-ui.com/react/components/fieldset)
 */
export function FieldsetRoot(componentProps: FieldsetRoot.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'disabled', 'children', 'ref');

  const [legendId, setLegendId] = createSyncSignal<string | undefined>(undefined);

  const parent = useFieldsetRootContext(true);
  const disabled = () => Boolean(parent?.disabled || (componentProps.disabled ?? false));

  const state = (): FieldsetRootState => ({
    disabled: disabled(),
  });

  const contextValue: FieldsetRootContext = {
    get legendId() {
      return legendId();
    },
    setLegendId: (value) => {
      setLegendId(value);
    },
    get disabled() {
      return disabled();
    },
  };

  return (
    <FieldsetRootContext value={contextValue}>
      {untrack(() =>
        useRenderElement('fieldset', componentProps, {
          state,
          props: [
            {
              get 'aria-labelledby'() {
                return legendId();
              },
              get disabled() {
                return disabled();
              },
            },
            elementProps,
          ],
        }),
      )}
    </FieldsetRootContext>
  );
}


export interface FieldsetRootState {
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
}

export interface FieldsetRootProps extends BaseUIComponentProps<'fieldset', FieldsetRootState> {}

export namespace FieldsetRoot {
  export type State = FieldsetRootState;
  export type Props = FieldsetRootProps;
}
