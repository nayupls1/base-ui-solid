import { createContext, useContext, type Accessor } from 'solid-js';
import type { AccordionItemState } from './AccordionItem';

export interface AccordionItemContext {
  defaultTriggerId: Accessor<string | undefined>;
  open: Accessor<boolean>;
  state: Accessor<AccordionItemState>;
  setTriggerId: (
    value:
      | string
      | null
      | undefined
      | ((prev: string | null | undefined) => string | null | undefined),
  ) => void;
  triggerId: Accessor<string | undefined>;
}

export const AccordionItemContext = createContext<AccordionItemContext | null>(null);

export function useAccordionItemContext() {
  const context = useContext(AccordionItemContext);
  if (context == null) {
    throw new Error(
      'Base UI: AccordionItemContext is missing. Accordion parts must be placed within <Accordion.Item>.',
    );
  }
  return context;
}
