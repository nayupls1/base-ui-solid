import { omit, Show } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { ScrollArea } from '@base-ui-solid/solid/scroll-area';
import './QuickNav.css';

export function Container(props: JSX.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} class={['QuickNavContainer', props.class]} />;
}

export function Content(props: JSX.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} class={['QuickNavContent', props.class]} />;
}

export function Root(props: JSX.HTMLAttributes<HTMLElement>) {
  const rest = omit(props, 'children', 'class');
  return (
    <nav aria-label="On this page" class={['QuickNavRoot', props.class]} {...rest}>
      <div class="QuickNavInner">
        <ScrollArea.Root>
          <ScrollArea.Viewport class="QuickNavViewport">{props.children}</ScrollArea.Viewport>
          <ScrollArea.Scrollbar class="QuickNavScrollbar" orientation="vertical">
            <ScrollArea.Thumb class="QuickNavScrollbarThumb" />
          </ScrollArea.Scrollbar>
        </ScrollArea.Root>
      </div>
    </nav>
  );
}

export function Title(props: JSX.HTMLAttributes<HTMLElement>) {
  return <header {...props} class={['bui-sr-only', props.class]} />;
}

export function List(props: JSX.HTMLAttributes<HTMLUListElement>) {
  const rest = omit(props, 'children', 'class');
  return (
    <Show when={props.children}>
      <ul class={['QuickNavList', props.class]} {...rest}>
        {props.children}
      </ul>
    </Show>
  );
}

export function Item(props: JSX.LiHTMLAttributes<HTMLLIElement>) {
  return <li {...props} class={['QuickNavItem', props.class]} />;
}

export function Link(props: JSX.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a {...props} class={['QuickNavLink', props.class]} />;
}
