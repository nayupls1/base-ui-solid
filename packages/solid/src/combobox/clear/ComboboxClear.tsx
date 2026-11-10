import { createMemo, omit, Show, untrack } from 'solid-js';
import type { BaseUIComponentProps, NativeButtonProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useButton } from '../../internals/use-button';
import { useComboboxInputValueContext, useComboboxRootContext } from '../root/ComboboxRootContext';
import { useFieldRootContext } from '../../internals/field-root-context/FieldRootContext';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { getHighlightReason } from '../../utils/getHighlightReason';
import { useTransitionStatus } from '../../internals/useTransitionStatus';
import type { TransitionStatus } from '../../internals/useTransitionStatus';
import { useOpenChangeComplete } from '../../internals/useOpenChangeComplete';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import { transitionStatusMapping } from '../../internals/stateAttributesMapping';
import { triggerOpenStateMapping } from '../../utils/popups/popupStateMapping';
import { ownedProps } from '../../internals/ownedProps';

const stateAttributesMapping: StateAttributesMapping<ComboboxClearState> = {
  ...triggerOpenStateMapping,
  ...transitionStatusMapping,
};

/**
 * Clears the value when clicked.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export function ComboboxClear(componentProps: ComboboxClear.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'disabled',
    'nativeButton',
    'keepMounted',
    'style',
    'children',
    'ref',
  );

  const field = useFieldRootContext();
  const store = useComboboxRootContext();

  const selectionMode = store.useState('selectionMode');
  const comboboxDisabled = store.useState('disabled');
  const readOnly = store.useState('readOnly');
  const open = store.useState('open');
  const selectedValue = store.useState('selectedValue');
  const hasSelectionChips = store.useState('hasSelectionChips');

  const inputValue = useComboboxInputValueContext();

  const visible = createMemo(() => {
    const mode = selectionMode();
    if (mode === 'none') {
      return inputValue() !== '';
    }
    if (mode === 'single') {
      return selectedValue() != null;
    }
    return hasSelectionChips();
  });

  const disabled = () => field.disabled || comboboxDisabled() || (componentProps.disabled ?? false);

  const { buttonRef, getButtonProps } = useButton({
    get native() {
      return componentProps.nativeButton ?? true;
    },
    get disabled() {
      return disabled();
    },
  });

  const { mounted, transitionStatus, setMounted } = useTransitionStatus(visible);

  const state = createMemo<ComboboxClearState>(() => ({
    disabled: disabled(),
    visible: visible(),
    open: open(),
    transitionStatus: transitionStatus(),
  }));

  useOpenChangeComplete({
    get open() {
      return visible();
    },
    ref: store.context.clearRef,
    onComplete() {
      if (!untrack(visible)) {
        setMounted(false);
      }
    },
  });

  return (
    <Show when={(componentProps.keepMounted ?? false) || mounted()}>
      {untrack(() =>
        useRenderElement('button', componentProps, {
          state,
          ref: [
            buttonRef,
            (el: HTMLButtonElement | null) => {
              store.context.clearRef.current = el;
            },
          ],
          props: [
            {
              tabindex: -1,
              // Avoid stealing focus from the input.
              onMouseDown(event: MouseEvent) {
                event.preventDefault();
              },
              onClick(event: MouseEvent) {
                if (untrack(disabled) || store.state.readOnly) {
                  return;
                }

                const type = getHighlightReason(event as any);

                store.context.setInputValue(
                  '',
                  createChangeEventDetails(REASONS.clearPress, event),
                );

                if (store.state.selectionMode !== 'none') {
                  store.context.setSelectedValue(
                    Array.isArray(store.state.selectedValue) ? [] : null,
                    createChangeEventDetails(REASONS.clearPress, event),
                  );
                  store.context.setIndices({
                    activeIndex: null,
                    selectedIndex: null,
                    type,
                    event,
                  });
                } else {
                  store.context.setIndices({ activeIndex: null, type, event });
                }

                store.context.inputRef.current?.focus();
              },
            },
            elementProps,
            getButtonProps,
          ],
          children: () => componentProps.children ?? 'x',
          stateAttributesMapping,
        }),
      )}
    </Show>
  );
}

export interface ComboboxClearState {
  /**
   * Whether the popup is open.
   */
  open: boolean;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Whether the clear button should be visible.
   */
  visible: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export interface ComboboxClearProps
  extends NativeButtonProps, BaseUIComponentProps<'button', ComboboxClearState> {
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Whether the component should remain mounted in the DOM when not visible.
   * @default false
   */
  keepMounted?: boolean | undefined;
}

export namespace ComboboxClear {
  export type State = ComboboxClearState;
  export type Props = ComboboxClearProps;
}
