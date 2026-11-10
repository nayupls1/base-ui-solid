import { createMemo, createSignal, createEffect, type Accessor } from 'solid-js';
import { addEventListener } from 'base-ui-solidjs-utils/addEventListener';

/**
 * Tracks whether a media query matches.
 * `query` and `options` may be accessors/getters; the returned accessor updates when the media
 * query list changes.
 */
export function useMediaQuery(
  query: string | Accessor<string>,
  options: useMediaQuery.Options = {},
): Accessor<boolean> {
  // Wait for jsdom to support the match media feature.
  // All the browsers Base UI support have this built-in.
  // This defensive check is here for simplicity.
  // Most of the time, the match media logic isn't central to people's tests.
  const supportMatchMedia =
    typeof window !== 'undefined' && typeof window.matchMedia !== 'undefined';

  const resolvedQuery = () =>
    (typeof query === 'function' ? query() : query).replace(/^@media( ?)/m, '');

  const matchMedia = () =>
    options.matchMedia ?? (supportMatchMedia ? window.matchMedia.bind(window) : null);

  const mediaQueryList = createMemo(() => {
    const match = matchMedia();
    return match ? match(resolvedQuery()) : null;
  });

  // The client renders with the live value immediately; `defaultMatches` only applies when
  // `matchMedia` is unavailable. SSR (`ssrMatchMedia`, `noSsr`) isn't supported by this port.
  const [version, setVersion] = createSignal(0, { ownedWrite: true });

  createEffect(mediaQueryList, (list) => {
    if (!list) {
      return undefined;
    }
    return addEventListener(list, 'change', () => setVersion((value) => value + 1));
  });

  return createMemo(() => {
    version();
    const list = mediaQueryList();
    return list ? list.matches : (options.defaultMatches ?? false);
  });
}

export interface UseMediaQueryOptions {
  /**
   * As `window.matchMedia()` is unavailable on the server,
   * it returns a default matches during the first mount.
   * @default false
   */
  defaultMatches?: boolean | undefined;
  /**
   * You can provide your own implementation of matchMedia.
   * This can be used for handling an iframe content window.
   */
  matchMedia?: typeof window.matchMedia | undefined;
  /**
   * To perform the server-side hydration, the hook needs to render twice.
   * A first time with `defaultMatches`, the value of the server, and a second time with the resolved value.
   * This double pass rendering cycle comes with a drawback: it's slower.
   * You can set this option to `true` if you use the returned value **only** client-side.
   * @default false
   */
  noSsr?: boolean | undefined;
  /**
   * You can provide your own implementation of `matchMedia`, it's used when rendering server-side.
   */
  ssrMatchMedia?: ((query: string) => { matches: boolean }) | undefined;
}

export interface UseMediaQueryState {}

export namespace useMediaQuery {
  export type State = UseMediaQueryState;
  export type Options = UseMediaQueryOptions;
}
