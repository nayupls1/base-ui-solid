import { omit } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { platform } from '@base-ui-solid/utils/platform';
import { visuallyHidden } from '@base-ui-solid/utils/visuallyHidden';
import { ownedProps } from '../../../internals/ownedProps';

/**
 * @internal
 */
export function FocusGuard(props: JSX.HTMLAttributes<HTMLSpanElement> & { [key: string]: any }) {
  props = ownedProps(props);
  const otherProps = omit(props, 'ref');
  // Role is only for VoiceOver on WebKit, which doesn't announce hidden guards otherwise.
  const role = platform.screenReader.voiceOver && platform.engine.webkit ? 'button' : undefined;

  return (
    <span
      {...otherProps}
      ref={props.ref}
      style={visuallyHidden}
      aria-hidden={role ? undefined : 'true'}
      tabindex={0}
      role={role}
      data-base-ui-focus-guard=""
    />
  );
}
