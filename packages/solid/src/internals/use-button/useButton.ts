import { createEffect, untrack } from 'solid-js';
import { isHTMLElement } from '@floating-ui/utils/dom';
import { error } from '@base-ui-solid/utils/error';
import { makeEventPreventable, mergeProps } from '../../merge-props';
import { useCompositeRootContext } from '../composite/root/CompositeRootContext';
import type { BaseUIEvent, HTMLProps } from '../types';
import { useFocusableWhenDisabled } from '../../utils/useFocusableWhenDisabled';
import { dispatchClickWithModifiers } from '../../utils/dispatchClickWithModifiers';

/**
 * Parameters are read lazily, so they can be getters.
 */
export function useButton(parameters: UseButtonParameters = {}): UseButtonReturnValue {
  const disabled = () => parameters.disabled ?? false;
  const isNativeButton = () => parameters.native ?? true;

  let element: HTMLElement | null = null;

  const compositeRootContext = useCompositeRootContext(true);
  const isCompositeItem = () => parameters.composite ?? compositeRootContext !== undefined;

  const { props: focusableWhenDisabledProps } = useFocusableWhenDisabled({
    get focusableWhenDisabled() {
      return parameters.focusableWhenDisabled;
    },
    get disabled() {
      return disabled();
    },
    get composite() {
      return isCompositeItem();
    },
    get tabIndex() {
      return parameters.tabIndex ?? 0;
    },
    get isNativeButton() {
      return isNativeButton();
    },
  });

  if (process.env.NODE_ENV !== 'production') {
    createEffect(isNativeButton, (native) => {
      if (!element) {
        return;
      }

      const isButtonTag = isButtonElement(element);

      if (native) {
        if (!isButtonTag) {
          error(
            'A component that acts as a button expected a native <button> because the ' +
              '`nativeButton` prop is true. Rendering a non-<button> removes native button ' +
              'semantics, which can impact forms and accessibility. Use a real <button> in the ' +
              '`render` prop, or set `nativeButton` to `false`.',
          );
        }
      } else if (isButtonTag) {
        error(
          'A component that acts as a button expected a non-<button> because the `nativeButton` ' +
            'prop is false. Rendering a <button> keeps native behavior while Base UI applies ' +
            'non-native attributes and handlers, which can add unintended extra attributes (such ' +
            'as `role` or `aria-disabled`). Use a non-<button> in the `render` prop, or set ' +
            '`nativeButton` to `true`.',
        );
      }
    });
  }

  const updateDisabled = () => {
    if (!isButtonElement(element)) {
      return;
    }

    if (
      isCompositeItem() &&
      disabled() &&
      focusableWhenDisabledProps.disabled === undefined &&
      element.disabled
    ) {
      element.disabled = false;
    }
  };

  createEffect(
    () => [isCompositeItem(), disabled(), focusableWhenDisabledProps.disabled] as const,
    () => {
      untrack(updateDisabled);
    },
  );

  const getButtonProps = (externalProps: GenericButtonProps = {}) => {
    const {
      onClick: externalOnClick,
      onMouseDown: externalOnMouseDown,
      onKeyUp: externalOnKeyUp,
      onKeyDown: externalOnKeyDown,
      onPointerDown: externalOnPointerDown,
      ...otherExternalProps
    } = externalProps;

    return mergeProps(
      {
        onClick(event: MouseEvent) {
          if (disabled()) {
            event.preventDefault();
            return;
          }
          externalOnClick?.(event);
        },
        onMouseDown(event: MouseEvent) {
          if (!disabled()) {
            externalOnMouseDown?.(event);
          }
        },
        onKeyDown(event: BaseUIEvent<KeyboardEvent>) {
          if (disabled()) {
            return;
          }

          makeEventPreventable(event);
          externalOnKeyDown?.(event);
          if (event.baseUIHandlerPrevented) {
            return;
          }

          const native = isNativeButton();
          const composite = isCompositeItem();
          const isCurrentTarget = event.target === event.currentTarget;
          const currentTarget = event.currentTarget as Element;
          const isButton = isButtonElement(currentTarget);
          const isLink = !native && isValidLinkElement(currentTarget);
          const shouldClick = isCurrentTarget && (native ? isButton : !isLink);
          const isEnterKey = event.key === 'Enter';
          const isSpaceKey = event.key === ' ';
          const role = currentTarget.getAttribute('role');
          const isTextNavigationRole =
            role?.startsWith('menuitem') || role === 'option' || role === 'gridcell';

          if (isCurrentTarget && composite && isSpaceKey) {
            if (event.defaultPrevented && isTextNavigationRole) {
              return;
            }

            event.preventDefault();

            if (!native || isButton) {
              event.preventBaseUIHandler();
              dispatchClickWithModifiers(currentTarget, event);
            }

            return;
          }

          if (!shouldClick || native || (!isSpaceKey && !isEnterKey)) {
            if (isCurrentTarget && isLink && isSpaceKey) {
              event.preventDefault();
            }
            return;
          }

          if (event.defaultPrevented) {
            return;
          }

          event.preventDefault();

          if (isEnterKey) {
            event.preventBaseUIHandler();
            dispatchClickWithModifiers(currentTarget, event);
          }
        },
        onKeyUp(event: BaseUIEvent<KeyboardEvent>) {
          if (disabled()) {
            return;
          }

          makeEventPreventable(event);
          externalOnKeyUp?.(event);

          const native = isNativeButton();
          const composite = isCompositeItem();

          if (
            event.target === event.currentTarget &&
            native &&
            composite &&
            isButtonElement(event.currentTarget as HTMLElement) &&
            event.key === ' '
          ) {
            event.preventDefault();
            return;
          }

          if (event.baseUIHandlerPrevented) {
            return;
          }

          if (
            event.target === event.currentTarget &&
            !native &&
            !composite &&
            !event.defaultPrevented &&
            event.key === ' '
          ) {
            event.preventBaseUIHandler();
            dispatchClickWithModifiers(event.currentTarget as Element, event);
          }
        },
        onPointerDown(event: PointerEvent) {
          if (disabled()) {
            event.preventDefault();
            return;
          }
          externalOnPointerDown?.(event);
        },
      },
      isNativeButton() ? { type: 'button' } : { role: 'button' },
      focusableWhenDisabledProps,
      otherExternalProps,
    );
  };

  const buttonRef = (node: HTMLElement | null) => {
    element = node;
    untrack(updateDisabled);
  };

  return {
    getButtonProps,
    buttonRef,
  };
}

