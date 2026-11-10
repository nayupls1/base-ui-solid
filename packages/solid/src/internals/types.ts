import type { JSX } from '@solidjs/web';
import type { BaseUIEvent, ComponentRenderFn, HTMLProps } from '../types';

export type { HTMLProps, BaseUIEvent, ComponentRenderFn };

export type MaybeBaseUIEvent<E extends Event> = E &
  Partial<Pick<BaseUIEvent<E>, 'preventBaseUIHandler' | 'baseUIHandlerPrevented'>>;

export interface FloatingUIOpenChangeDetails {
  open: boolean;
  reason: string;
  nativeEvent: Event;
  nested: boolean;
  triggerElement?: Element | undefined;
}

/**
 * Accepted values for the `render` prop.
 *
 * - a tag name (`'a'`)
 * - a function `(props, state) => JSX.Element`; a Solid component works too
 * - a JSX element (`<a href="/" />`): Base UI spreads its props onto it
 */
export type RenderProp<State = any, RenderFunctionProps = HTMLProps> =
  | keyof JSX.IntrinsicElements
  | ComponentRenderFn<RenderFunctionProps, State>
  | JSX.Element;

export type ClassNameProp<State> = JSX.ClassValue | ((state: State) => JSX.ClassValue | undefined);

export type StyleProp<State> =
  | JSX.CSSProperties
  | string
  | ((state: State) => JSX.CSSProperties | string | undefined);

/**
 * The intrinsic props of an element.
 */
export type IntrinsicProps<ElementType extends keyof JSX.IntrinsicElements> =
  JSX.IntrinsicElements[ElementType];

/**
 * Props shared by all Base UI components.
 * Contains `class` (string or callback taking the component's state as an argument), `style` and
 * `render` (to customize rendering).
 */
export type BaseUIComponentProps<
  ElementType extends keyof JSX.IntrinsicElements,
  State,
  RenderFunctionProps = HTMLProps,
> = Omit<IntrinsicProps<ElementType>, 'class' | 'style' | 'color' | 'id' | 'disabled'> & {
  /**
   * The id of the element.
   */
  id?: string | undefined;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled?: boolean | undefined;
  /**
   * CSS class applied to the element, or a function that
   * returns a class based on the component's state.
   */
  class?: ClassNameProp<State> | undefined;
  /**
   * Allows you to replace the component's HTML element
   * with a different tag, or compose it with another component.
   *
   * Accepts a tag name, a JSX element, or a function that returns the element to render.
   */
  render?: RenderProp<State, RenderFunctionProps> | undefined;
  /**
   * Style applied to the element, or a function that
   * returns a style object based on the component's state.
   */
  style?: StyleProp<State> | undefined;
};

export interface NativeButtonProps {
  /**
   * Whether the component renders a native `<button>` element when replacing it
   * via the `render` prop.
   * Set to `false` if the rendered element is not a button (for example, `<div>`).
   * @default true
   */
  nativeButton?: boolean | undefined;
}

export interface NonNativeButtonProps {
  /**
   * Whether the component renders a native `<button>` element when replacing it
   * via the `render` prop.
   * Set to `true` if the rendered element is a native button.
   * @default false
   */
  nativeButton?: boolean | undefined;
}

/**
 * Simplifies the display of a type (without modifying it).
 */
export type Simplify<T> = T extends Function ? T : { [K in keyof T]: T[K] };

export type RequiredExcept<T, K extends keyof T> = Required<Omit<T, K>> & Pick<T, K>;

export type Orientation = 'horizontal' | 'vertical';
