import { omit } from 'solid-js';
import type { BaseUIComponentProps } from '../../internals/types';
import { useScrollAreaRootContext } from '../root/ScrollAreaRootContext';
import { useRenderElement } from '../../internals/useRenderElement';

/**
 * A small rectangular area that appears at the intersection of horizontal and vertical scrollbars.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Scroll Area](https://base-ui.com/react/components/scroll-area)
 */
export function ScrollAreaCorner(componentProps: ScrollAreaCorner.Props) {
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'children', 'ref');

  const root = useScrollAreaRootContext();

  return useRenderElement('div', componentProps, {
    enabled: () => !root.hiddenState.corner,
    ref: (el: HTMLDivElement | null) => {
      root.cornerRef.current = el;
    },
    props: [
      {
        'aria-hidden': true,
        get style() {
          return {
            position: 'absolute',
            bottom: '0',
            'inset-inline-end': '0',
            width: `${root.cornerSize.width}px`,
            height: `${root.cornerSize.height}px`,
          };
        },
      },
      elementProps,
    ],
  });
}

export interface ScrollAreaCornerState {}

export interface ScrollAreaCornerProps extends BaseUIComponentProps<'div', ScrollAreaCornerState> {}

export namespace ScrollAreaCorner {
  export type State = ScrollAreaCornerState;
  export type Props = ScrollAreaCornerProps;
}
