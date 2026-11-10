/**
 * If the provided class is not a function, it will be returned as is.
 * Otherwise, the function will call the class function with the state as the first argument.
 */
export function resolveClassName<State>(className: any, state: State) {
  return typeof className === 'function' ? className(state) : className;
}
