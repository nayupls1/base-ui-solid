import { createMemo, omit } from 'solid-js';
import { createSyncSignal } from '@base-ui-solid/utils/createSyncSignal';
import type { BaseUIComponentProps } from '../internals/types';
import { useTransitionStatus } from '../internals/useTransitionStatus';
import type { TransitionStatus } from '../internals/useTransitionStatus';
import { useOpenChangeComplete } from '../internals/useOpenChangeComplete';
import { useRenderElement } from '../internals/useRenderElement';
import { transitionStatusMapping } from '../internals/stateAttributesMapping';
import { ownedProps } from '../internals/ownedProps';

// The public wrappers mount this component only when selected or kept mounted, avoiding the
// hook costs for unselected items.
export function ItemIndicator(componentProps: ItemIndicatorProps) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'style',
    'keepMounted',
    'selected',
    'children',
    'ref',
  );

  const [indicator, setIndicator] = createSyncSignal<HTMLSpanElement | null>(null);
  const { transitionStatus, setMounted } = useTransitionStatus(() => componentProps.selected);

  const state = createMemo<ItemIndicatorState>(() => ({
    selected: componentProps.selected,
    transitionStatus: transitionStatus(),
  }));

  useOpenChangeComplete({
    batch: true,
    get enabled() {
      return !componentProps.selected;
    },
    get open() {
      return componentProps.selected;
    },
    ref: indicator,
    onComplete() {
      if (!componentProps.selected) {
        setMounted(false);
      }
    },
  });

  return useRenderElement('span', componentProps, {
    ref: (el: HTMLSpanElement | null) => {
      setIndicator(el);
    },
    state,
    props: [{ 'aria-hidden': true }, elementProps],
    children: () => (componentProps.children !== undefined ? componentProps.children : '✔️'),
    stateAttributesMapping: transitionStatusMapping,
  });
}

interface ItemIndicatorState {
  selected: boolean;
  transitionStatus: TransitionStatus;
}

interface ItemIndicatorProps extends BaseUIComponentProps<'span', ItemIndicatorState> {
  keepMounted?: boolean | undefined;
  selected: boolean;
}
