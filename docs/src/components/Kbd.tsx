import type { JSX } from '@solidjs/web';
import './Kbd/Kbd.css';

export function Kbd(props: JSX.HTMLAttributes<HTMLElement>) {
  return <kbd {...props} class={['Kbd', props.class]} />;
}
