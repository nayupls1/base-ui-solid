import { isHydrating } from 'solid-js';

/**
 * The server can't know the visitor's locale, so format with a fixed one while hydrating.
 * The server markup then matches the hydration render, and the visitor's locale is applied after.
 * Returns the locale to use for the current evaluation.
 */
export function useFormatLocale(locale: Intl.LocalesArgument | undefined) {
  return locale ?? (isHydrating() ? 'en-US' : undefined);
}