function isButtonElement(elem: Element | null): elem is HTMLButtonElement {
  return isHTMLElement(elem) && elem.tagName === 'BUTTON';
}

function isValidLinkElement(elem: Element | null): elem is HTMLAnchorElement {
  return isHTMLElement(elem) && elem.tagName === 'A' && Boolean((elem as HTMLAnchorElement).href);
}

interface GenericButtonProps extends Omit<HTMLProps, 'onClick'> {
  onClick?: ((event: Event) => void) | undefined;
  [key: string]: any;
}

export interface UseButtonParameters {
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Whether the button may receive focus even if it is disabled.
   * @default false
   */
  focusableWhenDisabled?: boolean | undefined;
  tabIndex?: number | undefined;
  /**
   * Whether the component is being rendered as a native button.
   * @default true
   */
  native?: boolean | undefined;
  /**
   * Whether the button is part of a composite widget.
   * When `true`, keyboard activation for Space occurs on keydown rather than keyup.
   * @default inferred from CompositeRoot context
   */
  composite?: boolean | undefined;
}

export interface UseButtonReturnValue {
  /**
   * Resolver for the button props. Call it inside a reactive scope (it's meant to be used as a
   * function entry of `useRenderElement`'s `props`).
   * @param externalProps additional props for the button
   * @returns props that should be spread on the button
   */
  getButtonProps: (externalProps?: Record<string, any>) => Record<string, any>;
  /**
   * A ref callback for the button DOM element.
   */
  buttonRef: (element: HTMLElement | null) => void;
}

export interface UseButtonState {}
