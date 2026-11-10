import { createContext, useContext } from 'solid-js';
import type { RefObject } from 'base-ui-solidjs-utils/types';

export interface CompositeListRegistration<Metadata> {
  metadata: Metadata | null;
  index: number | null;
  label: string | null | undefined;
  textRef: RefObject<HTMLElement | null> | undefined;
}

export interface CompositeListContextValue<Metadata> {
  register: (node: Element, registration: CompositeListRegistration<Metadata>) => void;
  unregister: (node: Element) => void;
  subscribeMapChange: (fn: (map: Map<Element, Metadata>) => void) => () => void;
  nextIndexRef: RefObject<number>;
}

const DEFAULT_CONTEXT: CompositeListContextValue<any> = {
  register: () => {},
  unregister: () => {},
  subscribeMapChange: () => () => {},
  nextIndexRef: { current: 0 },
};

export const CompositeListContext = createContext<CompositeListContextValue<any>>(DEFAULT_CONTEXT);

export function useCompositeListContext() {
  return useContext(CompositeListContext);
}
