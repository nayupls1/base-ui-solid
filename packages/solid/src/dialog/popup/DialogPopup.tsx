import { createMemo, omit, untrack } from 'solid-js';
import type { RefObject } from 'base-ui-solidjs-utils/types';
import type { InteractionType } from 'base-ui-solidjs-utils/useEnhancedClickHandler';
import { FloatingFocusManager } from '../../utils/popups/focus/FloatingFocusManager';
import { useDialogRootContext } from '../root/DialogRootContext';
import { useRenderElement } from '../../internals/useRenderElement';
import type { BaseUIComponentProps } from '../../internals/types';
import type { TransitionStatus } from '../../internals/useTransitionStatus';
import { useDialogPortalContext } from '../portal/DialogPortalContext';
import { useOpenChangeComplete } from '../../internals/useOpenChangeComplete';
import { COMPOSITE_KEYS } from '../../internals/composite/composite';
import { mergeProps } from '../../merge-props';
import {
  FOCUSABLE_POPUP_PROPS,
  createDefaultInitialFocus,
} from '../../utils/popups/popupStoreUtils';
import * as DialogPopupCssVars from './DialogPopupCssVars';
import { dialogStateAttributesMapping } from '../utils/stateAttributesMapping';
import { ownedProps } from '../../internals/ownedProps';

/**
 * A container for the dialog contents.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Dialog](https://base-ui.com/react/components/dialog)
 */
export function DialogPopup(componentProps: DialogPopup.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'style',
    'finalFocus',
    'initialFocus',
    'children',
    'ref',
  );

  const store = useDialogRootContext();

  const descriptionElementId = store.useState('descriptionElementId');
  const disablePointerDismissal = store.useState('disablePointerDismissal');
  const rootPopupProps = store.useState('popupProps');
  const modal = store.useState('modal');
  const mounted = store.useState('mounted');
  const nested = store.useState('nested');
  const nestedOpenDialogCount = store.useState('nestedOpenDialogCount');
  const open = store.useState('open');
  const openMethod = store.useState('openMethod');
  const titleElementId = store.useState('titleElementId');
  const transitionStatus = store.useState('transitionStatus');
  const role = store.useState('role');
  const defaultPopupId = store.useState('defaultPopupId');

  useDialogPortalContext();

  useOpenChangeComplete({
    get open() {
      return open();
    },
    ref: store.context.popupRef,
    onComplete() {
      if (open()) {
        store.context.onOpenChangeComplete?.(true);
      }
    },
  });

  const resolvedInitialFocus = () =>
    componentProps.initialFocus === undefined
      ? createDefaultInitialFocus(store.context.popupRef)
      : componentProps.initialFocus;

  const setPopupElement = store.useStateSetter('popupElement');

  const state = createMemo<DialogPopupState>(() => ({
    open: open(),
    nested: nested(),
    transitionStatus: transitionStatus(),
    nestedDialogOpen: nestedOpenDialogCount() > 0,
  }));

  return (
    <FloatingFocusManager
      store={store}
      openInteractionType={openMethod()}
      disabled={!mounted()}
      closeOnFocusOut={!disablePointerDismissal()}
      initialFocus={resolvedInitialFocus() as any}
      returnFocus={componentProps.finalFocus as any}
      modal={modal() !== false}
      restoreFocus="popup"
    >
      {untrack(() =>
        useRenderElement('div', componentProps, {
          state,
          props: [
            (merged: Record<string, any>) => mergeProps(merged, rootPopupProps()),
            {
              get id() {
                return defaultPopupId();
              },
              get 'aria-labelledby'() {
                return titleElementId();
              },
              get 'aria-describedby'() {
                return descriptionElementId();
              },
              get role() {
                return role();
              },
              ...FOCUSABLE_POPUP_PROPS,
              get hidden() {
                return !mounted();
              },
              onKeyDown(event: KeyboardEvent) {
                if (COMPOSITE_KEYS.has(event.key)) {
                  event.stopPropagation();
                }
              },
              get style() {
                return {
                  [DialogPopupCssVars.nestedDialogs]: String(nestedOpenDialogCount()),
                };
              },
            },
            elementProps,
          ],
          ref: [
            (el: HTMLElement | null) => {
              store.context.popupRef.current = el;
            },
            setPopupElement as (el: HTMLElement | null) => void,
          ],
          stateAttributesMapping: dialogStateAttributesMapping,
        }),
      )}
    </FloatingFocusManager>
  );
}

export interface DialogPopupProps extends BaseUIComponentProps<'div', DialogPopupState> {
  /**
   * Determines the element to focus when the dialog is opened.
   * By default, focus moves to the first tabbable element inside the popup, except when the dialog
   * is opened by touch — then the popup itself is focused to avoid opening the virtual keyboard.
   *
   * - `false`: Do not move focus.
   * - `true`: Move focus based on the default behavior (first tabbable element or popup).
   * - `RefObject`: Move focus to the ref element.
   * - `function`: Called with the interaction type (`mouse`, `touch`, `pen`, or `keyboard`).
   *   Return an element to focus, `true` to use the default behavior, `null` to fall back to the default behavior, or `false`/`undefined` to do nothing.
   */
  initialFocus?:
    | boolean
    | RefObject<HTMLElement | null>
    | ((openType: InteractionType) => boolean | HTMLElement | null | void)
    | undefined;
  /**
   * Determines the element to focus when the dialog is closed.
   *
   * - `false`: Do not move focus.
   * - `true`: Move focus based on the default behavior (trigger or previously focused element).
   * - `RefObject`: Move focus to the ref element.
   * - `function`: Called with the interaction type (`mouse`, `touch`, `pen`, or `keyboard`).
   *   Return an element to focus, `true` to use the default behavior, `null` to fall back to the default behavior, or `false`/`undefined` to do nothing.
   */
  finalFocus?:
    | boolean
    | RefObject<HTMLElement | null>
    | ((closeType: InteractionType) => boolean | HTMLElement | null | void)
    | undefined;
}

export interface DialogPopupState {
  /**
   * Whether the dialog is currently open.
   */
  open: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
  /**
   * Whether the dialog is nested within a parent dialog.
   */
  nested: boolean;
  /**
   * Whether the dialog has nested dialogs open.
   */
  nestedDialogOpen: boolean;
}

export namespace DialogPopup {
  export type Props = DialogPopupProps;
  export type State = DialogPopupState;
}
