import { isElementDisabled } from 'base-ui-solidjs-utils/isElementDisabled';
import { useCompositeRootContext } from '../root/CompositeRootContext';
import { useCompositeListItem } from '../list/useCompositeListItem';
import type { UseCompositeListItemParameters } from '../list/useCompositeListItem';
import type { HTMLProps } from '../../types';

export interface UseCompositeItemParameters<Metadata> extends Pick<
  UseCompositeListItemParameters<Metadata>,
  'metadata'
> {}

export function useCompositeItem<Metadata>(params: UseCompositeItemParameters<Metadata> = {}) {
  const context = useCompositeRootContext();
  const { ref, index } = useCompositeListItem(params);

  const isHighlighted = () => context.highlightedIndex === index();

  let item: HTMLElement | null = null;
  const compositeRef = (node: HTMLElement | null) => {
    ref(node);
    item = node;
  };

  const compositeProps: HTMLProps = {
    get tabindex() {
      return isHighlighted() ? 0 : -1;
    },
    onFocus() {
      context.onHighlightedIndexChange(index());
    },
    onMouseMove() {
      if (!context.highlightItemOnHover || !item) {
        return;
      }

      if (!isHighlighted() && !isElementDisabled(item)) {
        item.focus();
      }
    },
  };

  return {
    compositeProps,
    compositeRef,
    index,
    isHighlighted,
  };
}
