import type { JSX } from '@solidjs/web';
import { createEffect, createMemo, For, omit, Show, untrack } from 'solid-js';
import { addEventListener } from 'base-ui-solidjs-utils/addEventListener';
import { mergeCleanups } from 'base-ui-solidjs-utils/mergeCleanups';
import { ownerDocument, ownerWindow } from 'base-ui-solidjs-utils/owner';
import { visuallyHidden } from 'base-ui-solidjs-utils/visuallyHidden';
import { useTimeout } from 'base-ui-solidjs-utils/useTimeout';
import { activeElement, contains, getTarget } from 'base-ui-solidjs-utils/shadowDom';
import { FocusGuard } from '../../utils/popups/focus/FocusGuard';
import type { BaseUIComponentProps, HTMLProps } from '../../internals/types';
import { useToastProviderContext } from '../provider/ToastProviderContext';
import { useRenderElement } from '../../internals/useRenderElement';
import { isFocusVisible } from '../utils/focusVisible';
import * as ToastViewportCssVars from './ToastViewportCssVars';
import { ownedProps } from '../../internals/ownedProps';

/**
 * A container viewport for toasts.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Toast](https://base-ui.com/react/components/toast)
 */
export function ToastViewport(componentProps: ToastViewport.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'children', 'ref');

  const store = useToastProviderContext();

  const windowFocusTimeout = useTimeout();
  let markedReadyForMouseLeave = false;
  let touchActive = false;

  const isEmpty = store.useState('isEmpty');
  const toasts = store.useState('toasts');
  const focused = store.useState('focused');
  const expanded = store.useState('expanded');
  const prevFocusElement = store.useState('prevFocusElement');
  const viewportElement = () => store.get('viewport');

  const frontmostHeight = () => toasts()[0]?.height;
  const hasTransitioningToasts = () =>
    toasts().some((toast) => toast.transitionStatus === 'ending');
  const highPriorityToasts = () => toasts().filter((toast) => toast.priority === 'high');

  createEffect(
    () => [viewportElement(), isEmpty()] as const,
    ([viewport, empty]) => {
      // Window focus is tracked even while empty, so toasts added in the background start
      // paused. `isEmpty` only toggles the F6 and touch listeners.
      if (!viewport) {
        return undefined;
      }

      const win = ownerWindow(viewport);
      const doc = ownerDocument(viewport);

      // Listen globally for F6 so we can force-focus the viewport.
      function handleGlobalKeyDown(event: KeyboardEvent) {
        // Skip presses another viewport already handled.
        if (event.key !== 'F6' || event.defaultPrevented) {
          return;
        }

        event.preventDefault();
        // Set the restore target before focusing: consumer focus handlers may close the toasts.
        store.set('prevFocusElement', activeElement(doc) as HTMLElement | null);
        // `handleFocus` pauses only on visible focus, which script focus doesn't get everywhere.
        viewport?.focus({
          preventScroll: true,
          focusVisible: true,
        } as FocusOptions);
      }

      function handleWindowBlur(event: FocusEvent) {
        if (getTarget(event) !== win) {
          return;
        }

        windowFocusTimeout.clear();
        store.set('isWindowFocused', false);
        store.pauseTimers();
      }

      function handleWindowFocus(event: FocusEvent) {
        if (event.relatedTarget) {
          return;
        }

        // This capture listener also sees element focus. Wait for `handleFocus` so keyboard
        // focus inside the viewport keeps the pause, and resume after the flag flips.
        windowFocusTimeout.start(0, () => {
          store.set('isWindowFocused', true);
          if (!store.select('expanded')) {
            store.resumeTimers();
          }
        });
      }

      return mergeCleanups(
        addEventListener(win, 'blur', handleWindowBlur, true),
        addEventListener(win, 'focus', handleWindowFocus, true),
        !empty && addEventListener(win, 'keydown', handleGlobalKeyDown),
        !empty && addEventListener(doc, 'pointerdown', store.handleDocumentPointerDown, true),
      );
    },
  );

  function handleFocusGuard(event: FocusEvent) {
    // If we're coming off the container, move to the first toast that can hold
    // focus, skipping toasts that are animating out or inert because they're limited.
    const firstFocusableToast =
      event.relatedTarget === store.state.viewport
        ? store.state.toasts.find((toast) => toast.transitionStatus !== 'ending' && !toast.limited)
        : undefined;

    if (firstFocusableToast) {
      firstFocusableToast.ref?.current?.focus();
    } else {
      store.restoreFocusToPrevElement();
    }
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.defaultPrevented) {
      return;
    }

    const isF6 = event.key === 'F6';
    if (isF6) {
      // Keep F6 pressed inside the viewport away from the global F6 listeners (including this
      // one's), which would pull focus back to the viewport. Without a return target, leave the
      // default action to the browser.
      event.stopPropagation();
    }

    if (
      (isF6 ||
        (event.key === 'Tab' && event.shiftKey && getTarget(event) === store.state.viewport)) &&
      store.state.prevFocusElement &&
      store.restoreFocusToPrevElement()
    ) {
      // Cancel only if focus moved: a hidden or disabled return target leaves the
      // browser free to move focus. `handleBlur` resumes the timers.
      event.preventDefault();
    }
  }

  function flushMouseLeave() {
    const hasEndingToasts = store.state.toasts.some((toast) => toast.transitionStatus === 'ending');

    if (hasEndingToasts || touchActive || !markedReadyForMouseLeave) {
      return;
    }

    // Apply any mouseleave that was deferred until transitions finished.
    store.set('hovering', false);
    if (!store.select('expandedOrOutOfFocus')) {
      store.resumeTimers();
    }
    markedReadyForMouseLeave = false;
  }

  createEffect(hasTransitioningToasts, () => {
    untrack(flushMouseLeave);
  });

  function handleMouseEnter() {
    store.pauseTimers();
    store.set('hovering', true);
    markedReadyForMouseLeave = false;
  }

  function handleMouseLeave() {
    // Defer to `flushMouseLeave`: while toasts are transitioning out or a touch gesture is active it
    // records the intent and collapses later; otherwise it collapses immediately.
    markedReadyForMouseLeave = true;
    flushMouseLeave();
  }

  function handlePointerDown(event: PointerEvent) {
    if (event.pointerType === 'touch') {
      touchActive = true;
    }
  }

  function handlePointerEnd(event: PointerEvent) {
    if (event.pointerType !== 'touch') {
      return;
    }

    touchActive = false;
    flushMouseLeave();
  }

  function handleFocus() {
    if (store.select('focused')) {
      return;
    }

    // Only set focused when the active element is focus-visible.
    // This prevents the viewport from staying expanded when clicking inside without
    // keyboard navigation.
    const activeEl = activeElement(ownerDocument(store.state.viewport));
    if (contains(store.state.viewport, activeEl) && isFocusVisible(activeEl)) {
      store.set('focused', true);
      store.pauseTimers();
    }
  }

  function handleBlur(event: FocusEvent) {
    if (
      !store.select('focused') ||
      contains(store.state.viewport, event.relatedTarget as HTMLElement | null)
    ) {
      return;
    }

    store.set('focused', false);
    if (!store.select('expandedOrOutOfFocus')) {
      store.resumeTimers();
    }
  }

  const defaultProps: HTMLProps = {
    tabindex: -1,
    role: 'region',
    'aria-live': 'polite',
    'aria-atomic': false,
    'aria-relevant': 'additions text',
    'aria-label': 'Notifications',
    onMouseEnter: handleMouseEnter,
    onMouseMove: handleMouseEnter,
    onMouseLeave: handleMouseLeave,
    onFocus: handleFocus,
    onBlur: handleBlur,
    onKeyDown: handleKeyDown,
    onClick: handleFocus,
    onPointerDown: handlePointerDown,
    onPointerUp: handlePointerEnd,
    onPointerCancel: handlePointerEnd,
    get style() {
      const height = frontmostHeight();
      return {
        [ToastViewportCssVars.frontmostHeight]: height ? `${height}px` : undefined,
      };
    },
  } as any;

  const state = createMemo<ToastViewportState>(() => ({
    expanded: expanded(),
  }));

  const showFocusGuard = () => !isEmpty() && prevFocusElement() != null;
  const focusGuard = () => (
    <Show when={showFocusGuard()}>
      <FocusGuard onFocus={handleFocusGuard} />
    </Show>
  );

  return (
    <>
      {focusGuard()}
      {untrack(() =>
        useRenderElement('div', componentProps, {
          ref: store.setViewport as (el: HTMLElement | null) => void,
          state,
          props: [defaultProps, elementProps],
          children: () => (
            <>
              {focusGuard()}
              {componentProps.children}
              {focusGuard()}
            </>
          ),
        }),
      )}
      <Show when={!focused() && highPriorityToasts().length > 0}>
        <div style={visuallyHidden}>
          <For each={highPriorityToasts()}>
            {(toast) => (
              <div role="alert" aria-atomic="true">
                <div>{toast.title as any}</div>
                <div>{toast.description as any}</div>
              </div>
            )}
          </For>
        </div>
      </Show>
    </>
  );
}

export interface ToastViewportState {
  /**
   * Whether toasts are expanded in the viewport.
   */
  expanded: boolean;
}

export interface ToastViewportProps extends BaseUIComponentProps<'div', ToastViewportState> {}

export namespace ToastViewport {
  export type State = ToastViewportState;
  export type Props = ToastViewportProps;
}
