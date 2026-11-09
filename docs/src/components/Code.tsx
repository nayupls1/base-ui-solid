import type { JSX } from '@solidjs/web';
import './Code.css';

export function Code(props: JSX.HTMLAttributes<HTMLElement>) {
  return <code {...props} class={['Code', props.class]} />;
}
