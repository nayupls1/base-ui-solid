import { createSignal, omit } from 'solid-js';
import { platform } from 'base-ui-solidjs-utils/platform';
import type { BaseUIComponentProps, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useBaseUiId } from '../../internals/useBaseUiId';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import {
  useFilterDropdownItemContext,
  useFilterDropdownRootContext,
  useFilterDropdownValueContext,
} from '../root/FilterDropdownRootContext';
import { refocusOwner, isRefocusingOwner } from '../utils/refocusOwner';
import { ownedProps } from '../../internals/ownedProps';

/**
 * The text input that filters the items.
 * Renders an `<input>` element.
 *
 * @internal
 */
export function FilterDropdownInput(componentProps: FilterDropdownInputHostProps) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'style',
    'id',
    'disabled',
    'activeItemId',
    'navigationProps',
    'children',
    'ref',
  );

  // Browsers flag a form field with neither an id nor a name.
  const id = useBaseUiId(() => componentProps.id as string | undefined);

  const context = useFilterDropdownRootContext();
  const itemContext = useFilterDropdownItemContext();
  const value = useFilterDropdownValueContext();

  // IME text isn't committed until the composition ends, so filtering waits for it.
  const [composingValue, setComposingValue] = createSignal<string | null>(null, {
    ownedWrite: true,
  });
  let isComposing = false;

  function commitValue(nextValue: string, nativeEvent: Event, input: HTMLInputElement) {
    // The input keeps focus until the popup unmounts. The query is held in place while it
    // animates out, so an edit made then would change the committed value behind it.
    if (!context.open) {
      input.value = value();
      return;
    }
    const reason = nextValue === '' ? REASONS.inputClear : REASONS.inputChange;
    context.onValueChange(nextValue, createChangeEventDetails(reason, nativeEvent));
    // Solid doesn't revert a controlled input, so restore it if the consumer kept the old value.
    queueMicrotask(() => {
      if (composingValue() === null && input.value !== value()) {
        input.value = value();
      }
    });
  }

  const state = (): FilterDropdownInputState => ({
    highlighted:
      context.inputFocusVisible &&
      (!context.keyboardModality || componentProps.activeItemId == null),
  });

  return useRenderElement('input', componentProps, {
    state,
    ref: (el: HTMLInputElement | null) => {
      context.focusOwnerRef.current = el;
    },
    props: [
      (merged: Record<string, any>) => ({ ...merged, ...(componentProps.navigationProps ?? {}) }),
      {
        get id() {
          return id();
        },
        type: 'text',
        get disabled() {
          return context.disabled || componentProps.disabled;
        },
        get 'aria-activedescendant'() {
          return componentProps.activeItemId;
        },
        role: 'searchbox',
        inputmode: 'search',
        autocomplete: 'off',
        spellcheck: 'false',
        autocorrect: 'off',
        autocapitalize: 'none',
        // The aria-autocomplete 'list' value is only valid with `aria-haspopup` so we depend
        // on the searchbox role to communicate affordance, with an input label as fallback
        // https://w3c.github.io/aria/#aria-autocomplete
        'aria-autocomplete': undefined,
        get 'aria-controls'() {
          return context.listId;
        },
        get value() {
          return composingValue() ?? value();
        },
        onCompositionStart(event: CompositionEvent) {
          // Some Android keyboards treat all typing as one composition.
          if (platform.os.android) {
            return;
          }
          isComposing = true;
          setComposingValue((event.currentTarget as HTMLInputElement).value);
        },
        onCompositionEnd(event: CompositionEvent) {
          if (!isComposing) {
            return;
          }
          isComposing = false;
          setComposingValue(null);
          const input = event.currentTarget as HTMLInputElement;
          commitValue(input.value, event, input);
        },
        onInput(event: InputEvent) {
          const input = event.currentTarget as HTMLInputElement;
          if (isComposing) {
            setComposingValue(input.value);
            return;
          }
          commitValue(input.value, event, input);
        },
        onKeyDown() {
          context.setKeyboardModality(true);
        },
        onPointerDown() {
          context.setKeyboardModality(false);
        },
        onMouseEnter(event: MouseEvent) {
          context.setKeyboardModality(false);
          // Take focus so typing filters immediately.
          if (context.open) {
            refocusOwner(event.currentTarget as HTMLElement);
          }
        },
        onFocus(event: FocusEvent) {
          context.setInputFocusVisible(true);

          // A screen reader that followed `aria-activedescendant` put real focus on the item, so
          // focus returning from an item means the user moved back to the input on purpose and
          // the highlight no longer reflects where they are. The list's own key replay and
          // pointer refocus also pass through here and keep it.
          if (context.autoHighlight === 'always' || isRefocusingOwner()) {
            return;
          }
          const from = event.relatedTarget as HTMLElement | null;
          if (from !== null && itemContext.listRef.current.includes(from)) {
            context.setActiveIndex(null);
          }
        },
        onBlur() {
          context.setInputFocusVisible(false);
        },
      } as any,
      elementProps,
    ],
  });
}

export interface FilterDropdownInputState {
  /**
   * Whether the input shows its own focus ring rather than a highlighted item.
   */
  highlighted: boolean;
}

export interface FilterDropdownInputProps extends BaseUIComponentProps<
  'input',
  FilterDropdownInputState
> {}

interface FilterDropdownInputHostProps extends FilterDropdownInputProps {
  activeItemId?: string | undefined;
  navigationProps?: HTMLProps | undefined;
}

export namespace FilterDropdownInput {
  export type Props = FilterDropdownInputProps;
  export type State = FilterDropdownInputState;
}
