import {
  flip as baseFlip,
  limitShift as baseLimitShift,
  offset as baseOffset,
  shift as baseShift,
  size as baseSize,
  type Middleware,
} from '@floating-ui/dom';

type Options<T extends (...args: any) => any> = Parameters<T>[0];

/**
 * Like `@floating-ui/react-dom`'s middleware wrappers: the `deps` array is folded into the
 * middleware options so `usePosition` can detect changes of values captured by closures.
 */
function withDeps(middleware: Middleware, options: unknown, deps?: unknown[]): Middleware {
  return { ...middleware, options: [options, deps] } as Middleware;
}

export const offset = (options: Options<typeof baseOffset>, deps?: unknown[]) =>
  withDeps(baseOffset(options), options, deps);

export const shift = (options: Options<typeof baseShift>, deps?: unknown[]) =>
  withDeps(baseShift(options), options, deps);

export const flip = (options: Options<typeof baseFlip>, deps?: unknown[]) =>
  withDeps(baseFlip(options), options, deps);

export const size = (options: Options<typeof baseSize>, deps?: unknown[]) =>
  withDeps(baseSize(options), options, deps);

export const limitShift = (options: Options<typeof baseLimitShift>, deps?: unknown[]) => ({
  ...baseLimitShift(options),
  options: [options, deps],
});
