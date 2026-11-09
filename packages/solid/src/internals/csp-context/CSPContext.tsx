import { createContext, useContext } from 'solid-js';

export interface CSPContextValue {
  readonly nonce?: string | undefined;
  readonly disableStyleElements?: boolean | undefined;
}

export const CSPContext = createContext<CSPContextValue | null>(null);

const DEFAULT_CSP_CONTEXT_VALUE: CSPContextValue = {
  disableStyleElements: false,
};

/**
 * Returns the CSP context. Properties are getters, so read them lazily.
 */
export function useCSPContext(): CSPContextValue {
  return useContext(CSPContext) ?? DEFAULT_CSP_CONTEXT_VALUE;
}
