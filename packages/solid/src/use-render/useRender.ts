import type { JSX } from '@solidjs/web';
import type { ComponentRenderFn, HTMLProps } from '../internals/types';
import { useRenderElement, type RefInput } from '../internals/useRenderElement';
import type { StateAttributesMapping } from '../internals/getStateAttributesProps';

/**
 * Renders a Base UI element.
 *
 * @public
 */
export function useRender<State extends Record<string, unknown>>(
  params: useRender.Parameters<State>,
): JSX.Element {
  return useRenderElement(
    params.defaultTagName ?? 'div',
    {
      get render() {
        return params.render;
      },
      get children() {
        return (params.props as any)?.children ?? params.children;
      },
      get ref() {
        return (params.props as any)?.ref;
      },
    },
    {
      state: params.state as any,
      ref: params.ref,
      props: () => [params.props as any],
      stateAttributesMapping: params.stateAttributesMapping,
      enabled: params.enabled,
    },
  );
}

export type UseRenderRenderProp<State = Record<string, unknown>> =
  | keyof JSX.IntrinsicElements
  | JSX.Element
  | ComponentRenderFn<HTMLProps, State>;

export type UseRenderElementProps<ElementType extends keyof JSX.IntrinsicElements> =
  JSX.IntrinsicElements[ElementType];

export type UseRenderComponentProps<
  ElementType extends keyof JSX.IntrinsicElements,
  State = {},
  RenderFunctionProps = HTMLProps,
> = JSX.IntrinsicElements[ElementType] & {
  /**
   * Allows you to replace the component's HTML element
   * with a different tag, or compose it with another component.
   *
   * Accepts a tag name, a JSX element, or a function that returns the element to render.
   */
  render?:
    | keyof JSX.IntrinsicElements
    | JSX.Element
    | ComponentRenderFn<RenderFunctionProps, State>
    | undefined;
};

export interface UseRenderParameters<State> {
  /**
   * The element, tag name or function that returns one to override the default element.
   */
  render?: UseRenderRenderProp<State> | undefined;
  /**
   * The ref to apply to the rendered element.
   */
  ref?: RefInput<Element> | undefined;
  /**
   * The state of the component, passed as the second argument to the `render` callback.
   * State properties are automatically converted to data-* attributes.
   * Pass an accessor to keep it reactive.
   */
  state?: State | (() => State) | undefined;
  /**
   * Custom mapping for converting state properties to data-* attributes.
   * @example
   * { isActive: (value) => (value ? { 'data-is-active': '' } : null) }
   */
  stateAttributesMapping?: StateAttributesMapping<State> | undefined;
  /**
   * Props to be spread on the rendered element.
   * They are merged with the internal props of the component, so that event handlers
   * are merged, `class` strings and `style` properties are joined, while other external props overwrite the
   * internal ones.
   */
  props?: Record<string, unknown> | undefined;
  /**
   * If `false`, nothing is rendered.
   * @default true
   */
  enabled?: boolean | (() => boolean) | undefined;
  /**
   * The default tag name to use for the rendered element when `render` is not provided.
   * @default 'div'
   */
  defaultTagName?: keyof JSX.IntrinsicElements | undefined;
  /**
   * The children to render inside the element.
   */
  children?: JSX.Element;
}

export interface UseRenderState {}

export namespace useRender {
  export type State = UseRenderState;
  export type RenderProp<TState = Record<string, unknown>> = UseRenderRenderProp<TState>;
  export type ElementProps<ElementType extends keyof JSX.IntrinsicElements> =
    UseRenderElementProps<ElementType>;
  export type ComponentProps<
    ElementType extends keyof JSX.IntrinsicElements,
    TState = {},
    RenderFunctionProps = HTMLProps,
  > = UseRenderComponentProps<ElementType, TState, RenderFunctionProps>;
  export type Parameters<TState> = UseRenderParameters<TState>;
}
