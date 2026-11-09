import type { JSX } from '@solidjs/web';

export type {
  BaseUIChangeEventDetails,
  BaseUIGenericEventDetails,
} from '../internals/createBaseUIEventDetails';

/**
 * Props that can be spread on an HTML element.
 */
export type HTMLProps<T = any> = JSX.HTMLAttributes<T> & {
  ref?: JSX.Ref<T> | undefined;
  [key: string]: any;
};

/**
 * Shape of the render prop: a function that takes props to be spread on the element and component's
 * state and returns a JSX element.
 *
 * Both arguments are reactive objects: spread or read their properties, don't destructure them.
 *
 * @template Props Props to be spread on the rendered element.
 * @template State Component's internal state.
 */
export type ComponentRenderFn<Props, State> = (props: Props, state: State) => JSX.Element;

/**
 * A native event augmented with the ability to prevent Base UI's internal handler.
 */
export type BaseUIEvent<E extends Event = Event> = E & {
  preventBaseUIHandler: () => void;
  readonly baseUIHandlerPrevented?: boolean | undefined;
};
