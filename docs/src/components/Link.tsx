import { omit, Show } from 'solid-js';
import type { JSX } from '@solidjs/web';
import './Link.css';

interface LinkProps extends JSX.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  withArrow?: boolean;
}

export function Link(props: LinkProps) {
  const rest = omit(props, 'children', 'href', 'class', 'withArrow');

  const href = () => {
    let pathname = props.href;
    // Links coming from component descriptions point to base-ui.com.
    if (pathname.startsWith('https://base-ui.com/react/')) {
      pathname = pathname.replace('https://base-ui.com/react/', '/solid/');
    }
    return pathname;
  };

  const content = () => (
    <>
      {props.children}
      <Show when={props.withArrow}>
        <svg
          width="20"
          height="20"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          stroke-width="1"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="Icon"
        >
          <path class="LinkArrowCaret" d="M6 12L10 8L6 4" />
          <path class="LinkArrowLine" d="M2 8L13 8" />
        </svg>
      </Show>
    </>
  );

  return (
    <a {...rest} href={href()} class={['Link', props.class]}>
      {content()}
    </a>
  );
}
