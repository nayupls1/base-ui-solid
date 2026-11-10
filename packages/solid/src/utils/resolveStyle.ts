import type { JSX } from '@solidjs/web';

/**
 * If the provided style is an object or string, it will be returned as is.
 * Otherwise, the function will call the style function with the state as the first argument.
 */
export function resolveStyle<State>(
  style:
    | JSX.CSSProperties
    | string
    | ((state: State) => JSX.CSSProperties | string | undefined)
    | undefined,
  state: State,
) {
  return typeof style === 'function' ? style(state) : style;
}
