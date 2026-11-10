import { omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { RefInput } from '../../internals/useRenderElement';
import { assignRefs } from '../../internals/useRenderElement';
import { ownedProps } from '../../internals/ownedProps';

/**
 * @internal
 */
export function InternalBackdrop(props: InternalBackdrop.Props) {
  props = ownedProps(props);
  const otherProps = omit(props, 'cutout', 'ref');

  const clipPath = () => {
    const cutout = props.cutout;
    if (!cutout) {
      return undefined;
    }
    const rect = cutout.getBoundingClientRect();
    return `polygon(0% 0%,100% 0%,100% 100%,0% 100%,0% 0%,${rect.left}px ${rect.top}px,${rect.left}px ${rect.bottom}px,${rect.right}px ${rect.bottom}px,${rect.right}px ${rect.top}px,${rect.left}px ${rect.top}px)`;
  };

  return (
    <div
      ref={(el: HTMLDivElement) => assignRefs(props.ref as RefInput<HTMLDivElement>, el)}
      role="presentation"
      data-base-ui-inert=""
      {...otherProps}
      style={{
        position: 'fixed',
        inset: '0',
        'user-select': 'none',
        '-webkit-user-select': 'none',
        'clip-path': clipPath(),
      }}
    />
  );
}

export interface InternalBackdropState {}

export interface InternalBackdropProps extends JSX.HTMLAttributes<HTMLDivElement> {
  /**
   * The element to cut out of the backdrop.
   * This is useful for allowing certain elements to be interactive while the backdrop is present.
   */
  cutout?: Element | null | undefined;
  ref?: RefInput<HTMLDivElement>;
}

export namespace InternalBackdrop {
  export type State = InternalBackdropState;
  export type Props = InternalBackdropProps;
}
