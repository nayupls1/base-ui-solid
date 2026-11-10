import { LogoLink } from './LogoLink';
import { SkipNav } from './SkipNav';
import './Header.css';

export const HEADER_HEIGHT_DESKTOP = 64;

export function Header() {
  return (
    <header class="Header">
      <div class="HeaderInner">
        <SkipNav>Skip to contents</SkipNav>
        <LogoLink />
        <div class="HeaderSearch" />
      </div>
    </header>
  );
}
