import type { JSX } from '@solidjs/web';
import { Portal } from '@solidjs/web';
import { omit, Show, untrack } from 'solid-js';
import { platform } from 'base-ui-solidjs-utils/platform';
import { useNumberFieldRootContext } from '../root/NumberFieldRootContext';
import type { BaseUIComponentProps } from '../../internals/types';
import type { NumberFieldRootState } from '../root/NumberFieldRoot';
import { stateAttributesMapping } from '../utils/stateAttributesMapping';
import { useNumberFieldScrubAreaContext } from '../scrub-area/NumberFieldScrubAreaContext';
import { useRenderElement } from '../../internals/useRenderElement';
import { ownedProps } from '../../internals/ownedProps';

const CURSOR_STYLE: JSX.CSSProperties = {
  position: 'fixed',
  top: '0',
  left: '0',
  'pointer-events': 'none',
};

/**
 * A custom element to display instead of the native cursor while using the scrub area.
 * Renders a `<span>` element.
 *
 * This component uses the [Pointer Lock API](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_Lock_API), which may prompt the browser to display a related notification. It is disabled
 * in Safari to avoid a layout shift that this notification causes there.
 *
 * Documentation: [Base UI Number Field](https://base-ui.com/react/components/number-field)
 */
export function NumberFieldScrubAreaCursor(componentProps: NumberFieldScrubAreaCursor.Props) {
  componentProps = ownedProps(componentProps);
  const elementProps = omit(componentProps, 'render', 'class', 'style', 'children', 'ref');

  const ctx = useNumberFieldRootContext();
  const scrubArea = useNumberFieldScrubAreaContext();

  const shouldRender = () =>
    scrubArea.isScrubbing &&
    !platform.engine.webkit &&
    !scrubArea.isTouchInput &&
    !scrubArea.isPointerLockDenied;

  return (
    <Show when={shouldRender()}>
      <Portal mount={document.body}>
        {untrack(() =>
          useRenderElement('span', componentProps, {
            ref: (el: HTMLSpanElement | null) => {
              scrubArea.scrubAreaCursorRef.current = el;
            },
            state: () => ctx.state,
            props: [
              {
                role: 'presentation',
                style: CURSOR_STYLE,
              },
              elementProps,
            ],
            stateAttributesMapping,
          }),
        )}
      </Portal>
    </Show>
  );
}

export interface NumberFieldScrubAreaCursorState extends NumberFieldRootState {}

export interface NumberFieldScrubAreaCursorProps extends BaseUIComponentProps<
  'span',
  NumberFieldScrubAreaCursorState
> {}

export namespace NumberFieldScrubAreaCursor {
  export type State = NumberFieldScrubAreaCursorState;
  export type Props = NumberFieldScrubAreaCursorProps;
}
