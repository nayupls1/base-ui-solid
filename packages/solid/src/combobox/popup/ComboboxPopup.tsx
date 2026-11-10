import { createEffect, createMemo, omit, Show, untrack } from 'solid-js';
import type { RefObject } from 'base-ui-solidjs-utils/types';
import type { InteractionType } from 'base-ui-solidjs-utils/useEnhancedClickHandler';
import { contains, getTarget } from 'base-ui-solidjs-utils/shadowDom';
import { FloatingFocusManager } from '../../utils/popups/focus/FloatingFocusManager';
import type { BaseUIComponentProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useComboboxRootContext } from '../root/ComboboxRootContext';
import { popupTransitionStateMapping } from '../../utils/popups/popupStateMapping';
import { useComboboxPositionerContext } from '../positioner/ComboboxPositionerContext';
import type { Side, Align } from '../../internals/useAnchorPositioning';
import { useOpenChangeComplete } from '../../internals/useOpenChangeComplete';
import type { TransitionStatus } from '../../internals/useTransitionStatus';
import { getDisabledMountTransitionStyles } from '../../internals/getDisabledMountTransitionStyles';
import { ComboboxInternalDismissButton } from '../utils/ComboboxInternalDismissButton';
import { getComboboxPopupId } from '../root/utils';
import { useListEmpty } from '../utils/parts';
import { mergeProps } from '../../merge-props';
import { ownedProps } from '../../internals/ownedProps';

/**
 * A container for the list.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export function ComboboxPopup(componentProps: ComboboxPopup.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'style',
    'initialFocus',
    'finalFocus',
    'children',
    'ref',
  );

  const store = useComboboxRootContext();
  const positioning = useComboboxPositionerContext();

  const mounted = store.useState('mounted');
  const open = store.useState('open');
  const openMethod = store.useState('openMethod');
  const popupProps = store.useState('popupProps');
  const transitionStatus = store.useState('transitionStatus');
  const inputInsidePopup = store.useState('inputInsidePopup');
  const inputElement = store.useState('inputElement');
  const modal = store.useState('modal');
  const rootId = store.useState('id');

  const empty = useListEmpty();
  const popupId = () =>
    (componentProps as any).id ?? (inputInsidePopup() ? getComboboxPopupId(rootId()) : undefined);

  createEffect(popupId, (id) => {
    // Prefer the rendered DOM id, which a `render` prop element or function may override.
    store.set('popupElementId', store.context.popupRef.current?.id || id);
    return () => {
      store.set('popupElementId', undefined);
    };
  });

  useOpenChangeComplete({
    get open() {
      return open();
    },
    ref: store.context.popupRef,
    onComplete() {
      if (untrack(open)) {
        store.context.onOpenChangeComplete?.(true);
      }
    },
  });

  const state = createMemo<ComboboxPopupState>(() => ({
    open: open(),
    side: positioning.side,
    align: positioning.align,
    anchorHidden: positioning.anchorHidden,
    transitionStatus: transitionStatus(),
    empty: empty(),
  }));

  const setPopupElement = store.useStateSetter('popupElement');

  // Default initial focus logic:
  // If opened by touch, focus the popup element to prevent the virtual keyboard from opening
  // (this is required for Android specifically as iOS handles this automatically).
  const resolvedInitialFocus = () => {
    if (componentProps.initialFocus !== undefined) {
      return componentProps.initialFocus;
    }
    return inputInsidePopup()
      ? (interactionType: InteractionType) =>
          interactionType === 'touch' ? store.context.popupRef.current : store.state.inputElement
      : false;
  };
  void inputElement;

  const resolvedFinalFocus = () => {
    if (componentProps.finalFocus != null) {
      return componentProps.finalFocus;
    }
    return inputInsidePopup() ? undefined : false;
  };

  const focusManagerModal = () => !inputInsidePopup() || modal();

  return (
    <FloatingFocusManager
      store={store.interactions as any}
      disabled={!mounted()}
      modal={focusManagerModal()}
      openInteractionType={openMethod()}
      initialFocus={resolvedInitialFocus() as any}
      returnFocus={resolvedFinalFocus() as any}
      getInsideElements={() => [
        store.context.startDismissRef.current,
        store.context.endDismissRef.current,
      ]}
    >
      <>
        {untrack(() =>
          useRenderElement('div', componentProps, {
            state,
            ref: [
              (el: HTMLDivElement | null) => {
                store.context.popupRef.current = el;
              },
              setPopupElement as any,
            ],
            props: [
              (merged: Record<string, any>) => mergeProps(merged, popupProps() as any),
              {
                get id() {
                  return popupId();
                },
                get role() {
                  return inputInsidePopup() ? 'dialog' : 'presentation';
                },
                onFocus(event: FocusEvent) {
                  const target = getTarget(event) as Element | null;
                  if (
                    store.state.openMethod !== 'touch' &&
                    (contains(store.state.listElement, target) || target === event.currentTarget)
                  ) {
                    store.context.inputRef.current?.focus();
                  }
                },
              },
              {
                get style() {
                  return getDisabledMountTransitionStyles(transitionStatus()).style;
                },
              },
              elementProps,
            ],
            stateAttributesMapping: popupTransitionStateMapping,
          }),
        )}
        <Show when={focusManagerModal()}>
          <ComboboxInternalDismissButton
            ref={(el: HTMLSpanElement | null) => {
              store.context.endDismissRef.current = el;
            }}
          />
        </Show>
      </>
    </FloatingFocusManager>
  );
}

export interface ComboboxPopupState {
  /**
   * Whether the component is open.
   */
  open: boolean;
  /**
   * The side of the anchor the component is placed on.
   */
  side: Side;
  /**
   * The alignment of the component relative to the anchor.
   */
  align: Align;
  /**
   * Whether the anchor element is hidden.
   */
  anchorHidden: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
  /**
   * Whether there are no items to display.
   */
  empty: boolean;
}

export interface ComboboxPopupProps extends BaseUIComponentProps<'div', ComboboxPopupState> {
  /**
   * Determines the element to focus when the popup is opened.
   *
   * - `false`: Do not move focus.
   * - `true`: Move focus based on the default behavior (first tabbable element or popup).
   * - `RefObject`: Move focus to the ref element.
   * - `function`: Called with the interaction type (`mouse`, `touch`, `pen`, or `keyboard`).
   *   Return an element to focus, `true` to use the default behavior, or `false`/`undefined` to do nothing.
   */
  initialFocus?:
    | boolean
    | RefObject<HTMLElement | null>
    | ((openType: InteractionType) => void | boolean | HTMLElement | null)
    | undefined;
  /**
   * Determines the element to focus when the popup is closed.
   *
   * - `false`: Do not move focus.
   * - `true`: Move focus based on the default behavior (trigger or previously focused element).
   * - `RefObject`: Move focus to the ref element.
   * - `function`: Called with the interaction type (`mouse`, `touch`, `pen`, or `keyboard`).
   *   Return an element to focus, `true` to use the default behavior, or `false`/`undefined` to do nothing.
   */
  finalFocus?:
    | boolean
    | RefObject<HTMLElement | null>
    | ((closeType: InteractionType) => void | boolean | HTMLElement | null)
    | undefined;
}

export namespace ComboboxPopup {
  export type State = ComboboxPopupState;
  export type Props = ComboboxPopupProps;
}
