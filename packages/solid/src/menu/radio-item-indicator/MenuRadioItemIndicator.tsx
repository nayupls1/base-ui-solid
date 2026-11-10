import { createMemo, omit } from 'solid-js';
import { createSyncSignal } from 'base-ui-solidjs-utils/createSyncSignal';
import { useMenuRadioItemContext } from '../radio-item/MenuRadioItemContext';
import { useRenderElement } from '../../internals/useRenderElement';
import type { BaseUIComponentProps } from '../../internals/types';
import { itemMapping } from '../utils/stateAttributesMapping';
import type { TransitionStatus } from '../../internals/useTransitionStatus';
import { useTransitionStatus } from '../../internals/useTransitionStatus';
import { useOpenChangeComplete } from '../../internals/useOpenChangeComplete';
import { ownedProps } from '../../internals/ownedProps';

/**
 * Indicates whether the radio item is selected.
 * Renders a `<span>` element.
 *
 * Documentation: [Base UI Menu](https://base-ui.com/react/components/menu)
 */
export function MenuRadioItemIndicator(componentProps: MenuRadioItemIndicator.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(
    componentProps,
    'render',
    'class',
    'style',
    'keepMounted',
    'children',
    'ref',
  );

  const item = useMenuRadioItemContext();
  const [indicator, setIndicator] = createSyncSignal<HTMLSpanElement | null>(null);

  const { transitionStatus, mounted, setMounted } = useTransitionStatus(() => item.checked);

  useOpenChangeComplete({
    batch: true,
    get enabled() {
      return !item.checked;
    },
    get open() {
      return item.checked;
    },
    ref: indicator,
    onComplete() {
      if (!item.checked) {
        setMounted(false);
      }
    },
  });

  const state = createMemo<MenuRadioItemIndicatorState>(() => ({
    checked: item.checked,
    disabled: item.disabled,
    highlighted: item.highlighted,
    transitionStatus: transitionStatus(),
  }));

  return useRenderElement('span', componentProps, {
    state,
    ref: (el: HTMLSpanElement | null) => {
      setIndicator(el);
    },
    stateAttributesMapping: itemMapping,
    props: [{ 'aria-hidden': true }, elementProps],
    enabled: () => (componentProps.keepMounted ?? false) || mounted(),
  });
}

export interface MenuRadioItemIndicatorProps extends BaseUIComponentProps<
  'span',
  MenuRadioItemIndicatorState
> {
  /**
   * Whether to keep the HTML element in the DOM when the radio item is inactive.
   * @default false
   */
  keepMounted?: boolean | undefined;
}

export interface MenuRadioItemIndicatorState {
  /**
   * Whether the radio item is currently selected.
   */
  checked: boolean;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Whether the item is highlighted.
   */
  highlighted: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export namespace MenuRadioItemIndicator {
  export type Props = MenuRadioItemIndicatorProps;
  export type State = MenuRadioItemIndicatorState;
}
