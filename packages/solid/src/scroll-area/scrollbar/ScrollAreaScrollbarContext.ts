import { createContext, useContext, type Accessor } from 'solid-js';

export type ScrollAreaScrollbarContext = Accessor<'horizontal' | 'vertical'>;

export const ScrollAreaScrollbarContext = createContext<ScrollAreaScrollbarContext | null>(null);

export function useScrollAreaScrollbarContext() {
  const context = useContext(ScrollAreaScrollbarContext);
  if (context == null) {
    throw new Error(
      'Base UI: ScrollAreaScrollbarContext is missing. ScrollAreaScrollbar parts must be placed within <ScrollArea.Scrollbar>.',
    );
  }
  return context;
}
