import type { JSX } from '@solidjs/web';
import './HeadingLink.css';

export function HeadingLink(props: JSX.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  return <a {...props} class={['HeadingLink', props.class]} />;
}
