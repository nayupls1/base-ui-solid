import { Logo } from './Logo';
import './LogoLink.css';

export function LogoLink(props: { class?: string }) {
  return (
    <a aria-label="Go to the homepage" href="/" class={['LogoLink', props.class]}>
      <Logo aria-hidden="true" />
    </a>
  );
}
